import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AvatarStack, Badge, Button, Card, ErrorText, Row, Txt } from '@/components/ui';
import { excuseOccurrence } from '@/lib/api/circle';
import { useCircleState } from '@/lib/circleState';
import { useNow } from '@/lib/clock';
import { errorMessage } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';
import { fmtCountdown, fmtTime } from '@/lib/time';
import type { Occurrence } from '@/lib/types';

export function isWindowOpen(o: Occurrence, nowMs: number) {
  return o.status === 'pending' && nowMs >= new Date(o.window_start).getTime() && nowMs <= new Date(o.window_end).getTime();
}

function useExcuse(o: Occurrence) {
  const { refresh } = useCircleState();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function onExcuse() {
    setBusy(true);
    setError(null);
    try {
      await excuseOccurrence(o.id);
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, onExcuse };
}

/** The class whose window is open right now: its own card with the primary action. */
export function OpenClassCard({ occurrence: o, there, total }: { occurrence: Occurrence; there: { name: string; uri?: string | null }[]; total: number }) {
  const now = useNow().getTime();
  const router = useRouter();
  const windowEnd = new Date(o.window_end).getTime();
  return (
    <Card style={styles.openCard}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Txt variant="title">{o.course_code}</Txt>
          <Txt variant="subhead" tone="secondary" numberOfLines={1}>
            {o.name ? `${o.building_code} · ${o.name}` : o.building_code}
          </Txt>
        </View>
        <Badge label="Open" tone="neutral" icon="radio-button-on" />
      </Row>
      {total > 1 ? (
        <Row gap={space.sm} style={{ marginTop: space.md }}>
          {there.length > 0 ? <AvatarStack people={there} /> : null}
          <Txt variant="footnote" tone="secondary">
            {there.length === 0 ? 'Nobody from your circle is there yet' : `${there.length} of ${total} in your circle are there`}
          </Txt>
        </Row>
      ) : null}
      <Button title="Check in" icon="camera" size="lg" haptic style={{ marginTop: space.lg }} onPress={() => router.push(`/checkin/${o.id}`)} />
      <Txt variant="footnote" tone="tertiary" align="center" tabular style={{ marginTop: space.sm }}>
        Closes in {fmtCountdown(windowEnd - now)}
      </Txt>
    </Card>
  );
}

/** One class in the day's grouped list. */
export function OccurrenceRow({ occurrence: o }: { occurrence: Occurrence }) {
  const now = useNow().getTime();
  const { busy, error, onExcuse } = useExcuse(o);
  const windowStart = new Date(o.window_start).getTime();
  const pending = o.status === 'pending';

  let trailing: React.ReactNode;
  let note: string | null = null;
  if (o.status === 'checked_in') trailing = <Badge label="Checked in" tone="success" icon="checkmark" />;
  else if (o.status === 'skipped') trailing = <Badge label="Skipped" tone="danger" icon="close" />;
  else if (o.status === 'excused') trailing = <Badge label="Excused" tone="info" />;
  else if (now < windowStart)
    trailing = (
      <Txt variant="footnote" tone="secondary" tabular>
        Opens in {fmtCountdown(windowStart - now)}
      </Txt>
    );
  else {
    trailing = <Badge label="Window closed" tone="warning" />;
    note = `Skip posts at ${fmtTime(o.skip_deadline)}`;
  }

  return (
    <View style={styles.row}>
      <View style={styles.time}>
        <Txt variant="subhead" weight="600" tabular>
          {fmtTime(o.starts_at)}
        </Txt>
        <Txt variant="footnote" tone="tertiary" tabular>
          {fmtTime(o.ends_at)}
        </Txt>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="headline">{o.course_code}</Txt>
        <Txt variant="footnote" tone="secondary" numberOfLines={1}>
          {o.name ? `${o.building_code} · ${o.name}` : o.building_code}
        </Txt>
        {note ? (
          <Txt variant="footnote" tone="tertiary">
            {note}
          </Txt>
        ) : null}
        {pending && !o.is_demo ? (
          // Hidden on demo classes: one mis-tap next to the big Check in button would excuse the presenter.
          <Pressable onPress={onExcuse} disabled={busy} hitSlop={6} style={({ pressed }) => [{ alignSelf: 'flex-start', marginTop: 2, opacity: pressed ? 0.6 : 1 }]}>
            <Txt variant="footnote" tone="secondary" style={{ textDecorationLine: 'underline' }}>
              {busy ? 'Marking…' : "Can't make it?"}
            </Txt>
          </Pressable>
        ) : null}
        <ErrorText>{error}</ErrorText>
      </View>
      <View style={{ alignItems: 'flex-end' }}>{trailing}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  openCard: { marginBottom: space.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 60,
    backgroundColor: colors.surface,
  },
  time: { width: 64 },
});
