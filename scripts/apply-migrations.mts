/* eslint-disable no-console */
// Applies supabase/migrations/*.sql to the hosted project in order, recording each file in
// supabase_migrations.schema_migrations the way the Supabase CLI does, so `npm run verify` and
// the dashboard agree. Skips files already recorded.  `npm run db:apply [--teardown] [--force]`
//   --teardown  runs supabase/teardown_v1.sql first (drops the v1 schema; one-shot, test data only)
//   --force     re-applies files even if recorded (for idempotent fixes to cron/policies)
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, '..', 'supabase', 'migrations');
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set in .env');
  process.exit(1);
}
const teardown = process.argv.includes('--teardown');
const force = process.argv.includes('--force');

const db = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await db.connect();

if (teardown) {
  const t = path.join(here, '..', 'supabase', 'teardown_v1.sql');
  process.stdout.write('teardown_v1.sql ... ');
  await db.query(fs.readFileSync(t, 'utf8'));
  console.log('ok');
}

await db.query(`create schema if not exists supabase_migrations`);
await db.query(`create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text)`);
const done = new Set((await db.query<{ version: string }>(`select version from supabase_migrations.schema_migrations`)).rows.map((r) => r.version));

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
let applied = 0;
for (const f of files) {
  const version = f.slice(0, 14);
  const name = f.slice(15).replace(/\.sql$/, '');
  if (done.has(version) && !force) {
    console.log(`${f} ... already applied`);
    continue;
  }
  const sql = fs.readFileSync(path.join(dir, f), 'utf8');
  process.stdout.write(`${f} ... `);
  await db.query('begin');
  try {
    await db.query(sql);
    await db.query(
      `insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3)
       on conflict (version) do update set name = excluded.name, statements = excluded.statements`,
      [version, name, [sql]],
    );
    await db.query('commit');
    console.log('ok');
    applied += 1;
  } catch (e) {
    await db.query('rollback');
    console.log('FAILED');
    throw e;
  }
}
console.log(`\n${applied} migration(s) applied`);
await db.end();
