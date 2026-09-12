import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, Button, Card, ErrorText, Muted, P, Row } from '@/components/ui';
import { markForfeitPaid } from '@/lib/api/circle';
import { useCircleState } from '@/lib/circleState';
import { errorMessage } from '@/lib/supabase';
import { colors, radius, space } from '@/lib/theme';
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
}

export function FeedCard({ event, me, members, forfeits, reactions, nowMs = Date.now() }: Props) {
  const p = event.payload;
  const name = p.display_name ?? members.find((m) => m.id === event.actor_id)?.display_name ?? 'Someone';
  const when = relative(event.created_at, nowMs);

  let body: React.ReactNode;
  switch (event.type) {
    case 'checkin':
      body = <CheckinBody event={event} name={name} when={when} />;
      break;
    case 'skip':
      body = <SkipBody event={event} name={name} when={when} me={me} />;
      break;
    case 'forfeit_owed':
      body = <ForfeitOwedBody event={event} name={name} when={when} me={me} forfeits={forfeits} />;
      break;
    case 'explanation':
      body = (
        <Card style={styles.quoteCard}>
          <Muted style={styles.meta}>{when}</Muted>
          <P style={styles.quote}>
            <Text style={styles.name}>{name}: </Text>“{p.text ?? ''}”
          </P>
          <ReactionRow eventId={event.id} reactions={reactions} me={me} />
        </Card>
      );
      break;
    case 'excused':
      body = (
        <Card tone={colors.blue} style={styles.mutedCard}>
          <Muted style={styles.meta}>{when}</Muted>
          <P>
            <Text style={styles.name}>{name}</Text> is excused from {p.course_code ?? 'class'}{' '}
            <Text style={{ color: colors.muted }}>(sick / emergency)</Text>
          </P>
          <ReactionRow eventId={event.id} reactions={reactions} me={me} />
        </Card>
      );
      break;
    case 'forfeit_paid':
      body = (
        <Card tone={colors.green}>
          <Muted style={styles.meta}>{when}</Muted>
          <P>
            <Text style={styles.name}>{name}</Text> paid up{' '}
            <Text style={{ color: colors.green, fontWeight: '800' }}>✓</Text>
            {p.paid_by_name ? <Text style={{ color: colors.muted }}> · confirmed by {p.paid_by_name}</Text> : null}
          </P>
          {p.description ? <Muted style={{ marginTop: 4 }}>{p.description}</Muted> : null}
          <ReactionRow eventId={event.id} reactions={reactions} me={me} />
        </Card>
      );
      break;
    case 'member_joined':
      body = (
        <View style={styles.oneLiner}>
          <Muted>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{name}</Text> {p.created ? 'created the circle' : 'joined the circle'} · {when}
          </Muted>
        </View>
      );
      break;
    default:
      body = (
        <Card>
          <Muted>{when}</Muted>
          <P>{name}</P>
        </Card>
      );
  }
  return <>{body}</>;
}

// ---------------------------------------------------------------- check-in

