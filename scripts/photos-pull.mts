/* eslint-disable no-console */
// Pulls the real accounts' recent post photos (front and back) out of the private bucket into
// scripts/seed/photos, named <username>-<n>.jpg and <username>-<n>-back.jpg, so the next
// `npm run seed` puts real lecture-hall pictures on every history post (the demo "mockup" feed).
//
//   npm run photos:pull            last 2 days
//   npm run photos:pull -- --all   everything still in the bucket
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'seed', 'photos');
const all = process.argv.includes('--all');
const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const dbUrl = process.env.DATABASE_URL!;
if (!url || !key || !dbUrl) throw new Error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DATABASE_URL are required in .env');

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const db = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await db.connect();
const rows = (
  await db.query<{ username: string; photo_path: string; photo_back_path: string | null }>(
    `select pr.username, ps.photo_path, ps.photo_back_path
       from public.posts ps
       join public.profiles pr on pr.id = ps.user_id
       join auth.users u on u.id = pr.id
      where u.email not like '%@present.demo' and ps.photo_path is not null and ps.photo_path not like 'seed/%'
        ${all ? '' : "and ps.created_at >= now() - interval '2 days'"}
      order by pr.username, ps.created_at`,
  )
).rows;
await db.end();
fs.mkdirSync(outDir, { recursive: true });

async function save(storagePath: string, file: string): Promise<boolean> {
  const { data, error } = await admin.storage.from('checkin-photos').download(storagePath);
  if (error || !data) {
    console.warn(`! ${storagePath}: ${error?.message ?? 'no data'}`);
    return false;
  }
  fs.writeFileSync(path.join(outDir, file), Buffer.from(await data.arrayBuffer()));
  return true;
}

const counter: Record<string, number> = {};
let saved = 0;
for (const r of rows) {
  const n = (counter[r.username] = (counter[r.username] ?? 0) + 1);
  if (await save(r.photo_path, `${r.username}-${n}.jpg`)) saved += 1;
  if (r.photo_back_path && (await save(r.photo_back_path, `${r.username}-${n}-back.jpg`))) saved += 1;
}
console.log(`${saved} photo(s) from ${rows.length} post(s) -> ${path.relative(process.cwd(), outDir)}`);
console.log('Next: npm run seed');
