# Present at HackCMU 2026: how we win

Source: the opening-ceremony deck and the FAQ. Everything below is optimised against what is actually scored, and matches the v2 product (friends, posts with on-time and late, misses, heading out, nudges, the together deck, weekly stats).

## What is scored

Five columns, from the judging slide:

| Column | Their words | What it means for us |
|---|---|---|
| Originality | "Entirely novel. A fresh approach to a problem." | Lead with what happens before the miss: heading out, nudges, the deck. Not the feature list. |
| Technical difficulty | "Real technical challenges vs ChatGPT wrapper" | Show the database deciding on time, late and missed. No AI gimmicks. |
| Demo quality | "Clear, understandable, and under 3 minutes" | Rehearsed 2:45 script. The miss is the climax. |
| Usefulness | "Practical and fulfils a real need" | One sentence of problem, one real number, "we used it on ourselves today". |
| Relevance (track only) | "How related the project idea is to the track" | Multiplayer: "this is how you can meet people and touch grass :P". Say those words. |

Format: 3 minutes, presentation plus demo, three judging rooms in parallel, a spreadsheet says where and when. Expo tables for every team during the Platform Showcase, 4:00 to 6:30pm. Projects due 4:00pm via the Google form. Awards 7:00 to 8:00pm.

## Track: Multiplayer

The deck's own description of the track is "this is how you can meet people and touch grass". Present is a multiplayer game whose only move is to physically show up, with your friends watching and walking there with you. Nothing else fits as literally. Optimization ("perhaps optimize something?") would cost us the Relevance column and win nothing back.

50-word justification for the form (48 words):

> Present is multiplayer by construction: your schedule is shared with friends, you say "leaving now" and they walk with you, they nudge you when your class is open and you have not posted, and the feed stacks everyone in the same lecture into one card. The only move is to physically show up.

## Prizes we can realistically take

1. **Multiplayer track** (mini projector + AirPods). Main target. Prize depth depends on how many teams pick the track; assume it is the popular one and aim for first.
2. **Best Design Prize** (Fujifilm QuickSnap cameras). We have a written teardown of four social apps, a token file, and a mockup canvas. Almost no hackathon team can show that. Put it in the pitch (20 seconds) and in the submission text. The prize is a film camera; we are a photo app. Say so.
3. **People's Favorite** (Ticket to Ride). Won at the expo table, not in the judging room. See table plan.
4. **Grand Prize** (HRT poker set). Judged across all projects; same pitch, no extra work.
5. **Sandia cybersecurity**: a stretch, but free to mention on the form: row-level security on every table, security-definer RPCs, photos behind 1-hour signed URLs that expire for friends after 24 hours, no coordinates ever stored on a post.
6. **Cursor prize**: if anyone used Cursor, tick it. Zero cost.

Skip: IFM track, MLH API prizes (Gemini, ElevenLabs, Auth0, MongoDB, Vultr, Solana). Each is an hour of bolt-on work that makes us look more like a wrapper and less like a product.

## The 3-minute script (target 2:45)

Roles: P1 presents and is mirrored to the screen. P2 and P3 post. P4 is "Alex" and misses. Everyone has the demo class 15-122 in their schedule and the four accounts are mutual friends.

**0:00 to 0:25, the problem.** "Everyone here has a 9:30 they keep skipping. The things that exist don't help: attendance systems are the university policing you, habit apps are solo. Present is a multiplayer game where the only move is to show up. Strava for class, with friends."

**0:25 to 0:45, how it works.** Today screen on the projector. "Your schedule comes from your calendar in one upload. Two minutes before each class a window opens. You post a photo from the room, on time for ten minutes, late after that, and if you never post your friends see a miss and you owe them an explanation. Your streak counts on-time posts."

