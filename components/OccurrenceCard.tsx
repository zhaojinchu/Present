import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, ErrorText, Muted } from '@/components/ui';
import { excuseOccurrence } from '@/lib/api/circle';
import { useCircleState } from '@/lib/circleState';
import { useNow } from '@/lib/clock';
import { errorMessage } from '@/lib/supabase';
import { colors, fonts, radius, space } from '@/lib/theme';
import { fmtCountdown, fmtTime } from '@/lib/time';
import type { Occurrence } from '@/lib/types';

export function OccurrenceCard({
  occurrence: o,
  othersThere,
  total,
  friendsThere = [],
  variant = 'row',
}: {
  occurrence: Occurrence;
  othersThere: number;
  total: number;
  friendsThere?: { name: string; avatar_url?: string | null }[];
  variant?: 'hero' | 'row';
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

  if (variant === 'hero') {
    return (
      <View style={styles.heroWrap}>
        <Pressable
          onPress={() => open && router.push(`/checkin/${o.id}`)}
          disabled={!open}
          style={({ pressed }) => [styles.hero, pressed && open && { opacity: 0.92 }]}
        >
          <View style={styles.heroWell}>
            <Text style={styles.heroCourse}>{o.course_code}</Text>
            {o.name ? <Text style={styles.heroName}>{o.name}</Text> : null}
            <Text style={styles.heroMeta}>
              {fmtTime(o.starts_at)} · {o.building_code}
            </Text>
            {open ? (
              <Text style={styles.heroCta}>Check in · {fmtCountdown(windowEnd - now)}</Text>
            ) : o.status === 'checked_in' ? (
              <Text style={styles.heroCta}>You're in</Text>
            ) : now < windowStart ? (
              <Text style={styles.heroCta}>Opens in {fmtCountdown(windowStart - now)}</Text>
            ) : (
              <Text style={styles.heroCta}>Window closed</Text>
            )}
            {open ? (
              <View style={styles.shutter} pointerEvents="none">
                <View style={styles.shutterInner} />
              </View>
            ) : null}
          </View>
          {friendsThere.length > 0 ? (
            <View style={styles.friends}>
              {friendsThere.slice(0, 4).map((f, i) => (
                <View key={f.name} style={[styles.friendRing, i > 0 && { marginLeft: -8 }]}>
                  <Avatar name={f.name} uri={f.avatar_url} size={28} />
                </View>
              ))}
              <Text style={styles.friendsLabel}>
                {othersThere} of {total} there
              </Text>
            </View>
          ) : null}
        </Pressable>
        {pending && !o.is_demo ? (
          <Pressable onPress={onExcuse} disabled={busy} hitSlop={6} style={styles.excuse}>
            <Text style={styles.ghost}>{busy ? 'Marking...' : "Can't make it (sick / emergency)"}</Text>
          </Pressable>
        ) : null}
        <ErrorText>{error}</ErrorText>
      </View>
    );
  }

  let status = '';
  if (o.status === 'checked_in') status = 'Checked in';
  else if (o.status === 'skipped') status = 'Skipped';
  else if (o.status === 'excused') status = 'Excused';
  else if (now < windowStart) status = `Opens in ${fmtCountdown(windowStart - now)}`;
  else if (open) status = `Check in · ${fmtCountdown(windowEnd - now)}`;
  else status = `Skip at ${fmtTime(o.skip_deadline)}`;

  return (
    <Pressable
      onPress={() => open && router.push(`/checkin/${o.id}`)}
      disabled={!open}
      style={({ pressed }) => [styles.row, pressed && open && { opacity: 0.7 }]}
    >
      <View style={[styles.thumb, o.status === 'checked_in' && styles.thumbIn, o.status === 'skipped' && styles.thumbSkip]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowCode}>{o.course_code}</Text>
        <Muted>
          {fmtTime(o.starts_at)} · {o.building_code}
        </Muted>
      </View>
      <Text
        style={[
          styles.rowStatus,
          o.status === 'skipped' && { color: colors.red },
          o.status === 'checked_in' && { color: colors.green },
          open && { color: colors.text, fontFamily: fonts.black },
        ]}
      >
        {status}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heroWrap: { marginBottom: space.xl },
  hero: { borderRadius: radius.xl, overflow: 'hidden', backgroundColor: '#111111' },
  heroWell: {
    aspectRatio: 3 / 4,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  heroCourse: { color: colors.white, fontSize: 36, fontFamily: fonts.black },
  heroName: { color: 'rgba(255,255,255,0.7)', fontSize: 15, fontFamily: fonts.regular, marginTop: 6, textAlign: 'center' },
  heroCta: { color: colors.white, fontSize: 17, fontFamily: fonts.bold, marginTop: 18 },
  heroMeta: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontFamily: fonts.bold, marginTop: 8 },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.white },
  friends: {
    position: 'absolute',
    left: 14,
    top: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendRing: { borderWidth: 2, borderColor: colors.white, borderRadius: 16 },
  friendsLabel: { color: colors.white, fontSize: 13, fontFamily: fonts.bold, marginLeft: 10 },
  excuse: { marginTop: space.sm, alignSelf: 'center' },
  ghost: { color: colors.faint, fontSize: 13, fontFamily: fonts.regular, textDecorationLine: 'underline' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  thumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: colors.cardAlt },
  thumbIn: { backgroundColor: colors.greenSoft },
  thumbSkip: { backgroundColor: colors.redSoft },
  rowCode: { color: colors.text, fontSize: 17, fontFamily: fonts.bold },
  rowStatus: { color: colors.muted, fontSize: 13, fontFamily: fonts.bold },
});
