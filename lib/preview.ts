import { bundledSceneUri } from './scenePhotos';
import type { Building, Circle, CircleState, ClassInput, ClassRow, FeedEvent, Forfeit, Occurrence } from './types';
import { normalizeState } from './types';

export const PREVIEW = {
  me: 'user-jordan',
  sam: 'user-sam',
  riley: 'user-riley',
  alex: 'user-alex',
  circle: 'circle-hack-house',
  occ122Me: 'occ-122-jordan',
  occ251Me: 'occ-251-jordan',
  occ127Me: 'occ-127-jordan',
  skipMe: 'skip-jordan-yesterday',
  forfeitAlex: 'forfeit-alex',
  forfeitMe: 'forfeit-jordan',
  forfeitSamPaid: 'forfeit-sam-paid',
  forfeitVoid: 'forfeit-void',
  email: 'jordan@present.demo',
  password: 'present',
  samplePhoto: 'https://i.pravatar.cc/720?u=present-selfie',
  samplePhotoBack: 'scene/sample',
} as const;

function iso(ms = Date.now()) {
  return new Date(ms).toISOString();
}
function at(offsetMin: number) {
  return iso(Date.now() + offsetMin * 60_000);
}
function daysAgo(days: number, hour = 9, minute = 30) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}
function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
function avatar(who: string) {
  return `https://i.pravatar.cc/150?u=${who}-present`;
}

export const PREVIEW_BUILDINGS: Building[] = [
  { code: 'GHC', name: 'Gates Hillman', lat: 40.4433, lng: -79.9444, radius_m: 120 },
  { code: 'WEH', name: 'Wean Hall', lat: 40.4428, lng: -79.9458, radius_m: 100 },
  { code: 'DH', name: 'Doherty Hall', lat: 40.4424, lng: -79.9442, radius_m: 100 },
  { code: 'HH', name: 'Hamburg Hall', lat: 40.4441, lng: -79.9455, radius_m: 90 },
  { code: 'POS', name: 'Posner Hall', lat: 40.4416, lng: -79.9421, radius_m: 90 },
];

const NAMES: Record<string, string> = {
  [PREVIEW.me]: 'Jordan',
  [PREVIEW.sam]: 'Sam',
  [PREVIEW.riley]: 'Riley',
  [PREVIEW.alex]: 'Alex',
};

type Listener = () => void;
const listeners = new Set<Listener>();

let buildings = PREVIEW_BUILDINGS.map((b) => ({ ...b }));
let classes: ClassRow[] = [];
let signedIn = true;
let state: CircleState = buildSeed();

function emit() {
  for (const l of listeners) l();
}

function occ(
  id: string,
  userId: string,
  course: string,
  name: string,
  building: string,
  starts: string,
  ends: string,
  windowStart: string,
  windowEnd: string,
  skipDeadline: string,
  status: Occurrence['status'],
  isDemo = false,
): Occurrence {
  return {
    id,
    user_id: userId,
    display_name: NAMES[userId] ?? 'Someone',
    course_code: course,
    name,
    building_code: building,
    starts_at: starts,
    ends_at: ends,
    window_start: windowStart,
    window_end: windowEnd,
    skip_deadline: skipDeadline,
    status,
    is_demo: isDemo,
  };
}

function feed(
  id: string,
  actor: string,
  type: FeedEvent['type'],
  createdAt: string,
  payload: FeedEvent['payload'],
  extras: Partial<FeedEvent> = {},
): FeedEvent {
  return {
    id,
    circle_id: PREVIEW.circle,
    actor_id: actor,
    occurrence_id: extras.occurrence_id ?? null,
    type,
    ref_id: extras.ref_id ?? null,
    payload: { display_name: NAMES[actor], avatar_url: avatar(actor), ...payload },
    created_at: createdAt,
  };
}

