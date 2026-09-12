/* eslint-disable no-console */
// One-time push setup for the hosted project: generates VAPID keys and a hook secret, stores them
// in Supabase Vault (read by push_public_key() / push_secrets(), see 000013), and records the
// send-push function URL. Idempotent: existing secrets are kept. Needs DATABASE_URL and SUPABASE_URL
// in .env. Run `npm run push:setup`, then deploy the function (supabase/functions/send-push).
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import webpush from 'web-push';

const dbUrl = process.env.DATABASE_URL;
const apiUrl = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
if (!dbUrl || !apiUrl) throw new Error('DATABASE_URL and SUPABASE_URL are required in .env');
const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await client.connect();

async function existing(name: string): Promise<string | null> {
  const r = await client.query<{ decrypted_secret: string }>(`select decrypted_secret from vault.decrypted_secrets where name = $1 order by created_at desc limit 1`, [name]);
  return r.rows[0]?.decrypted_secret ?? null;
}
async function put(name: string, value: string, description: string) {
  const cur = await existing(name);
  if (cur === value) return 'kept';
  if (cur !== null) {
    await client.query(`select vault.update_secret(id, $2, $1, $3) from vault.secrets where name = $1`, [name, value, description]);
    return 'updated';
  }
  await client.query(`select vault.create_secret($1, $2, $3)`, [value, name, description]);
  return 'created';
}

const pub = await existing('vapid_public_key');
const priv = await existing('vapid_private_key');
const keys = pub && priv ? { publicKey: pub, privateKey: priv } : webpush.generateVAPIDKeys();
console.log('vapid_public_key   ', await put('vapid_public_key', keys.publicKey, 'Web Push VAPID public key (safe to share)'));
console.log('vapid_private_key  ', await put('vapid_private_key', keys.privateKey, 'Web Push VAPID private key'));
console.log('push_hook_secret   ', await put('push_hook_secret', (await existing('push_hook_secret')) ?? randomBytes(24).toString('base64url'), 'Shared secret between pg_net and send-push'));
console.log('push_function_url  ', await put('push_function_url', `${apiUrl.replace(/\/$/, '')}/functions/v1/send-push`, 'Where push_kick() posts'));
console.log('\npublic key:', keys.publicKey);
await client.end();