function CheckinBody({ event, name, when }: { event: FeedEvent; name: string; when: string }) {
  const { state } = useCircleState();
  const p = event.payload;
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={10}>
          <Avatar name={name} uri={p.avatar_url} size={34} />
          <View>
            <P>
              <Text style={styles.name}>{name}</Text> checked in to {p.course_code ?? 'class'}
            </P>
            <Muted style={styles.meta}>{when}</Muted>
          </View>
        </Row>
      </Row>
      <View style={{ marginTop: space.md }}>
        <Photo path={p.photo_path} />
        {p.photo_back_path ? <Photo path={p.photo_back_path} style={styles.backInset} /> : null}
      </View>
      <Row style={{ marginTop: space.md }} gap={8}>
        {typeof p.personal_streak_after === 'number' ? (
          <View style={styles.chip}>
            <Text style={styles.chipText}>🔥 {p.personal_streak_after}</Text>
          </View>
        ) : null}
        {p.in_geofence === false ? (
          <View style={[styles.chip, { borderColor: colors.faint }]}>
            <Text style={[styles.chipText, { color: colors.muted }]}>outside geofence</Text>
          </View>
        ) : null}
      </Row>
      <ReactionRow eventId={event.id} reactions={state?.reactions ?? []} me={state?.me ?? ''} />
    </Card>
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

function SkipBody({ event, name, when, me }: { event: FeedEvent; name: string; when: string; me: string }) {
  const { state } = useCircleState();
  const router = useRouter();
  const p = event.payload;
  const unexplained = event.actor_id === me && !!event.ref_id && (state?.my_unexplained_skips ?? []).some((s) => s.id === event.ref_id);
  const before = p.circle_streak_before ?? 0;
  return (
    <Card tone={colors.red} style={styles.skipCard}>
      <Muted style={styles.meta}>{when}</Muted>
      <P>
        <Text style={styles.name}>{name}</Text> skipped {p.course_code ?? 'class'}
        {p.starts_at ? ` at ${fmtTime(p.starts_at)}` : ''}
      </P>
      <Row style={{ marginTop: space.sm }} gap={6}>
        <Text style={styles.streakLine}>Circle streak</Text>
        <Text style={styles.streakLine}>🔥 {before}</Text>
        <Text style={styles.streakLine}>→</Text>
        <DyingNumber from={before} />
      </Row>
      {typeof p.personal_streak_before === 'number' ? (
        <Muted style={{ marginTop: 4 }}>
          {name}'s streak: {p.personal_streak_before} → 0
        </Muted>
      ) : null}
      {unexplained ? (
        <Button
          title="Explain yourself"
          variant="danger"
          size="sm"
          style={{ marginTop: space.md, alignSelf: 'flex-start' }}
          onPress={() => router.push(`/explain/${event.ref_id}` as never)}
        />
      ) : null}
      <ReactionRow eventId={event.id} reactions={state?.reactions ?? []} me={me} />
    </Card>
  );
}

// ---------------------------------------------------------------- forfeit owed

function ForfeitOwedBody({
  event,
  name,
  when,
  me,
  forfeits,
}: {
  event: FeedEvent;
  name: string;
  when: string;
  me: string;
  forfeits: Forfeit[];
}) {
  const { state, refresh } = useCircleState();
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

  const tone = status === 'paid' ? colors.green : status === 'voided' ? colors.faint : colors.amber;
  return (
    <Pressable onPress={() => p.forfeit_id && router.push(`/forfeit/${p.forfeit_id}` as never)}>
      <Card tone={tone}>
        <Muted style={styles.meta}>{when}</Muted>
        {status === 'owed' ? (
          <>
            <P>
              <Text style={styles.name}>{name}</Text> owes: <Text style={{ color: colors.amber, fontWeight: '800' }}>{description}</Text>
            </P>
            {owedByMe ? (
              <Muted style={{ marginTop: space.sm }}>Someone else in the circle clears this.</Muted>
            ) : (
              <Button
                title="Mark paid"
                variant="success"
                size="sm"
                loading={busy}
                style={{ marginTop: space.md, alignSelf: 'flex-start' }}
                onPress={pay}
              />
            )}
            <ErrorText>{err}</ErrorText>
          </>
        ) : status === 'paid' ? (
          <P>
            <Text style={styles.name}>{name}</Text>: {description}{' '}
            <Text style={{ color: colors.green, fontWeight: '800' }}>Paid ✓</Text>
            {forfeit?.paid_by_name ? <Text style={{ color: colors.muted }}> confirmed by {forfeit.paid_by_name}</Text> : null}
          </P>
        ) : (
          <Muted>
            {name}'s forfeit ({description}) was voided (excused).
          </Muted>
        )}
        <ReactionRow eventId={event.id} reactions={state?.reactions ?? []} me={me} />
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  name: { fontWeight: '800', color: colors.text },
  meta: { fontSize: 12, marginBottom: 4 },
  quoteCard: { backgroundColor: colors.cardAlt, marginLeft: space.lg },
  quote: { fontStyle: 'italic' },
  mutedCard: { opacity: 0.9 },
  oneLiner: { paddingVertical: 6, paddingHorizontal: 4, marginBottom: space.md },
  backInset: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: '32%',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  skipCard: { backgroundColor: '#1f1416' },
  streakLine: { color: colors.text, fontSize: 18, fontWeight: '800' },
  dying: { color: colors.text, fontSize: 18, fontWeight: '900' },
});
