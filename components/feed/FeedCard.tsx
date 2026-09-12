import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { ErrorText } from '@/components/ui';
import { markForfeitPaid, toggleReaction } from '@/lib/api/circle';
import { useCircleState } from '@/lib/circleState';
import { errorMessage } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';
import { fmtTime } from '@/lib/time';
import type { FeedEvent, Forfeit, Member, Reaction } from '@/lib/types';
import { BeRealMedia } from './BeRealMedia';
import { IgPost, likedByLine } from './IgPost';

interface Props {
  event: FeedEvent;
  me: string;
  members: Member[];
  forfeits: Forfeit[];
  reactions: Reaction[];
  nowMs?: number;
}

function useHeart(eventId: string, reactions: Reaction[], me: string, members: Member[]) {
  const { refresh } = useCircleState();
  const [override, setOverride] = useState<boolean | null>(null);
  const forEvent = reactions.filter((r) => r.feed_event_id === eventId);
  const serverMine = forEvent.some((r) => r.user_id === me && r.emoji === '🔥');
  const liked = override ?? serverMine;
  const others = [...new Set(forEvent.filter((r) => r.user_id !== me && r.emoji === '🔥').map((r) => r.user_id))]
    .map((id) => members.find((m) => m.id === id)?.display_name)
    .filter((n): n is string => !!n);

  const setLiked = async (next: boolean) => {
    if (liked === next) return;
    setOverride(next);
    try {
      await toggleReaction(eventId, '🔥');
      await refresh();
    } catch {
      setOverride(null);
      return;
    }
    setOverride(null);
  };

  return {
    liked,
    likedBy: likedByLine(others, liked),
    onLike: () => setLiked(!liked),
    onDoubleLike: () => setLiked(true),
  };
}

export function FeedCard({ event, me, members, forfeits, reactions, nowMs = Date.now() }: Props) {
  const p = event.payload;
  const member = members.find((m) => m.id === event.actor_id);
  const name = p.display_name ?? member?.display_name ?? 'Someone';
  const avatarUri = member?.avatar_url ?? p.avatar_url;
  const heart = useHeart(event.id, reactions, me, members);

  const common = {
    name,
    avatarUri,
    createdAt: event.created_at,
    nowMs,
    liked: heart.liked,
    likedBy: heart.likedBy,
    eventId: event.id,
    reactions,
    me,
    onLike: heart.onLike,
  };

  switch (event.type) {
    case 'checkin':
      return (
        <IgPost
          {...common}
          location={p.course_code ?? 'class'}
          caption={
            <>
              {p.course_code ?? 'class'}
              {typeof p.personal_streak_after === 'number' ? `  🔥 ${p.personal_streak_after}` : ''}
              {p.in_geofence === false ? '  outside the building' : ''}
            </>
          }
        >
          <BeRealMedia face={p.photo_path} room={p.photo_back_path} onDoubleLike={heart.onDoubleLike} />
        </IgPost>
      );
    case 'skip':
      return <SkipPost event={event} {...common} />;
    case 'forfeit_owed':
      return <ForfeitPost event={event} forfeits={forfeits} {...common} />;
    case 'explanation':
      return (
        <IgPost {...common} location={p.course_code ?? undefined} caption={`"${p.text ?? ''}"`} />
      );
    case 'excused':
      return (
        <IgPost
          {...common}
          location={p.course_code ?? undefined}
          caption={`excused from ${p.course_code ?? 'class'} (sick / emergency)`}
        />
      );
    case 'forfeit_paid':
      return (
        <IgPost
          {...common}
          caption={
            <>
              paid up{p.description ? ` · ${p.description}` : ''}
              {p.paid_by_name ? ` · confirmed by ${p.paid_by_name}` : ''}
            </>
          }
        />
      );
    case 'member_joined':
      return (
        <IgPost {...common} caption={p.created ? 'created the circle' : 'joined the circle'} />
      );
    default:
      return <IgPost {...common} caption={name} />;
  }
}

