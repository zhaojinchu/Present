# Present design system

The visual contract for the app. Tokens live in `lib/theme.ts`, primitives in `components/ui.tsx`. If a screen needs a value that is not in the theme, the theme is wrong, not the screen.

## 1. What the reference apps actually do

Teardown of Instagram, BeReal, Strava and X (September 2026). Values marked (est.) are community-reconstructed, not published by the company; everything else is sourced.

| | Instagram | BeReal | Strava | X |
|---|---|---|---|---|
| Background | `#000000` true black, elevated `#121212` to `#262626` | `#000000` | near-black blue-grey (`#121b20` est.), never pure black | `#000000` Lights Out; `#15202B` Dim (retired) |
| Accent | one: `#0095F6` blue | one: `#FFCC4D` yellow, almost never in chrome | one: `#FC5200` orange, only on links, CTA, active tab, given kudos | `#1D9BF0` blue on links and buttons only |
| Semantic colour | `#ED4956` like-red only on the filled heart | none | gold PR medal | pink `#F91880` heart, green `#00BA7C` repost, only after the tap |
| Text | white and 2 greys (`#A8A8A8`, `#8E8E8E` est.) | white and one grey | off-white `#f1f7fb`, `#94a3b8`, `#64748b` (est.) | white and one grey |
| Type | system font (SF Pro / Roboto); hierarchy by weight, not size | system font (est.) | Inter for data UI, a custom face for brand only | Chirp (custom), ~15pt body (est.) |
| Feed unit | edge-to-edge media, text inset 16pt, no card, no border | photo is the whole card, 3:4, PiP selfie top-left | activity card: avatar + name + time, big stats, media | 48pt avatar, 16pt padding, 1px hairline, 16pt media radius, no card |
| Signature | story ring gradient, outline/filled tab icons | "2 hr late" and retake count shown publicly, blur until you post | big tabular number with a small uppercase tracked label | thread line between avatars; icons grey until you act |
| Motion | heart burst, filled-glyph tab switch | countdown, flip | kudos fill turns orange | 1s ease-out-back heart burst |

What they have in common, and what "looks like a real product" reduces to:

1. **One accent.** Every one of them has exactly one interactive colour. Greys do the hierarchy. Semantic colours (red, green) appear only on the thing that changed state, never as a background.
2. **No cards.** Feed items are separated by whitespace or a 1px hairline. Nothing has a border and a radius and a coloured edge. Depth is a lighter surface, never a shadow.
3. **Media first.** Photos bleed to the text column edge, get one large radius, and are the loudest thing on screen. Chrome recedes.
4. **One typeface, weight for hierarchy.** Names are bold at the same size as the caption. Timestamps are grey, not tiny.
5. **Stats are a pattern.** Strava's big tabular numeral with a small tracked uppercase label is the template for every streak and count.
6. **One icon family at one size.** Outline when inactive, filled when active. No emoji as UI.
7. **Social pressure is data, not decoration.** "3 of 4 are there", "2 hr late", the retake count. Present's equivalents: who has checked in, the streak dying, the forfeit owed.

## 2. Principles for Present

Scheme A, light (decided 12 Sep 2026): white ground, a black primary button, and one spot colour reserved for the streak.

- **White chrome, dark capture.** The app is white because it is used at 9:30am walking into a lecture hall and judged on laptops in a lit room. The camera, preview and upload screens stay black (the `capture` palette), the way Instagram does it.
- **Black is the action.** The primary button, links and selected checks are near-black. No coloured accent competes with the content.
- **Ember is the streak.** `#FF6B1F` appears only as the flame icon, the streak numbers and my own reaction. It is never a button, a border, a background wash or decoration.
- **Colour only on the changed thing.** Skipped is a red badge and a red number, not a red card. Owed is an amber badge. Excused is a blue badge.
- **Hierarchy by opacity.** Text is near-black at 100 / 62 / 42 / 28 percent. No hue changes for secondary text.
- **Hairlines, not borders.** 1px at 8 percent black between rows. Cards are a flat grey with no stroke.
- **System font, tabular digits.** SF Pro on iOS. Every counter, countdown and streak uses `tabular-nums` so digits do not jitter.
- **Icons, not emoji.** Ionicons at 16 / 20 / 24. Emoji are content (reactions) only.
- **Sentence case everywhere.** Uppercase only in the `label` style with tracking.
- **44pt targets, 16pt gutter, 4pt grid.**

