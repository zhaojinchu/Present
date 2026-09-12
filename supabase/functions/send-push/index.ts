// send-push: delivers queued notifications (public.push_queue) to every browser subscription of
// each user over Web Push. Called by the database (pg_net) with a shared secret, never by clients,
// so verify_jwt is off and the secret header is the auth. Secrets come from Vault via push_secrets().
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

interface QueueRow { id: string; user_id: string; title: string; body: string; url: string; tag: string; attempts: number }
interface Sub { endpoint: string; p256dh: string; auth: string }

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  const { data: secrets, error: se } = await admin.rpc('push_secrets');
  if (se || !secrets?.vapid_private_key || !secrets?.hook_secret) return json(503, { error: 'push is not set up (run npm run push:setup)' });
  const given = req.headers.get('x-push-secret') ?? '';
  if (given.length === 0 || given !== secrets.hook_secret) return json(401, { error: 'unauthorized' });
  webpush.setVapidDetails('mailto:present@present.expo.app', secrets.vapid_public_key, secrets.vapid_private_key);

  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === 'string') : [];
  let query = admin.from('push_queue').select('id,user_id,title,body,url,tag,attempts').is('sent_at', null).lt('attempts', 3).order('created_at').limit(50);
  if (ids.length > 0) query = query.in('id', ids);
  const { data: rows, error } = await query;
  if (error) return json(500, { error: error.message });

  let delivered = 0, dropped = 0, failed = 0;
  for (const row of (rows ?? []) as QueueRow[]) {
    const { data: subs } = await admin.from('push_subscriptions').select('endpoint,p256dh,auth').eq('user_id', row.user_id);
    const list = (subs ?? []) as Sub[];
    const payload = JSON.stringify({ title: row.title, body: row.body, url: row.url, tag: row.tag });
    let ok = 0;
    let lastError: string | null = list.length === 0 ? 'no subscription' : null;
    for (const s of list) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 900, urgency: 'high' });
        ok += 1;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
          dropped += 1;
        } else {
          failed += 1;
          lastError = `${status ?? ''} ${(e as Error).message ?? e}`.trim().slice(0, 200);
        }
      }
    }
    delivered += ok;
    // A row is done when every live subscription got it, or when there was nothing to deliver to.
    const done = ok > 0 || list.length === 0 || failed === 0;
    await admin.from('push_queue').update({ attempts: row.attempts + 1, sent_at: done ? new Date().toISOString() : null, last_error: lastError }).eq('id', row.id);
  }
  return json(200, { processed: rows?.length ?? 0, delivered, dropped, failed });
});