**0:45 to 1:50, live demo.** Start 15-122 from the dev panel. P1 taps "Leaving now" and the feed shows Sam heading to GHC. P2 and P3 post; the feed stacks them into one deck: "Priya and Jordan are in 15-122", swipe to see each. P1 nudges Alex; Alex's phone shows the banner "Sam nudged you, on time for 1:12". Alex still does not post. End the window: "Alex missed 15-122", the streak that was 10 shows 0. Alex types "slept in" as the first comment. Reactions land.

**1:50 to 2:15, under the hood.** One architecture card. "Everything the client just showed you was decided by the database. On time, late and missed are three timestamps the server writes; the client never decides. Streaks are computed on read, never stored. Miss detection is a cron job. Row-level security on every table; the photo you saw expires for friends in 24 hours, and no coordinates are ever stored on a post."

**2:15 to 2:40, why it is original, and the design.** "The photo moment looks like the app you are thinking of, on purpose: it proved people will take a photo when told to. Everything before the photo is ours. Heading out, so attendance becomes meeting up. Nudges, so friends catch you before the miss. One card for everyone in the same lecture. We designed it after tearing down Instagram, Strava and X: one spot colour for the streak, hairlines instead of cards, tabular numbers."

**2:40 to 2:50, close.** "Present. Your friends know if you showed up, and they will walk there with you. It's live at present.expo.app; add us at the table."

Stop talking at 2:50. Leave 10 seconds for the judges to start questions.

Likely questions and the one-line answers:
- "Isn't this just [the daily-photo app]?" "The camera moment is, deliberately. Everything else isn't: it verifies nothing and nothing happens if you don't post. Present knows your schedule, knows who is walking to the same room, lets friends nudge you before the miss, and shows a miss when you don't show. It is a coordination tool with a photo as the receipt." Then stop. Do not list features.
- "What stops someone sending an old photo?" The camera is the only input; there is no upload from the library, and the window is tied to the class time.
- "What about posting from outside the room?" Posts pin the room on the first on-time post and later ones get a "Nearby" badge; and the photo goes to your friends, so you would be lying to their faces.
- "Did AI write this?" We used AI tools like everyone here. Every rule lives in SQL we can walk you through: [teammate] owns the window and miss detection, [teammate] the camera pipeline, [teammate] the calendar import, [teammate] the social layer.
- "Why not let the university use it?" Because then it's surveillance. Friends only, photos expire.

## Expo table plan (People's Favorite)

- Laptop with the feed open and the design canvas on a second tab. Phones charged, hotspot on, brightness max.
- Visitors post a photo on our phone as a friend and watch it land in the deck on the laptop. No install, no sign-up, thirty seconds, and they have played.
- A printed card: one-liner, QR to present.expo.app, our usernames to add, and "vote for us" with whatever the People's Favorite mechanism is (ask an organiser at lunch).
- Say "touch grass" once per visitor. It's the track's own joke.

## Timeline for the remaining hours

- **Now.** Freeze features. Seed real photos so the feed history has pictures. Sleep in shifts; a tired presenter loses more points than any feature gains.
- **10am to 1pm.** Mentor office hours, TEP Simmons B. Ask a mentor to judge a full run with a stopwatch.
- **Lunch, 12 to 1.** Ask twenty hackers "how many classes did you skip this week?" and use the real number in the pitch. Post real photos at the venue; they double as rehearsal.
- **2pm.** Submission text final: description, track justification, repo link, hosted URL, screenshots, the design canvas link.
- **3pm.** Three full dress rehearsals, phones in the exact demo state each time. Time every run.
- **3:45pm.** Submit. Do not touch the code after this.
- **4:00 to 6:30.** Table set up before the first judging slot. One teammate always at the table.

## Things that lose points

- Signing in, editing schedules, or seeding during the slot.
- A feed without photos.
- Explaining features instead of showing the miss.
- Adding a sponsor API tonight.
- Running over three minutes. "Under 3 minutes" is literally in the rubric.
- Naming the app this is modelled on in anything written. Say it out loud once if a judge asks, on your terms.
