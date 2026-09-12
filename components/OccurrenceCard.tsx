import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, ErrorText, Muted, Pill, Row } from '@/components/ui';
import { excuseOccurrence } from '@/lib/api/circle';
import { useCircleState } from '@/lib/circleState';
import { useNow } from '@/lib/clock';
import { errorMessage } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';
import { fmtCountdown, fmtTime } from '@/lib/time';
import type { Occurrence } from '@/lib/types';

export function OccurrenceCard({
  occurrence: o,
  othersThere,
  total,
}: {
  occurrence: Occurrence;
  othersThere: number;
  total: number;
}) {
  const now = useNow().getTime();
  const router = useRouter();
  const { refresh } = useCircleState();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const windowStart = new Date(o.window_start).getTime();
  const windowEnd = new Date(o.window_end).getTime();
  const pending = o.status === 'pending';
  const open = pending && now >= windowStart && now <= windowEnd;

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

  let status: React.ReactNode;
  if (o.status === 'checked_in') status = <Pill label="Checked in ✓" color={colors.green} />;
  else if (o.status === 'skipped') status = <Pill label="Skipped" color={colors.red} />;
  else if (o.status === 'excused') status = <Pill label="Excused" color={colors.blue} />;
  else if (now < windowStart) status = <Muted>Opens in {fmtCountdown(windowStart - now)}</Muted>;
  else if (open)
    status = (
      <Button
        title={`Check in · closes in ${fmtCountdown(windowEnd - now)}`}
        size="lg"
        onPress={() => router.push(`/checkin/${o.id}`)}
      />
    );
  else status = <Text style={styles.amber}>Window closed. Skip posts at {fmtTime(o.skip_deadline)}.</Text>;

  return (
    <Card tone={open ? colors.accent : undefined}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.code}>{o.course_code}</Text>
          {o.name ? <Muted numberOfLines={1}>{o.name}</Muted> : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.time}>
            {fmtTime(o.starts_at)} – {fmtTime(o.ends_at)}
          </Text>
          <Muted>{o.building_code}</Muted>
        </View>
      </Row>
      <View style={{ marginTop: space.md }}>{status}</View>
      {pending && total > 1 ? (
        <Muted style={{ marginTop: space.sm }}>
          {othersThere} of {total} in your circle are there
        </Muted>
      ) : null}
      {pending && !o.is_demo ? (
        // Hidden on demo classes: one mis-tap next to the big Check in button would excuse the presenter.
        <Pressable onPress={onExcuse} disabled={busy} hitSlop={6} style={{ marginTop: space.sm, alignSelf: 'flex-start' }}>
          <Text style={styles.ghost}>{busy ? 'Marking…' : "Can't make it (sick / emergency)"}</Text>
        </Pressable>
      ) : null}
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}

const styles = StyleSheet.create({
  code: { color: colors.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  time: { color: colors.text, fontSize: 15, fontWeight: '600' },
  amber: { color: colors.amber, fontSize: 15, fontWeight: '600' },
  ghost: { color: colors.faint, fontSize: 13, textDecorationLine: 'underline' },
});
