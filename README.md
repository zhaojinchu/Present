# Present

Present is a class attendance app for groups of friends, built at HackCMU 2026 by a team of four. When a class starts you post a photo from inside the room, front camera then back, and your friends see who was on time, who was late and who missed. It is a web app in `web/` (Vite, React 19, TypeScript, Tailwind v4) that installs to a phone's home screen, on Supabase, and it is deployed at https://present.expo.app.

## How it works

- Classes come from a calendar (`.ics`) import or are added by hand.
- Posting opens 2 minutes before a class. A post is on time until 10 minutes after the start and late until 10 minutes after the end, and after that it is a miss, which a pg_cron job looks for every minute.
- While one of your classes is open and you have not posted, the app shows only a lock page with a "Present" button. Posting, excusing the class ("Can't make it", with a reason friends can see) or the window closing lifts it.
- Friends add each other by username, link or QR code. A circle is a group of friends with a shared streak, and it can set stakes for whoever misses.
- Friend requests, misses, comments on your posts and class windows opening send Web Push notifications.

The first version, an Expo app in `app/`, `components/` and `lib/`, was written against the v1 schema, which the current migrations replace.

## Run it

```bash
npm install
npm --prefix web install
cp web/.env.example web/.env      # set VITE_MOCK_STATE=1 to run it with no backend
npm run web:dev
```

`npm run sql:test` runs the migrations and their tests in an in-process Postgres, with no Supabase needed. Setting up Supabase, the scripts and deploying are in [docs/SETUP.md](docs/SETUP.md).