## 3. Tokens

### Colour

| Token | Value | Use |
|---|---|---|
| `bg` | `#FFFFFF` | screen |
| `surface` | `#F4F4F6` | grouped lists, hero card |
| `surfaceRaised` | `#EAEAEE` | inputs, chips, secondary button, badge neutral |
| `surfaceOverlay` | `#DEDEE4` | pressed row, segmented thumb |
| `border` | black 8% | hairlines |
| `borderStrong` | black 16% | focus rings, avatar ring |
| `text` | `#0A0A0B` | primary |
| `textSecondary` | 62% | metadata, subtitles |
| `textTertiary` | 42% | labels, placeholders, chevrons |
| `textDisabled` | 28% | |
| `accent` | `#0A0A0B` | primary button, links, selected checks |
| `accentSoft` | 8% | accent badge, icon disc |
| `ember` / `emberDeep` / `emberSoft` | `#FF6B1F` / `#E85F19` / 14% | flame, streak numbers, my reaction |
| `success` / `successSoft` | `#1E9E4A` / 12% | checked in, paid |
| `danger` / `dangerSoft` | `#DF3327` / 12% | skipped, dead streak, destructive |
| `warning` / `warningSoft` | `#9A6B00` / amber 20% | forfeit owed |
| `info` / `infoSoft` | `#0B7BC2` / 12% | excused |
| `capture.*` | `#0A0A0B` ground, `#F2F2F5` text | camera, preview, upload only |

Semantic colours are darkened so their text passes contrast on white. The `Soft` variants are the only allowed tinted backgrounds, and only inside a badge, icon disc or reaction pill. Avatars use six pastel fills with near-black initials.

### Type (system font)

| Style | Size / line | Weight | Notes |
|---|---|---|---|
| `display` | 44 / 48 | 700 | streak hero, tabular, tracking -1.2 |
| `stat` | 28 / 32 | 700 | secondary stats, tabular |
| `largeTitle` | 32 / 38 | 700 | screen titles, panel titles |
| `title` | 22 / 28 | 700 | section titles, feed header |
| `headline` | 17 / 22 | 600 | names, row titles, buttons |
| `body` | 17 / 22 | 400 | captions, row text |
| `subhead` | 15 / 20 | 400 | secondary lines |
| `footnote` | 13 / 18 | 400 | timestamps, hints |
| `caption` | 12 / 16 | 500 | badges, chips |
| `label` | 11 / 14 | 600 | uppercase, tracking +0.7, section labels and stat labels |

Weights are 400, 600, 700 only. No 800 or 900.

### Space, radius, size

- Space: 4, 8, 12, 16, 24, 32, 48. Gutter 16.
- Radius: 8 chips, 12 buttons and inputs, 16 cards and inset photos, 20 edge-to-edge photos and sheets, pill.
- Buttons 36 / 44 / 52 tall. Inputs 52. Avatars 24 / 32 / 40 / 56 / 72. Icons 16 / 20 / 24.
- Motion: 120ms press (scale 0.97), 200ms fades, 400ms panels. Haptic only on check-in success and primary confirmations.

## 4. Components

| Component | Rule |
|---|---|
| `Txt` | the only way to render text; `variant` + `tone` |
| `Button` | primary (black fill, white text), secondary (raised grey), tertiary (text only), destructive (red soft), inverse (white, for the dark capture surfaces). No green button: confirming is a normal action. |
| `Badge` | soft tint + tinted caption text, sentence case, optional 12pt icon. Never bordered. |
| `Chip` | selectable; selected is inverted (black fill, white text) so no colour is needed |
| `StreakChip` | flame icon + tabular number; ember when alive, red outline flame when dead |
| `Stat` | tabular number over an uppercase label |
| `Card` | `surface` fill, radius 16, no border, no coloured edge |
| `Group` + `ListRow` | inset grouped list with hairlines between rows, chevron when tappable |
| `Avatar` | initials on a deterministic muted hue; `AvatarStack` overlaps at 30% |
| `IconBadge` | icon in a tinted disc; replaces every emoji in panels and empty states |
| `Segmented` | raised track, overlay thumb |
| `Mark` / `Wordmark` | PLACEHOLDER until the logo is chosen: black tile with a white P, same as the placeholder app icon |