function buildSeed(): CircleState {
  classes = [
    {
      id: 'class-122',
      user_id: PREVIEW.me,
      course_code: '15-122',
      name: 'Principles of Imperative Computation',
      building_code: 'GHC',
      days_of_week: [1, 3, 5],
      start_time: '09:30:00',
      end_time: '10:20:00',
    },
    {
      id: 'class-251',
      user_id: PREVIEW.me,
      course_code: '15-251',
      name: 'Great Ideas in Theoretical CS',
      building_code: 'WEH',
      days_of_week: [2, 4],
      start_time: '13:30:00',
      end_time: '14:50:00',
    },
    {
      id: 'class-127',
      user_id: PREVIEW.me,
      course_code: '21-127',
      name: 'Concepts of Mathematics',
      building_code: 'DH',
      days_of_week: [1, 3, 5],
      start_time: '08:00:00',
      end_time: '08:50:00',
    },
  ];

  const circle: Circle = {
    id: PREVIEW.circle,
    name: 'Hack House',
    forfeit_text: 'buys the circle boba',
    invite_code: 'HACK26',
    created_by: PREVIEW.me,
    created_at: daysAgo(20, 18, 0),
  };

  const start122 = at(0);
  const end122 = at(50);
  const winStart122 = at(-10);
  const winEnd122 = at(15);
  const skip122 = at(60);

  const forfeits: Forfeit[] = [
    {
      id: PREVIEW.forfeitAlex,
      circle_id: PREVIEW.circle,
      owed_by: PREVIEW.alex,
      owed_by_name: 'Alex',
      skip_id: 'skip-alex-today',
      description: 'buys the circle boba',
      status: 'owed',
      marked_paid_by: null,
      paid_by_name: null,
      paid_at: null,
      local_date: daysAgo(0),
      created_at: at(-20),
      course_code: '15-122',
      starts_at: start122,
      explanation: null,
    },
    {
      id: PREVIEW.forfeitMe,
      circle_id: PREVIEW.circle,
      owed_by: PREVIEW.me,
      owed_by_name: 'Jordan',
      skip_id: PREVIEW.skipMe,
      description: 'buys the circle boba',
      status: 'owed',
      marked_paid_by: null,
      paid_by_name: null,
      paid_at: null,
      local_date: daysAgo(1),
      created_at: daysAgo(1, 10, 40),
      course_code: '15-251',
      starts_at: daysAgo(1, 13, 30),
      explanation: null,
    },
    {
      id: PREVIEW.forfeitSamPaid,
      circle_id: PREVIEW.circle,
      owed_by: PREVIEW.sam,
      owed_by_name: 'Sam',
      skip_id: 'skip-sam-old',
      description: 'buys the circle boba',
      status: 'paid',
      marked_paid_by: PREVIEW.riley,
      paid_by_name: 'Riley',
      paid_at: daysAgo(8, 18, 0),
      local_date: daysAgo(9),
      created_at: daysAgo(9, 10, 40),
      course_code: '15-122',
      starts_at: daysAgo(9, 9, 30),
      explanation: 'overslept, my bad',
    },
    {
      id: PREVIEW.forfeitVoid,
      circle_id: PREVIEW.circle,
      owed_by: PREVIEW.riley,
      owed_by_name: 'Riley',
      skip_id: 'skip-riley-excused',
      description: 'does the dishes',
      status: 'voided',
      marked_paid_by: null,
      paid_by_name: null,
      paid_at: null,
      local_date: daysAgo(4),
      created_at: daysAgo(4, 11, 0),
      course_code: '21-127',
      starts_at: daysAgo(4, 8, 0),
      explanation: null,
    },
  ];

  return normalizeState({
    me: PREVIEW.me,
    server_time: iso(),
    my_class_count: 3,
    circle,
    members: [
      { id: PREVIEW.me, display_name: 'Jordan', avatar_url: avatar('jordan'), personal_streak: 11 },
      { id: PREVIEW.sam, display_name: 'Sam', avatar_url: avatar('sam'), personal_streak: 8 },
      { id: PREVIEW.riley, display_name: 'Riley', avatar_url: avatar('riley'), personal_streak: 10 },
      { id: PREVIEW.alex, display_name: 'Alex', avatar_url: avatar('alex'), personal_streak: 0 },
    ],
    circle_streak: 8,
    personal_streak: 11,
    today: [
      occ(PREVIEW.occ127Me, PREVIEW.me, '21-127', 'Concepts of Mathematics', 'DH', at(-180), at(-130), at(-190), at(-165), at(-120), 'checked_in'),
      occ(PREVIEW.occ122Me, PREVIEW.me, '15-122', 'Principles of Imperative Computation', 'GHC', start122, end122, winStart122, winEnd122, skip122, 'pending'),
      occ('occ-122-sam', PREVIEW.sam, '15-122', 'Principles of Imperative Computation', 'GHC', start122, end122, winStart122, winEnd122, skip122, 'checked_in'),
      occ('occ-122-riley', PREVIEW.riley, '15-122', 'Principles of Imperative Computation', 'GHC', start122, end122, winStart122, winEnd122, skip122, 'checked_in'),
      occ('occ-122-alex', PREVIEW.alex, '15-122', 'Principles of Imperative Computation', 'GHC', start122, end122, winStart122, winEnd122, skip122, 'pending'),
      occ(PREVIEW.occ251Me, PREVIEW.me, '15-251', 'Great Ideas in Theoretical CS', 'WEH', at(180), at(230), at(170), at(195), at(240), 'pending'),
    ],
    forfeits,
    my_unexplained_skips: [
      {
        id: PREVIEW.skipMe,
        occurrence_id: 'occ-251-yesterday',
        course_code: '15-251',
        starts_at: daysAgo(1, 13, 30),
        created_at: daysAgo(1, 15, 10),
      },
    ],
    feed: [
      feed('fe-alex-forfeit', PREVIEW.alex, 'forfeit_owed', at(-18), {
        course_code: '15-122',
        description: 'buys the circle boba',
        forfeit_id: PREVIEW.forfeitAlex,
      }),
      feed(
        'fe-alex-skip',
        PREVIEW.alex,
        'skip',
        at(-20),
        {
          course_code: '15-122',
          starts_at: start122,
          personal_streak_before: 10,
          circle_streak_before: 8,
        },
        { ref_id: 'skip-alex-today', occurrence_id: 'occ-122-alex' },
      ),
      feed(
        'fe-riley-122',
        PREVIEW.riley,
        'checkin',
        at(-8),
        { course_code: '15-122', photo_path: 'photo/riley-122', photo_back_path: 'scene/riley-122', personal_streak_after: 10, in_geofence: true },
        { occurrence_id: 'occ-122-riley' },
      ),
      feed(
        'fe-sam-122',
        PREVIEW.sam,
        'checkin',
        at(-12),
        { course_code: '15-122', photo_path: 'photo/sam-122', photo_back_path: 'scene/sam-122', personal_streak_after: 8, in_geofence: true },
        { occurrence_id: 'occ-122-sam' },
      ),
      feed(
        'fe-jordan-127',
        PREVIEW.me,
        'checkin',
        at(-175),
        { course_code: '21-127', photo_path: 'photo/jordan-127', photo_back_path: 'scene/jordan-127', personal_streak_after: 11, in_geofence: true },
        { occurrence_id: PREVIEW.occ127Me },
      ),
      feed(
        'fe-jordan-skip',
        PREVIEW.me,
        'skip',
        daysAgo(1, 15, 10),
        {
          course_code: '15-251',
          starts_at: daysAgo(1, 13, 30),
          personal_streak_before: 10,
          circle_streak_before: 9,
        },
        { ref_id: PREVIEW.skipMe, occurrence_id: 'occ-251-yesterday' },
      ),
      feed('fe-jordan-forfeit', PREVIEW.me, 'forfeit_owed', daysAgo(1, 15, 11), {
        course_code: '15-251',
        description: 'buys the circle boba',
        forfeit_id: PREVIEW.forfeitMe,
      }),
      feed('fe-riley-excused', PREVIEW.riley, 'excused', daysAgo(4, 8, 40), {
        course_code: '21-127',
        pre_emptive: true,
      }),
      feed('fe-sam-paid', PREVIEW.sam, 'forfeit_paid', daysAgo(8, 18, 0), {
        description: 'buys the circle boba',
        paid_by_name: 'Riley',
        paid_by: PREVIEW.riley,
        forfeit_id: PREVIEW.forfeitSamPaid,
      }),
      feed(
        'fe-sam-explain',
        PREVIEW.sam,
        'explanation',
        daysAgo(9, 11, 0),
        { text: 'overslept, my bad', course_code: '15-122' },
        { ref_id: 'skip-sam-old' },
      ),
      feed(
        'fe-sam-skip',
        PREVIEW.sam,
        'skip',
        daysAgo(9, 10, 40),
        {
          course_code: '15-122',
          starts_at: daysAgo(9, 9, 30),
          personal_streak_before: 1,
          circle_streak_before: 1,
        },
        { ref_id: 'skip-sam-old' },
      ),
      feed(
        'fe-jordan-old',
        PREVIEW.me,
        'checkin',
        daysAgo(2, 9, 32),
        { course_code: '15-122', photo_path: 'photo/jordan-old', photo_back_path: 'scene/jordan-old', personal_streak_after: 10, in_geofence: true },
      ),
      feed('fe-alex-join', PREVIEW.alex, 'member_joined', daysAgo(18, 20, 0), { created: false }),
      feed('fe-jordan-create', PREVIEW.me, 'member_joined', daysAgo(20, 18, 0), { created: true }),
    ],
    reactions: [
      { feed_event_id: 'fe-riley-122', user_id: PREVIEW.me, emoji: '🔥' },
      { feed_event_id: 'fe-riley-122', user_id: PREVIEW.sam, emoji: '🔥' },
      { feed_event_id: 'fe-sam-122', user_id: PREVIEW.me, emoji: '🫡' },
      { feed_event_id: 'fe-alex-skip', user_id: PREVIEW.sam, emoji: '💀' },
      { feed_event_id: 'fe-alex-skip', user_id: PREVIEW.riley, emoji: '💀' },
      { feed_event_id: 'fe-sam-paid', user_id: PREVIEW.me, emoji: '🧋' },
      { feed_event_id: 'fe-sam-paid', user_id: PREVIEW.riley, emoji: '🧋' },
      { feed_event_id: 'fe-sam-paid', user_id: PREVIEW.alex, emoji: '🧋' },
    ],
  });
}

