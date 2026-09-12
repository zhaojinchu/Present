import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, ErrorText, Input, Muted, Row, Spacer } from '@/components/ui';
import { deleteClass, listBuildings, listMyClasses, saveClass } from '@/lib/api/schedule';
import { useSession } from '@/lib/session';
import { errorMessage } from '@/lib/supabase';
import { colors, fonts, radius, space } from '@/lib/theme';
import { DOW_SHORT, fmtClock } from '@/lib/time';
import type { Building } from '@/lib/types';

const HOURS = Array.from({ length: 15 }, (_, i) => 7 + i); // 7 AM .. 9 PM
const MINUTES = [0, 10, 15, 20, 30, 40, 45, 50];

function pad(n: number) {
  return String(n).padStart(2, '0');
}
function toHM(t: string): { h: number; m: number } {
  const [h, m] = t.split(':').map(Number);
  return { h: h || 0, m: m || 0 };
}
function hourLabel(h: number) {
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${suffix}`;
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipOn]} hitSlop={2}>
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function TimePicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const { h, m } = toHM(value);
  return (
    <View style={{ marginBottom: space.md }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: space.xs }}>
        <Muted>{label}</Muted>
        <Text style={{ color: colors.text, fontFamily: fonts.bold }}>{fmtClock(value)}</Text>
      </Row>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
        {HOURS.map((hh) => (
          <Chip key={hh} label={hourLabel(hh)} selected={hh === h} onPress={() => onChange(`${pad(hh)}:${pad(m)}:00`)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
        {MINUTES.map((mm) => (
          <Chip key={mm} label={`:${pad(mm)}`} selected={mm === m} onPress={() => onChange(`${pad(h)}:${pad(mm)}:00`)} />
        ))}
      </ScrollView>
    </View>
  );
}

export default function EditClass() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = typeof id === 'string' && id.length > 0 ? id : null;
  const { user } = useSession();
  const router = useRouter();

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [courseCode, setCourseCode] = useState('');
  const [name, setName] = useState('');
  const [buildingCode, setBuildingCode] = useState<string | null>(null);
  const [days, setDays] = useState<number[]>([1, 3, 5]);
  const [start, setStart] = useState('09:30:00');
  const [end, setEnd] = useState('10:20:00');
  const [loaded, setLoaded] = useState(!editing);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const b = await listBuildings();
        if (alive) setBuildings(b);
        if (editing && user) {
          const mine = await listMyClasses(user.id);
          const c = mine.find((x) => x.id === editing);
          if (c && alive) {
            setCourseCode(c.course_code);
            setName(c.name ?? '');
            setBuildingCode(c.building_code);
            setDays(c.days_of_week);
            setStart(c.start_time);
            setEnd(c.end_time);
          }
        }
      } catch (e) {
        if (alive) setError(errorMessage(e));
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [editing, user]);

  const validation = useMemo(() => {
    if (!courseCode.trim()) return 'Enter the course code (like 15-122).';
    if (days.length === 0) return 'Pick at least one day.';
    if (!buildingCode) return 'Pick the building.';
    if (end <= start) return 'End time must be after start time.';
    return null;
  }, [courseCode, days, buildingCode, start, end]);

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  async function onSave() {
    if (!user) return;
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveClass(user.id, {
        id: editing ?? undefined,
        course_code: courseCode,
        name: name || null,
        building_code: buildingCode!,
        days_of_week: days,
        start_time: start,
        end_time: end,
      });
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!editing) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteClass(editing);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
      setConfirmDelete(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl * 2 }} keyboardShouldPersistTaps="handled">
        <Muted style={{ marginBottom: space.xs }}>Course code</Muted>
        <Input placeholder="15-122" autoCapitalize="characters" autoCorrect={false} value={courseCode} onChangeText={setCourseCode} />
        <Spacer h={space.md} />
        <Muted style={{ marginBottom: space.xs }}>Name (optional)</Muted>
        <Input placeholder="Principles of Imperative Computation" value={name} onChangeText={setName} />
        <Spacer h={space.lg} />

        <Muted style={{ marginBottom: space.xs }}>Days</Muted>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          {DOW_SHORT.map((label, d) => (
            <Chip key={d} label={label} selected={days.includes(d)} onPress={() => toggleDay(d)} />
          ))}
        </Row>
        <Spacer h={space.lg} />

        <TimePicker label="Starts" value={start} onChange={setStart} />
        <TimePicker label="Ends" value={end} onChange={setEnd} />

        <Muted style={{ marginBottom: space.xs }}>Building</Muted>
        {!loaded ? <Muted>Loading…</Muted> : null}
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          {buildings.map((b) => (
            <Chip key={b.code} label={`${b.code} · ${b.name}`} selected={b.code === buildingCode} onPress={() => setBuildingCode(b.code)} />
          ))}
        </Row>
        {loaded && buildings.length === 0 ? <Muted style={{ marginTop: space.xs }}>No buildings loaded. Run the seed script first.</Muted> : null}

        <ErrorText>{error}</ErrorText>
        <Spacer h={space.xl} />
        <Button title={editing ? 'Save changes' : 'Add class'} size="lg" loading={busy} disabled={!loaded} onPress={onSave} />
        {editing ? (
          <>
            <Spacer h={space.sm} />
            <Button
              title={confirmDelete ? 'Really delete? Tap again' : 'Delete class'}
              variant={confirmDelete ? 'danger' : 'ghost'}
              loading={busy && confirmDelete}
              onPress={onDelete}
            />
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  chipText: { color: colors.muted, fontFamily: fonts.bold, fontSize: 14 },
  chipTextOn: { color: colors.accentText },
});
