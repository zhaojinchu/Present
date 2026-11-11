# Setup

1. Create a Supabase project. In the dashboard:
   - Authentication, Providers, Email: turn off "Confirm email", so sign-up logs in at once.
   - Integrations, Cron: enable it, which installs `pg_cron`.
2. Apply the migrations in `supabase/migrations/` in order, with `supabase db push` or `npm run db:apply`. The `*_supabase_only.sql` files (cron, realtime, storage, push) need hosted Supabase.
3. Copy `.env.example` to `.env` and `web/.env.example` to `web/.env`, and fill them in (below).
4. Install both packages. The root `.npmrc` sets `legacy-peer-deps`, because a transitive react-dom peer range conflicts with React 19.2.

   ```bash
   npm install
   npm --prefix web install
   ```

5. Run `npm run push:setup`, which generates the VAPID keys and a hook secret and stores them in Supabase Vault. Then deploy the two functions in `supabase/functions/`: `fetch-ics` with JWT verification on (set in `supabase/config.toml`), and `send-push` with it off, since it checks an `x-push-secret` header instead.
6. Seed the demo data with `npm run seed`. It reads `scripts/seed/schedules.json` (or `schedules.example.json`) and any photos in `scripts/seed/photos/` named `<first>-<n>.jpg`.
7. `npm run web:dev` runs the app locally. `npm run web:deploy` publishes it to https://present.expo.app on EAS Hosting, which needs `npx expo login` once.

Hosted Supabase rejects made-up email domains at sign-up ("Email address is invalid"), so sign up in the app with a real address. The seed accounts are created through the admin API, which skips that check.

## Environment

Root `.env`, for the scripts only:

| Variable | What it is |
| --- | --- |
| `SUPABASE_URL` | The project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | The secret key (`sb_secret_...`). The seed needs the admin API, and the publishable key does not work here |
| `DATABASE_URL` | The Session pooler URI, port 5432. Remove the template's `[ ]` around the password and URL-encode characters such as `!`, `@` and `#` |

`web/.env`, public values the web bundle ships with:

| Variable | What it is |
| --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | The project URL and publishable key |
| `VITE_MOCK_STATE` | `1` serves `web/src/mock/state.ts` through every hook, with no backend |
| `VITE_DEV_PANEL` | `1` shows the demo controls (5 taps on your avatar) |
| `VITE_APP_URL` | The public origin for share links |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run web:dev`, `web:build`, `web:typecheck` | Dev server, build into `web/dist`, type check |
| `npm run web:deploy`, `web:deploy:preview` | Build, then deploy to production or a preview URL on EAS Hosting |
| `npm run sql:test` | The migrations and their tests in PGlite, at an injectable clock |
| `npm run ics:test` | The calendar parser against four fixtures in `scripts/fixtures/ics/` |
| `npm run seed` | Rebuilds the demo accounts, friendships, classes, circles and post history |
| `npm run smoke [first]` | Signs in as a seed user and checks the hosted `get_state()` against the web app's contract |
| `npm run verify` | Checks the hosted project has what the app needs. Run it after every migration |