export function subscribePreview(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function isPreviewSignedIn() {
  return signedIn;
}

export function previewSignIn() {
  signedIn = true;
  emit();
}

export function previewSignOut() {
  signedIn = false;
  emit();
}

export function previewProfile() {
  return {
    id: PREVIEW.me,
    display_name: 'Jordan',
    avatar_url: avatar('jordan'),
    created_at: daysAgo(20),
  };
}

export function getPreviewState(): CircleState {
  return { ...state, server_time: iso() };
}

export function previewReset() {
  buildings = PREVIEW_BUILDINGS.map((b) => ({ ...b }));
  state = buildSeed();
  emit();
  return 1;
}

export function listPreviewBuildings(): Building[] {
  return buildings.filter((b) => b.code !== 'DEMO');
}

export function getPreviewBuilding(code: string): Building | null {
  return buildings.find((b) => b.code === code) ?? null;
}

export function listPreviewClasses(): ClassRow[] {
  return [...classes].sort((a, b) => a.start_time.localeCompare(b.start_time));
}

export function savePreviewClass(userId: string, input: ClassInput): ClassRow {
  const row: ClassRow = {
    id: input.id ?? uid('class'),
    user_id: userId,
    course_code: input.course_code.trim(),
    name: input.name?.trim() || null,
    building_code: input.building_code,
    days_of_week: [...input.days_of_week].sort((a, b) => a - b),
    start_time: input.start_time,
    end_time: input.end_time,
  };
  const i = classes.findIndex((c) => c.id === row.id);
  if (i >= 0) classes[i] = row;
  else classes.push(row);
  state = { ...state, my_class_count: classes.length, server_time: iso() };
  emit();
  return row;
}

export function deletePreviewClass(id: string) {
  classes = classes.filter((c) => c.id !== id);
  state = { ...state, my_class_count: classes.length, server_time: iso() };
  emit();
}

export function previewCreateCircle(name: string, forfeitText: string): Circle {
  const circle: Circle = {
    id: uid('circle'),
    name: name.trim(),
    forfeit_text: forfeitText.trim(),
    invite_code: 'NEWCIR',
    created_by: PREVIEW.me,
    created_at: iso(),
  };
  state = {
    ...state,
    circle,
    members: [{ id: PREVIEW.me, display_name: 'Jordan', avatar_url: avatar('jordan'), personal_streak: 0 }],
    circle_streak: 0,
    today: state.today.filter((o) => o.user_id === PREVIEW.me),
    forfeits: [],
    feed: [
      feed(uid('fe'), PREVIEW.me, 'member_joined', iso(), { created: true, display_name: 'Jordan' }),
    ],
    reactions: [],
    server_time: iso(),
  };
  emit();
  return circle;
}

export function previewJoinCircle(code: string): Circle {
  if (code.trim().toUpperCase() === 'HACK26' || code.trim().length === 6) {
    state = buildSeed();
    emit();
    return state.circle!;
  }
  throw new Error('No circle with that code.');
}

export function previewMarkForfeitPaid(forfeitId: string) {
  const forfeit = state.forfeits.find((f) => f.id === forfeitId);
  if (!forfeit) throw new Error('Forfeit not found');
  if (forfeit.status !== 'owed') throw new Error('That forfeit is already cleared');
  if (forfeit.owed_by === state.me) throw new Error('Someone else in the circle has to mark this paid.');
  const paidAt = iso();
  state = {
    ...state,
    forfeits: state.forfeits.map((f) =>
      f.id === forfeitId
        ? { ...f, status: 'paid', marked_paid_by: state.me, paid_by_name: 'Jordan', paid_at: paidAt }
        : f,
    ),
    feed: [
      feed(uid('fe'), forfeit.owed_by, 'forfeit_paid', paidAt, {
        description: forfeit.description,
        paid_by_name: 'Jordan',
        paid_by: state.me,
        forfeit_id: forfeitId,
      }),
      ...state.feed,
    ],
    server_time: paidAt,
  };
  emit();
}

export function previewExplainSkip(skipId: string, text: string) {
  const skip = state.my_unexplained_skips.find((s) => s.id === skipId);
  if (!skip) throw new Error('Nothing to explain');
  const now = iso();
  state = {
    ...state,
    my_unexplained_skips: state.my_unexplained_skips.filter((s) => s.id !== skipId),
    forfeits: state.forfeits.map((f) => (f.skip_id === skipId ? { ...f, explanation: text.trim() } : f)),
    feed: [
      feed(uid('fe'), state.me, 'explanation', now, { text: text.trim(), course_code: skip.course_code }, { ref_id: skipId }),
      ...state.feed,
    ],
    server_time: now,
  };
  emit();
}

export function previewExcuseSkip(skipId: string) {
  const skip = state.my_unexplained_skips.find((s) => s.id === skipId);
  if (!skip) throw new Error('Nothing to excuse');
  const now = iso();
  state = {
    ...state,
    my_unexplained_skips: state.my_unexplained_skips.filter((s) => s.id !== skipId),
    personal_streak: Math.max(state.personal_streak, 1),
    circle_streak: Math.max(state.circle_streak, 1),
    members: state.members.map((m) => (m.id === state.me ? { ...m, personal_streak: Math.max(m.personal_streak, 1) } : m)),
    today: state.today.map((o) => (o.id === skip.occurrence_id ? { ...o, status: 'excused' } : o)),
    forfeits: state.forfeits.map((f) => (f.skip_id === skipId ? { ...f, status: 'voided' } : f)),
    feed: [
      feed(uid('fe'), state.me, 'excused', now, { course_code: skip.course_code, pre_emptive: false }, { ref_id: skipId }),
      ...state.feed,
    ],
    server_time: now,
  };
  emit();
}

export function previewExcuseOccurrence(occurrenceId: string) {
  const o = state.today.find((x) => x.id === occurrenceId && x.user_id === state.me);
  if (!o) throw new Error('Class not found');
  if (o.status !== 'pending') throw new Error('Already resolved');
  const now = iso();
  state = {
    ...state,
    today: state.today.map((x) => (x.id === occurrenceId ? { ...x, status: 'excused' } : x)),
    feed: [feed(uid('fe'), state.me, 'excused', now, { course_code: o.course_code, pre_emptive: true }, { occurrence_id: o.id }), ...state.feed],
    server_time: now,
  };
  emit();
}

export function previewToggleReaction(eventId: string, emoji: string): boolean {
  const mine = state.reactions.find((r) => r.feed_event_id === eventId && r.user_id === state.me && r.emoji === emoji);
  if (mine) {
    state = {
      ...state,
      reactions: state.reactions.filter((r) => r !== mine),
      server_time: iso(),
    };
    emit();
    return false;
  }
  state = {
    ...state,
    reactions: [...state.reactions, { feed_event_id: eventId, user_id: state.me, emoji }],
    server_time: iso(),
  };
  emit();
  return true;
}

export function previewSubmitCheckin(args: {
  occurrenceId: string;
  userId: string;
  frontUri: string;
  backUri?: string | null;
  inGeofence: boolean;
}) {
  const o = state.today.find((x) => x.id === args.occurrenceId);
  if (!o) throw new Error('Class not found');
  if (o.status !== 'pending') throw new Error('Already checked in');
  const now = iso();
  const streak = (state.members.find((m) => m.id === args.userId)?.personal_streak ?? 0) + 1;
  state = {
    ...state,
    personal_streak: args.userId === state.me ? streak : state.personal_streak,
    members: state.members.map((m) => (m.id === args.userId ? { ...m, personal_streak: streak } : m)),
    today: state.today.map((x) => (x.id === args.occurrenceId ? { ...x, status: 'checked_in' } : x)),
    feed: [
      feed(
        uid('fe'),
        args.userId,
        'checkin',
        now,
        {
          course_code: o.course_code,
          photo_path: args.frontUri,
          photo_back_path: args.backUri ?? null,
          personal_streak_after: streak,
          in_geofence: args.inGeofence,
        },
        { occurrence_id: o.id },
      ),
      ...state.feed,
    ],
    server_time: now,
  };
  emit();
}

export function previewStartClassNow(course: string, windowMin = 3, skipAfterMin = 3) {
  const code = course.trim() || '15-122';
  const now = iso();
  const next = state.members.map((m) =>
    occ(uid('occ'), m.id, code, code, 'GHC', now, at(windowMin + 40), now, at(windowMin), at(windowMin + skipAfterMin), 'pending', true),
  );
  state = {
    ...state,
    today: [...next, ...state.today.filter((o) => !(o.course_code === code && o.is_demo))],
    server_time: now,
  };
  emit();
  return next.length;
}

export function previewEndWindowNow() {
  const now = iso();
  const pending = state.today.filter((o) => o.status === 'pending' && o.is_demo);
  let events: FeedEvent[] = [];
  let forfeits = [...state.forfeits];
  let unexplained = [...state.my_unexplained_skips];
  const today = state.today.map((o) => {
    if (o.status !== 'pending' || !o.is_demo) return { ...o, window_end: now, skip_deadline: now };
    const skipId = uid('skip');
    const forfeitId = uid('forfeit');
    events.push(
      feed(
        uid('fe'),
        o.user_id,
        'skip',
        now,
        {
          course_code: o.course_code,
          starts_at: o.starts_at,
          personal_streak_before: state.members.find((m) => m.id === o.user_id)?.personal_streak ?? 0,
          circle_streak_before: state.circle_streak,
        },
        { ref_id: skipId, occurrence_id: o.id },
      ),
    );
    events.push(
      feed(uid('fe'), o.user_id, 'forfeit_owed', now, {
        course_code: o.course_code,
        description: state.circle?.forfeit_text ?? 'buys the circle boba',
        forfeit_id: forfeitId,
      }),
    );
    forfeits.unshift({
      id: forfeitId,
      circle_id: state.circle?.id ?? PREVIEW.circle,
      owed_by: o.user_id,
      owed_by_name: o.display_name,
      skip_id: skipId,
      description: state.circle?.forfeit_text ?? 'buys the circle boba',
      status: 'owed',
      marked_paid_by: null,
      paid_by_name: null,
      paid_at: null,
      local_date: now,
      created_at: now,
      course_code: o.course_code,
      starts_at: o.starts_at,
      explanation: null,
    });
    if (o.user_id === state.me) {
      unexplained.unshift({
        id: skipId,
        occurrence_id: o.id,
        course_code: o.course_code,
        starts_at: o.starts_at,
        created_at: now,
      });
    }
    return { ...o, status: 'skipped' as const, window_end: now, skip_deadline: now };
  });
  state = {
    ...state,
    today,
    forfeits,
    my_unexplained_skips: unexplained,
    circle_streak: 0,
    personal_streak: pending.some((o) => o.user_id === state.me) ? 0 : state.personal_streak,
    members: state.members.map((m) => (pending.some((o) => o.user_id === m.id) ? { ...m, personal_streak: 0 } : m)),
    feed: [...events, ...state.feed],
    server_time: now,
  };
  emit();
  return pending.length;
}

export function previewSetDemoBuilding(lat: number, lng: number) {
  const demo: Building = { code: 'DEMO', name: 'Judging room', lat, lng, radius_m: 300 };
  buildings = [...buildings.filter((b) => b.code !== 'DEMO'), demo];
  emit();
}

export function previewReplayCheckin(userId: string) {
  const o = state.today.find((x) => x.user_id === userId && x.status === 'pending');
  if (!o) throw new Error('No pending class for that person');
  previewSubmitCheckin({
    occurrenceId: o.id,
    userId,
    frontUri: `photo/replay-${userId}`,
    inGeofence: true,
  });
}

export function previewReplayExplanation(text: string) {
  const skip =
    state.my_unexplained_skips[0] ??
    ({
      id: 'skip-alex-today',
      occurrence_id: 'occ-122-alex',
      course_code: '15-122',
      starts_at: at(0),
      created_at: iso(),
    } as const);
  const now = iso();
  state = {
    ...state,
    my_unexplained_skips: state.my_unexplained_skips.filter((s) => s.id !== skip.id),
    feed: [
      feed(uid('fe'), skip.id === PREVIEW.skipMe ? state.me : PREVIEW.alex, 'explanation', now, {
        text,
        course_code: skip.course_code,
      }),
      ...state.feed,
    ],
    server_time: now,
  };
  emit();
}

export function previewReplayPayForfeit() {
  const f = state.forfeits.find((x) => x.status === 'owed' && x.owed_by !== state.me) ?? state.forfeits.find((x) => x.status === 'owed');
  if (!f) throw new Error('No open forfeit');
  if (f.owed_by === state.me) {
    // Pay as if Riley confirmed, so the presenter can still see the paid card.
    const paidAt = iso();
    state = {
      ...state,
      forfeits: state.forfeits.map((x) =>
        x.id === f.id ? { ...x, status: 'paid', marked_paid_by: PREVIEW.riley, paid_by_name: 'Riley', paid_at: paidAt } : x,
      ),
      feed: [
        feed(uid('fe'), f.owed_by, 'forfeit_paid', paidAt, {
          description: f.description,
          paid_by_name: 'Riley',
          paid_by: PREVIEW.riley,
          forfeit_id: f.id,
        }),
        ...state.feed,
      ],
      server_time: paidAt,
    };
    emit();
    return;
  }
  previewMarkForfeitPaid(f.id);
}

export function previewPhotoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http') || path.startsWith('file:') || path.startsWith('data:')) return path;
  const scene = bundledSceneUri(path);
  if (scene) return scene;
  return `https://i.pravatar.cc/720?u=${encodeURIComponent(path)}`;
}
