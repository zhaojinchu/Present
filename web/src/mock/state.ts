// Fixture served through every hook when VITE_MOCK_STATE=1, so any screen can be built and
// screenshotted with no backend. Times are relative to "now" so every phase is visible at once.
import type { AppState, Comment, FeedEvent, Occurrence, Reaction } from '@/lib/types';

export const MOCK_ME_ID = '00000000-0000-4000-8000-000000000001';
const SAM = '00000000-0000-4000-8000-000000000002';
const PRIYA = '00000000-0000-4000-8000-000000000003';
const JORDAN = '00000000-0000-4000-8000-000000000004';

const people = {
  [MOCK_ME_ID]: { username: 'alex', display_name: 'Alex Chen', avatar_url: null },
  [SAM]: { username: 'sam', display_name: 'Sam Okafor', avatar_url: null },
  [PRIYA]: { username: 'priya', display_name: 'Priya Natarajan', avatar_url: null },
  [JORDAN]: { username: 'jordan', display_name: 'Jordan Lee', avatar_url: null },
} as const;

function iso(msFromNow: number, base: number): string {
  return new Date(base + msFromNow).toISOString();
}
const MIN = 60_000;
const HOUR = 3_600_000;

function localDate(base: number): string {
  const d = new Date(base);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface OccSpec {
  id: string;
  user: string;
  course: string;
  name: string;
  location: string;
  startOffsetMin: number; // relative to now
  durationMin?: number;
  status?: Occurrence['status'];
  late?: boolean;
  postedOffsetMin?: number;
  pinned?: boolean;
}

function occ(base: number, s: OccSpec): Occurrence {
  const dur = s.durationMin ?? 50;
  const starts = s.startOffsetMin * MIN;
  const ends = starts + dur * MIN;
  const status = s.status ?? 'pending';
  const p = people[s.user as keyof typeof people];
  const postedAt = s.postedOffsetMin != null ? iso(s.postedOffsetMin * MIN, base) : null;
  return {
    id: s.id,
    user_id: s.user,
    username: p.username,
    display_name: p.display_name,
    avatar_url: p.avatar_url,
    class_id: `class-${s.course}-${p.username}`,
    course_code: s.course,
    name: s.name,
    location_text: s.location,
    lat: s.pinned ? 40.4436 : null,
    lng: s.pinned ? -79.9446 : null,
    radius_m: s.pinned ? 60 : null,
    date: localDate(base + starts),
    starts_at: iso(starts, base),
    ends_at: iso(ends, base),
    opens_at: iso(starts - 2 * MIN, base),
    on_time_until: iso(starts + 10 * MIN, base),
    deadline: iso(ends + 10 * MIN, base),
    status,
    late: !!s.late,
    posted_at: status === 'posted' ? postedAt : null,
    is_demo: false,
    post:
      status === 'posted'
        ? {
            id: `post-${s.id}`,
            photo_path: `mock:${p.username}-${s.course}`,
            photo_back_path: `mock:${p.username}-${s.course}-back`,
            caption: null,
            late: !!s.late,
            location_verified: !!s.pinned,
            retake_count: 0,
            expires_at: iso(24 * HOUR, base),
          }
        : null,
  };
}

interface PostSpec {
  id: string;
  user: string;
  course: string;
  location: string;
  offsetMin: number; // created_at relative to now (negative = past)
  late?: boolean;
  minutesLate?: number;
  verified?: boolean;
  retakes?: number;
  caption?: string | null;
  streak: number;
  /** Class start relative to now; posts from the same session share it (they group into one deck). */
  startsOffsetMin?: number;
}

function postEvent(base: number, s: PostSpec): FeedEvent {
  const p = people[s.user as keyof typeof people];
  const created = s.offsetMin * MIN;
  const startsAt = s.startsOffsetMin != null ? iso(s.startsOffsetMin * MIN, base) : iso(created - (s.late ? (s.minutesLate ?? 20) + 10 : 3) * MIN, base);
  return {
    id: s.id,
    actor_id: s.user,
    occurrence_id: `occ-${s.id}`,
    type: 'post',
    ref_id: `post-${s.id}`,
    payload: {
      display_name: p.display_name,
      username: p.username,
      avatar_url: p.avatar_url,
      course_code: s.course,
      location_text: s.location,
      starts_at: startsAt,
      posted_at: iso(created, base),
      photo_path: `mock:${p.username}-${s.id}`,
      photo_back_path: `mock:${p.username}-${s.id}-back`,
      caption: s.caption ?? null,
      late: !!s.late,
      location_verified: !!s.verified,
      retake_count: s.retakes ?? 0,
      expires_at: iso(created + 24 * HOUR, base),
      streak_after: s.streak,
    },
    created_at: iso(created, base),
  };
}

export function buildMockState(base = Date.now()): AppState {
  const todayOcc: Occurrence[] = [
    // mine
    occ(base, { id: 'occ-me-122', user: MOCK_ME_ID, course: '15-122', name: 'Principles of Imperative Computation', location: 'GHC 4401', startOffsetMin: -3, pinned: true }),
    occ(base, { id: 'occ-me-241', user: MOCK_ME_ID, course: '21-241', name: 'Matrices and Linear Transformations', location: 'DH 2210', startOffsetMin: 125 }),
    occ(base, { id: 'occ-me-101', user: MOCK_ME_ID, course: '76-101', name: 'Interpretation and Argument', location: 'BH 255B', startOffsetMin: -185, durationMin: 80, status: 'posted', postedOffsetMin: -181 }),
    occ(base, { id: 'occ-me-200', user: MOCK_ME_ID, course: '36-200', name: 'Reasoning with Data', location: 'POS 152', startOffsetMin: -300, status: 'missed' }),
    // friends
    occ(base, { id: 'occ-sam-122', user: SAM, course: '15-122', name: 'Principles of Imperative Computation', location: 'GHC 4401', startOffsetMin: -3 }),
    occ(base, { id: 'occ-sam-151', user: SAM, course: '15-151', name: 'Mathematical Foundations for CS', location: 'WEH 7500', startOffsetMin: 210 }),
    occ(base, { id: 'occ-priya-122', user: PRIYA, course: '15-122', name: 'Principles of Imperative Computation', location: 'GHC 4401', startOffsetMin: -3, status: 'posted', postedOffsetMin: -1, pinned: true }),
    occ(base, { id: 'occ-jordan-122', user: JORDAN, course: '15-122', name: 'Principles of Imperative Computation', location: 'GHC 4401', startOffsetMin: -3, status: 'posted', postedOffsetMin: -2 }),
    occ(base, { id: 'occ-jordan-127', user: JORDAN, course: '21-127', name: 'Concepts of Mathematics', location: 'WEH 5403', startOffsetMin: 150 }),
  ];

  const feed: FeedEvent[] = [
    // A nudge aimed at me (my 15-122 window is open): drives the banner.
    {
      id: 'n1',
      actor_id: PRIYA,
      occurrence_id: 'occ-me-122',
      type: 'nudge',
      ref_id: MOCK_ME_ID,
      payload: {
        display_name: 'Priya Natarajan',
        username: 'priya',
        avatar_url: null,
        target_id: MOCK_ME_ID,
        target_username: 'alex',
        target_name: 'Alex Chen',
        target_avatar_url: null,
        course_code: '15-122',
        starts_at: iso(-3 * MIN, base),
        deadline: iso(57 * MIN, base),
      },
      created_at: iso(-30_000, base),
    },
    // Priya and Jordan posted from the same 15-122 session: one deck in the feed.
    postEvent(base, { id: 'p1', user: PRIYA, course: '15-122', location: 'GHC 4401', offsetMin: -1, verified: true, retakes: 1, streak: 11, caption: 'front row energy', startsOffsetMin: -3 }),
    postEvent(base, { id: 'p2', user: JORDAN, course: '15-122', location: 'GHC 4401', offsetMin: -2, streak: 11, startsOffsetMin: -3 }),
    // Sam said "leaving now" for the same class and still has not posted.
    {
      id: 'h1',
      actor_id: SAM,
      occurrence_id: 'occ-sam-122',
      type: 'heading_out',
      ref_id: null,
      payload: { display_name: 'Sam Okafor', username: 'sam', avatar_url: null, course_code: '15-122', location_text: 'GHC 4401', starts_at: iso(-3 * MIN, base), ends_at: iso(47 * MIN, base), opens_at: iso(-5 * MIN, base) },
      created_at: iso(-9 * MIN, base),
    },
    postEvent(base, { id: 'p3', user: MOCK_ME_ID, course: '76-101', location: 'BH 255B', offsetMin: -181, verified: true, streak: 10 }),
    postEvent(base, { id: 'p4', user: SAM, course: '15-122', location: 'GHC 4401', offsetMin: -24 * 60 - 40, late: true, minutesLate: 22, retakes: 3, streak: 8, caption: 'bus.' }),
    {
      id: 'm1',
      actor_id: SAM,
      occurrence_id: 'occ-sam-104-yday',
      type: 'miss',
      ref_id: 'miss-1',
      payload: { display_name: 'Sam Okafor', username: 'sam', avatar_url: null, course_code: '79-104', starts_at: iso(-25 * HOUR, base), streak_before: 8 },
      created_at: iso(-25 * HOUR + 70 * MIN, base),
    },
    // (the explanation is the author's first comment on the miss, see c3 below; no separate event)
    postEvent(base, { id: 'p5', user: PRIYA, course: '36-200', location: 'POS 152', offsetMin: -26 * 60, verified: true, streak: 10 }),
    postEvent(base, { id: 'p6', user: MOCK_ME_ID, course: '15-122', location: 'GHC 4401', offsetMin: -27 * 60, retakes: 2, streak: 9 }),
    postEvent(base, { id: 'p7', user: JORDAN, course: '21-127', location: 'WEH 5403', offsetMin: -30 * 60, streak: 10 }),
    {
      id: 'f1',
      actor_id: MOCK_ME_ID,
      occurrence_id: null,
      type: 'friends',
      ref_id: null,
      payload: { display_name: 'Alex Chen', friend_id: JORDAN, friend_name: 'Jordan Lee' },
      created_at: iso(-3 * 24 * HOUR, base),
    },
  ];

  const reactions: Reaction[] = [
    { id: 'r1', feed_event_id: 'p1', user_id: MOCK_ME_ID, emoji: '🔥' },
    { id: 'r2', feed_event_id: 'p1', user_id: JORDAN, emoji: '🔥' },
    { id: 'r3', feed_event_id: 'p1', user_id: SAM, emoji: '😂' },
    { id: 'r4', feed_event_id: 'p4', user_id: PRIYA, emoji: '💀' },
    { id: 'r5', feed_event_id: 'p4', user_id: MOCK_ME_ID, emoji: '💀' },
    { id: 'r6', feed_event_id: 'm1', user_id: PRIYA, emoji: '💀' },
    { id: 'r7', feed_event_id: 'p3', user_id: SAM, emoji: '🫡' },
  ];

  const comments: Comment[] = [
    { id: 'c1', feed_event_id: 'p1', user_id: SAM, username: 'sam', display_name: 'Sam Okafor', text: "where's the prof", created_at: iso(-30_000, base) },
    { id: 'c2', feed_event_id: 'p1', user_id: PRIYA, username: 'priya', display_name: 'Priya Natarajan', text: 'late again', created_at: iso(-10_000, base) },
    { id: 'c3', feed_event_id: 'm1', user_id: SAM, username: 'sam', display_name: 'Sam Okafor', text: 'slept in. no regrets. some regrets.', created_at: iso(-25 * HOUR + 95 * MIN, base) },
    { id: 'c4', feed_event_id: 'm1', user_id: JORDAN, username: 'jordan', display_name: 'Jordan Lee', text: 'the boba is on you', created_at: iso(-25 * HOUR + 100 * MIN, base) },
  ];

  return {
    server_time: new Date(base).toISOString(),
    today: localDate(base),
    me: {
      id: MOCK_ME_ID,
      username: 'alex',
      display_name: 'Alex Chen',
      avatar_url: null,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      streak: 10,
      best_streak: 14,
      posts_count: 61,
      class_count: 4,
      posted_today: true,
      has_class_today: true,
    },
    friends: [
      { id: PRIYA, username: 'priya', display_name: 'Priya Natarajan', avatar_url: null, streak: 11, best_streak: 11, posted_today: true },
      { id: JORDAN, username: 'jordan', display_name: 'Jordan Lee', avatar_url: null, streak: 11, best_streak: 12, posted_today: true },
      { id: SAM, username: 'sam', display_name: 'Sam Okafor', avatar_url: null, streak: 0, best_streak: 8, posted_today: false },
    ],
    requests: {
      incoming: [{ id: '00000000-0000-4000-8000-000000000005', username: 'maya', display_name: 'Maya Torres', avatar_url: null, created_at: iso(-2 * HOUR, base) }],
      outgoing: [],
    },
    today_occurrences: todayOcc,
    my_unexplained_misses: [{ id: 'miss-me-200', occurrence_id: 'occ-me-200', course_code: '36-200', starts_at: iso(-300 * MIN, base) }],
    feed,
    reactions,
    comments,
  };
}

/** Placeholder imagery for mock photo paths ("mock:<seed>"). */
export function mockPhotoUrl(path: string, w = 600, h = 800): string {
  const seed = encodeURIComponent(path.replace(/^mock:/, ''));
  return `https://picsum.photos/seed/${seed}/${w}/${h}`;
}
