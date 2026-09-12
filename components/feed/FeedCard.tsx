import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { Avatar, Badge, Button, ErrorText, Row, Stat, StreakChip, Txt } from '@/components/ui';
import { markForfeitPaid } from '@/lib/api/circle';
import { useCircleState } from '@/lib/circleState';
import { errorMessage } from '@/lib/supabase';
import { colors, motion, radius, size, space } from '@/lib/theme';
import { fmtTime, relative } from '@/lib/time';
import type { FeedEvent, Forfeit, Member, Reaction } from '@/lib/types';
import { Photo } from './Photo';
import { ReactionRow } from './ReactionRow';

interface Props {
  event: FeedEvent;
  me: string;
  members: Member[];
  forfeits: Forfeit[];
  reactions: Reaction[];
  nowMs?: number;
  /** The explanation posted for this skip, rendered as a quote under it. */
  explanation?: FeedEvent | null;
}

/**
 * One feed item. Edge-to-edge row, X anatomy: 40pt avatar, name bold and the
 * action regular on one line, timestamp right, content aligned to the text column.
 * No coloured cards: state lives in a badge, an icon or one word.
 */
export function FeedCard({ event, me, members, forfeits, reactions, nowMs = Date.now(), explanation }: Props) {
  const p = event.payload;
  const name = p.display_name ?? members.find((m) => m.id === event.actor_id)?.display_name ?? 'Someone';
  const avatarUrl = p.avatar_url ?? members.find((m) => m.id === event.actor_id)?.avatar_url ?? null;
  const when = relative(event.created_at, nowMs);

  switch (event.type) {
    case 'checkin':
      return <CheckinItem event={event} name={name} avatarUrl={avatarUrl} when={when} me={me} reactions={reactions} />;
    case 'skip':
      return <SkipItem event={event} name={name} avatarUrl={avatarUrl} when={when} me={me} reactions={reactions} explanation={explanation} nowMs={nowMs} />;
    case 'forfeit_owed':
      return <ForfeitOwedItem event={event} name={name} avatarUrl={avatarUrl} when={when} me={me} forfeits={forfeits} reactions={reactions} />;
    case 'explanation':
      return (
        <Item name={name} avatarUrl={avatarUrl} action="explained" when={when}>
          <Quote text={p.text ?? ''} eventId={event.id} me={me} reactions={reactions} />
        </Item>
      );
    case 'excused':
      return (
        <Item name={name} avatarUrl={avatarUrl} action={`is excused from ${p.course_code ?? 'class'}`} when={when} badge="info">
          <Row gap={space.sm} style={{ marginTop: space.sm }}>
            <Badge label="Excused" tone="info" />
            <Txt variant="footnote" tone="secondary">
              Sick or emergency. Streak stays.
            </Txt>
          </Row>
          <ReactionRow eventId={event.id} reactions={reactions} me={me} />
        </Item>
      );
    case 'forfeit_paid':
      return (
        <Item name={name} avatarUrl={avatarUrl} action="paid up" when={when} badge="success">
          <Row gap={space.sm} style={{ marginTop: space.sm }}>
            <Badge label="Paid" tone="success" icon="checkmark" />
            <Txt variant="footnote" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
              {[p.description, p.paid_by_name ? `confirmed by ${p.paid_by_name}` : null].filter(Boolean).join(' · ')}
            </Txt>
          </Row>
          <ReactionRow eventId={event.id} reactions={reactions} me={me} />
        </Item>
      );
    case 'member_joined':
      return (
        <View style={styles.system}>
          <Txt variant="footnote" tone="tertiary" align="center">
            <Txt variant="footnote" tone="secondary" weight="600">
              {name}
            </Txt>{' '}
            {p.created ? 'created the circle' : 'joined the circle'} · {when}
          </Txt>
        </View>
      );
    default:
      return (
        <Item name={name} avatarUrl={avatarUrl} action="" when={when}>
          {null}
        </Item>
      );
  }
}

// ---------------------------------------------------------------- shared shell

type BadgeTone = 'success' | 'danger' | 'warning' | 'info';