## 5. Screens

**Tab bar.** Background `bg`, hairline top. Active tint near-black with the filled glyph, inactive tertiary with the outline glyph. Labels stay (three tabs, projector demo).

**Today.** Large title "Today" with the date beneath. Streak hero: `surface` card with two `Stat` blocks (circle streak in `display`, your streak in `stat`), a label line, and an `AvatarStack` of who has checked in today. Dead streak: the number turns red and the label reads "Streak lost". Forfeit owed: one `ListRow` with a warning `IconBadge`, tappable. Classes: a `Group` of rows, time column left (tabular), course and building centre, status `Badge` right. The open class is its own card with a full-width primary button and the countdown in tabular digits.

**Circle feed.** Header: circle name in `title`, subtitle "4 members · live" with a 6pt green dot. Trailing `StreakChip`. Day labels in `label`. Items are edge-to-edge rows with a hairline, X anatomy: 40pt avatar, name in `headline` and the action in `body` on one line, timestamp in `footnote` tertiary on the right. Photo below, aligned to the text column, radius 16, 3:4, PiP selfie top-left with a 2pt `bg` border. Skip: avatar with a small red badge, "skipped 15-122" with "skipped" in red, then a `Stat` pair "8 → 0" where 0 animates in red. Explanation renders as a quote box under its skip, not as a separate item. Forfeit owed: yellow `Badge` "Owed" plus a secondary "Mark paid". Paid: green `Badge`. Joined: centred footnote. Reactions: small raised pills, mine in `accentSoft`.

**Check-in.** The one dark flow: everything here uses the `capture` palette. Camera full bleed. Top: 40pt scrim close button, course code in `headline` with a text shadow, countdown pill in tabular `subhead`. Shutter: white ring 78pt with a white 62pt disc, like the system camera. Flip button 44pt scrim. Preview bar: secondary "Retake", inverse (white) "Use photo". Every non-camera state is a `Panel`: 72pt `IconBadge`, `largeTitle`, `subhead` secondary, stacked buttons. Success: green check disc, "You're in.", a `Stat` of the new streak.

**You.** Avatar 64 with name in `title` and email beneath. Three `Stat`s: your streak, circle streak, members. A `Group` for the circle (name and forfeit, invite code in tabular headline with tracking, share tertiary) and a `Group` of members sorted by streak with `StreakChip` trailing. A `Group` for settings: Edit schedule, Sign out (destructive). Privacy footnote at the bottom.

**Sign in / up.** `Wordmark` at 32, tagline in `subhead` secondary, inputs with 12pt gaps, primary button, tertiary link.

**Circle create / join.** `Segmented` Create / Join. Forfeit presets as a `Group` of rows with a filled `checkmark-circle` on the selected one. Invite code in `display` tabular with tracking 6.

**Schedule.** Rows in a `Group`: course code `headline`, name and building `footnote`, days and time trailing in tabular `subhead`. Edit form uses `Field` labels and `Chip`s.

**Forfeit.** Avatar 56, name `title`, status `Badge`. Description in `headline`. Details `Group`. Primary "Mark paid". Other open forfeits as rows.

## 6. Copy

- Sentence case. No ALL CAPS outside `label`.
- Names bold, everything else regular: "**Alex** skipped 15-122".
- One separator dot per line at most: "9:30 AM · GHC". Never chains of three.
- No arrows or chevron characters in text. Use the icon.
- No emoji in system copy. Reactions are the only emoji.
- Short, plain, a little dry: "You're in." "Streak lost." "Only your circle can clear this." No jokes in error states.

## 7. Checklist before merging a screen

- [ ] no hex literal, no `fontSize`, no radius number outside `lib/theme.ts`
- [ ] no bordered card, no coloured left edge, no tinted card background
- [ ] ember appears only on flames, streak numbers and my reaction; the only coloured fill is the black primary button
- [ ] every counter uses a tabular style
- [ ] every icon is Ionicons; no emoji outside reactions
- [ ] tap targets 44pt; pressed state on every Pressable
- [ ] gutter 16, vertical rhythm on the 4pt grid