function SkipPost({
  event,
  ...common
}: {
  event: FeedEvent;
  name: string;
  me: string;
  avatarUri?: string | null;
  createdAt: string;
  nowMs: number;
  liked: boolean;
  likedBy: string | null;
  eventId: string;
  reactions: Reaction[];
  onLike: () => void;
}) {
  const { state } = useCircleState();
  const router = useRouter();
  const p = event.payload;
  const unexplained = event.actor_id === common.me && !!event.ref_id && (state?.my_unexplained_skips ?? []).some((s) => s.id === event.ref_id);
  const before = p.circle_streak_before ?? 0;
  return (
    <IgPost
      {...common}
      location={p.course_code ?? 'class'}
      caption={
        <>
          didn't check in
          {p.starts_at ? ` · ${fmtTime(p.starts_at)}` : ''}
          {typeof p.personal_streak_before === 'number' ? ` · streak ${p.personal_streak_before} → 0` : ''}
        </>
      }
      extra={
        unexplained ? (
          <Pressable onPress={() => router.push(`/explain/${event.ref_id}` as never)} style={styles.linkWrap}>
            <Text style={styles.dangerLink}>Explain yourself</Text>
          </Pressable>
        ) : null
      }
    >
      <View style={styles.missed}>
        <Text style={styles.missedName}>{common.name}</Text>
        <Text style={styles.missedLine}>didn't check in</Text>
        <View style={styles.streakRow}>
          <Text style={styles.streakLine}>🔥 {before}</Text>
          <Text style={styles.streakLine}>→</Text>
          <DyingNumber from={before} />
        </View>
      </View>
    </IgPost>
  );
}

function ForfeitPost({
  event,
  forfeits,
  ...common
}: {
  event: FeedEvent;
  forfeits: Forfeit[];
  name: string;
  me: string;
  avatarUri?: string | null;
  createdAt: string;
  nowMs: number;
  liked: boolean;
  likedBy: string | null;
  eventId: string;
  reactions: Reaction[];
  onLike: () => void;
}) {
  const { refresh } = useCircleState();
  const router = useRouter();
  const p = event.payload;
  const forfeit = forfeits.find((f) => f.id === p.forfeit_id);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const status = forfeit?.status ?? 'owed';
  const owedByMe = forfeit ? forfeit.owed_by === common.me : event.actor_id === common.me;
  const description = forfeit?.description ?? p.description ?? '';

  const pay = async () => {
    if (!forfeit) return;
    setBusy(true);
    setErr(null);
    try {
      await markForfeitPaid(forfeit.id);
      await refresh();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <IgPost
      {...common}
      caption={
        status === 'paid' ? (
          <>
            {description} <Text style={{ color: colors.green, fontFamily: fonts.bold }}>Paid</Text>
          </>
        ) : status === 'voided' ? (
          `${description} was voided (excused)`
        ) : (
          <>
            owes <Text style={{ color: colors.amber, fontFamily: fonts.bold }}>{description}</Text>
          </>
        )
      }
      extra={
        <>
          {status === 'owed' && !owedByMe ? (
            <Pressable onPress={pay} disabled={busy} style={styles.linkWrap}>
              <Text style={styles.blueLink}>{busy ? 'Marking…' : 'Mark paid'}</Text>
            </Pressable>
          ) : null}
          {status === 'owed' && owedByMe ? (
            <Text style={styles.hint}>Someone else in the circle clears this.</Text>
          ) : null}
          <ErrorText>{err}</ErrorText>
          {p.forfeit_id ? (
            <Pressable onPress={() => router.push(`/forfeit/${p.forfeit_id}` as never)} style={styles.linkWrap}>
              <Text style={styles.mutedLink}>View forfeit</Text>
            </Pressable>
          ) : null}
        </>
      }
    />
  );
}

function DyingNumber({ from }: { from: number }) {
  const anim = useRef(new Animated.Value(from)).current;
  const [val, setVal] = useState(from);
  useEffect(() => {
    const id = anim.addListener(({ value }) => setVal(Math.max(0, Math.round(value))));
    Animated.timing(anim, {
      toValue: 0,
      duration: 800,
      delay: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(id);
  }, [anim]);
  return (
    <Text style={[styles.dying, val === 0 && { color: colors.red }]}>
      {val}
      {val === 0 ? ' 💀' : ''}
    </Text>
  );
}

const styles = StyleSheet.create({
  missed: {
    aspectRatio: 4 / 5,
    width: '100%',
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  missedName: { color: colors.white, fontSize: 22, fontFamily: fonts.bold },
  missedLine: { color: 'rgba(255,255,255,0.85)', fontSize: 16, fontFamily: fonts.regular, marginTop: 6 },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20 },
  streakLine: { color: colors.white, fontSize: 22, fontFamily: fonts.black },
  dying: { color: colors.white, fontSize: 22, fontFamily: fonts.black },
  linkWrap: { paddingHorizontal: 12, paddingTop: 8 },
  blueLink: { color: colors.igBlue, fontSize: 14, fontFamily: fonts.bold },
  dangerLink: { color: colors.like, fontSize: 14, fontFamily: fonts.bold },
  mutedLink: { color: colors.igMuted, fontSize: 13, fontFamily: fonts.bold },
  hint: { color: colors.igMuted, fontSize: 13, fontFamily: fonts.regular, paddingHorizontal: 12, paddingTop: 6 },
});