function AvatarStatus({ tone }: { tone: BadgeTone }) {
  const bg = { success: colors.success, danger: colors.danger, warning: colors.warning, info: colors.info }[tone];
  const icon = { success: 'checkmark', danger: 'close', warning: 'alert', info: 'medkit' }[tone] as React.ComponentProps<typeof Ionicons>['name'];
  return (
    <View style={styles.avatarStatus}>
      <View style={[styles.avatarStatusInner, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={10} color={colors.textInverse} />
      </View>
    </View>
  );
}

function Item({
  name,
  avatarUrl,
  action,
  when,
  badge,
  children,
}: {
  name: string;
  avatarUrl: string | null;
  action: React.ReactNode;
  when: string;
  badge?: BadgeTone;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.item}>
      <View style={styles.avatarWrap}>
        <Avatar name={name} uri={avatarUrl} size={size.avatarMd} />
        {badge ? <AvatarStatus tone={badge} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }} gap={space.sm}>
          <Txt variant="body" style={{ flex: 1 }}>
            <Txt variant="headline">{name}</Txt> {action}
          </Txt>
          <Txt variant="footnote" tone="tertiary" style={{ marginTop: 2 }}>
            {when}
          </Txt>
        </Row>
        {children}
      </View>
    </View>
  );
}

function Quote({ text, eventId, me, reactions, when }: { text: string; eventId: string; me: string; reactions: Reaction[]; when?: string }) {
  return (
    <View style={styles.quote}>
      <Txt variant="body">“{text}”</Txt>
      {when ? (
        <Txt variant="footnote" tone="tertiary" style={{ marginTop: 4 }}>
          {when}
        </Txt>
      ) : null}
      <ReactionRow eventId={eventId} reactions={reactions} me={me} />
    </View>
  );
}

// ---------------------------------------------------------------- check-in

function CheckinItem({ event, name, avatarUrl, when, me, reactions }: { event: FeedEvent; name: string; avatarUrl: string | null; when: string; me: string; reactions: Reaction[] }) {
  const p = event.payload;
  return (
    <Item name={name} avatarUrl={avatarUrl} action={`checked in to ${p.course_code ?? 'class'}`} when={when} badge="success">
      <View style={{ marginTop: space.md }}>
        <Photo path={p.photo_path} />
        {p.photo_back_path ? <Photo path={p.photo_back_path} style={styles.pip} radius={radius.sm} /> : null}
      </View>
      <Row gap={space.sm} style={{ marginTop: space.md }}>
        {typeof p.personal_streak_after === 'number' ? <StreakChip value={p.personal_streak_after} size="sm" /> : null}
        {typeof p.personal_streak_after === 'number' ? (
          <Txt variant="footnote" tone="secondary">
            day streak
          </Txt>
        ) : null}
        {p.in_geofence === false ? <Badge label="Outside building" tone="neutral" icon="location-outline" style={{ marginLeft: 'auto' }} /> : null}
      </Row>
      <ReactionRow eventId={event.id} reactions={reactions} me={me} />
    </Item>
  );
}

// ---------------------------------------------------------------- skip

function DyingNumber({ from }: { from: number }) {
  const anim = useRef(new Animated.Value(from)).current;
  const [val, setVal] = useState(from);
  useEffect(() => {
    const id = anim.addListener(({ value }) => setVal(Math.max(0, Math.round(value))));
    Animated.timing(anim, {
      toValue: 0,
      duration: motion.slow * 2,
      delay: motion.slow,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(id);
  }, [anim]);
  return (
    <Txt variant="stat" tone={val === 0 ? 'danger' : 'primary'} tabular>
      {String(val)}
    </Txt>
  );
}

function SkipItem({
  event,
  name,
  avatarUrl,
  when,
  me,
  reactions,
  explanation,
  nowMs,
}: {
  event: FeedEvent;
  name: string;
  avatarUrl: string | null;
  when: string;
  me: string;
  reactions: Reaction[];
  explanation?: FeedEvent | null;
  nowMs: number;
}) {
  const { state } = useCircleState();
  const router = useRouter();
  const p = event.payload;
  const unexplained = event.actor_id === me && !!event.ref_id && (state?.my_unexplained_skips ?? []).some((s) => s.id === event.ref_id);
  const before = p.circle_streak_before ?? 0;
  return (
    <Item
      name={name}
      avatarUrl={avatarUrl}
      action={
        <>
          <Txt variant="body" tone="danger" weight="600">
            skipped
          </Txt>{' '}
          {p.course_code ?? 'class'}
          {p.starts_at ? ` at ${fmtTime(p.starts_at)}` : ''}
        </>
      }
      when={when}
      badge="danger"
    >
      <Row gap={space.md} style={{ marginTop: space.md }}>
        <Stat size="md" value={before} label="Circle streak" tone="tertiary" />
        <Ionicons name="arrow-forward" size={size.iconMd} color={colors.textTertiary} style={{ marginBottom: 14 }} />
        <Stat size="md" value={<DyingNumber from={before} />} label="Now" tone="danger" />
        {typeof p.personal_streak_before === 'number' ? (
          <Txt variant="footnote" tone="tertiary" style={{ marginLeft: 'auto', alignSelf: 'flex-end', marginBottom: 14 }} tabular>
            own streak {p.personal_streak_before} to 0
          </Txt>
        ) : null}
      </Row>
      {unexplained ? (
        <Button
          title="Explain yourself"
          variant="secondary"
          size="sm"
          icon="chatbubble-outline"
          style={{ marginTop: space.md, alignSelf: 'flex-start' }}
          onPress={() => router.push(`/explain/${event.ref_id}` as never)}
        />
      ) : null}
      <ReactionRow eventId={event.id} reactions={reactions} me={me} />
      {explanation ? (
        <Quote text={explanation.payload.text ?? ''} eventId={explanation.id} me={me} reactions={reactions} when={relative(explanation.created_at, nowMs)} />
      ) : null}
    </Item>
  );
}

// ---------------------------------------------------------------- forfeit owed

function ForfeitOwedItem({
  event,
  name,
  avatarUrl,
  when,
  me,
  forfeits,
  reactions,
}: {
  event: FeedEvent;
  name: string;
  avatarUrl: string | null;
  when: string;
  me: string;
  forfeits: Forfeit[];
  reactions: Reaction[];
}) {
  const { refresh } = useCircleState();
  const router = useRouter();
  const p = event.payload;
  const forfeit = forfeits.find((f) => f.id === p.forfeit_id);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const status = forfeit?.status ?? 'owed';
  const owedByMe = forfeit ? forfeit.owed_by === me : event.actor_id === me;
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

  const open = () => p.forfeit_id && router.push(`/forfeit/${p.forfeit_id}` as never);

  return (
    <Item name={name} avatarUrl={avatarUrl} action={`owes the circle: ${description}`} when={when} badge="warning">
      <Row gap={space.sm} style={{ marginTop: space.sm, flexWrap: 'wrap' }}>
        {status === 'owed' ? (
          <>
            <Badge label="Owed" tone="warning" />
            {owedByMe ? (
              <Txt variant="footnote" tone="secondary" style={{ flex: 1 }}>
                Someone else in the circle clears this.
              </Txt>
            ) : (
              <Button title="Mark paid" variant="secondary" size="sm" icon="checkmark" loading={busy} onPress={pay} />
            )}
            <Pressable onPress={open} hitSlop={8} style={({ pressed }) => ({ marginLeft: 'auto', opacity: pressed ? 0.6 : 1 })}>
              <Ionicons name="chevron-forward" size={size.iconMd} color={colors.textTertiary} />
            </Pressable>
          </>
        ) : status === 'paid' ? (
          <>
            <Badge label="Paid" tone="success" icon="checkmark" />
            {forfeit?.paid_by_name ? (
              <Txt variant="footnote" tone="secondary">
                confirmed by {forfeit.paid_by_name}
              </Txt>
            ) : null}
          </>
        ) : (
          <>
            <Badge label="Voided" tone="neutral" />
            <Txt variant="footnote" tone="secondary">
              The skip was excused.
            </Txt>
          </>
        )}
      </Row>
      <ErrorText>{err}</ErrorText>
      <ReactionRow eventId={event.id} reactions={reactions} me={me} />
    </Item>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  system: { paddingVertical: space.md, paddingHorizontal: space.lg },
  avatarWrap: { width: size.avatarMd, height: size.avatarMd },
  avatarStatus: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarStatusInner: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  quote: {
    marginTop: space.md,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    padding: space.md,
  },
  pip: {
    position: 'absolute',
    top: space.sm,
    left: space.sm,
    width: '30%',
    borderWidth: 2,
    borderColor: colors.bg,
  },
});
