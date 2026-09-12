import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Button, Card, H2, Input, Muted, Row, Spacer } from '@/components/ui';
import { dev } from '@/lib/api/dev';
import { useCircleState } from '@/lib/circleState';
import { useNow } from '@/lib/clock';
import { requireGeofence, setRequireGeofence, TZ } from '@/lib/config';
import { getPosition } from '@/lib/geofence';
import { errorMessage } from '@/lib/supabase';
import { colors, fonts, radius, space } from '@/lib/theme';
import { relative, todayKey } from '@/lib/time';

interface LogLine {
  id: number;
  at: number;
  text: string;
  ok: boolean;
}

let seq = 0;

export default function DevPanel() {
  const { state, live, lastFetchedAt, refresh } = useCircleState();
  const now = useNow();
  const [course, setCourse] = useState('15-122');
  const [windowMin, setWindowMin] = useState('3');
  const [skipAfterMin, setSkipAfterMin] = useState('3');
  const [geo, setGeo] = useState(requireGeofence());
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);

  function push(text: string, ok: boolean) {
    setLog((prev) => [{ id: ++seq, at: Date.now(), text, ok }, ...prev].slice(0, 30));
  }

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    try {
      const r = await fn();
      const shown = r === undefined || r === null ? 'ok' : typeof r === 'object' ? JSON.stringify(r) : String(r);
      push(`${label}: ${shown}`, true);
      await refresh();
    } catch (e) {
      push(`${label}: ${errorMessage(e)}`, false);
    } finally {
      setBusy(null);
    }
  }

  const int = (s: string, d: number) => {
    const n = parseInt(s, 10);
    return Number.isFinite(n) && n > 0 ? n : d;
  };

  const others = state ? state.members.filter((m) => m.id !== state.me) : [];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl * 2 }}>
      <View style={styles.warning}>
        <Text style={styles.warningText}>Demo controls. Never open during judging except for the scripted buttons.</Text>
      </View>

      <Card>
        <Muted>circle: {state?.circle?.id ?? 'none'}</Muted>
        <Muted>realtime: {live ? 'SUBSCRIBED (live)' : 'not subscribed (polling every 2 s)'}</Muted>
        <Muted>last fetch: {lastFetchedAt ? relative(lastFetchedAt) : 'never'}</Muted>
        <Muted>server clock: {now.toLocaleTimeString('en-US', { timeZone: TZ })}</Muted>
        <Muted>me: {state?.me ?? '?'}</Muted>
      </Card>

      <H2 style={{ marginBottom: space.sm }}>The skip moment</H2>
      <Row gap={space.sm} style={{ marginBottom: space.sm }}>
        <View style={{ flex: 2 }}>
          <Muted>Course</Muted>
          <Input value={course} onChangeText={setCourse} autoCapitalize="characters" autoCorrect={false} />
        </View>
        <View style={{ flex: 1 }}>
          <Muted>Window min</Muted>
          <Input value={windowMin} onChangeText={setWindowMin} keyboardType="number-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Muted>Skip after</Muted>
          <Input value={skipAfterMin} onChangeText={setSkipAfterMin} keyboardType="number-pad" />
        </View>
      </Row>
      <Button
        title="Start class now"
        size="lg"
        loading={busy === 'start'}
        onPress={() => run('start', () => dev.startClassNow(course.trim(), int(windowMin, 3), int(skipAfterMin, 3)))}
      />
      <Spacer h={space.sm} />
      <Button title="End window now" variant="danger" loading={busy === 'end'} onPress={() => run('end', () => dev.endWindowNow())} />
      <Spacer h={space.sm} />
      <Button title="Reset demo state" variant="secondary" loading={busy === 'reset'} onPress={() => run('reset', () => dev.resetDemo())} />

      <Spacer h={space.xl} />
      <H2 style={{ marginBottom: space.sm }}>Location</H2>
      <Button
        title="Set demo building to my location"
        variant="secondary"
        loading={busy === 'setbuilding'}
        onPress={() =>
          run('setbuilding', async () => {
            const p = await getPosition();
            await dev.setDemoBuilding(p.coords.latitude, p.coords.longitude);
            return `${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)} (±${Math.round(p.coords.accuracy ?? 0)} m)`;
          })
        }
      />
      <Spacer h={space.sm} />
      <Button
        title="Show my coordinates + accuracy"
        variant="secondary"
        loading={busy === 'coords'}
        onPress={() =>
          run('coords', async () => {
            const p = await getPosition();
            return `${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)} (±${Math.round(p.coords.accuracy ?? 0)} m)`;
          })
        }
      />
      <Spacer h={space.sm} />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: colors.text, fontFamily: fonts.bold }}>Require geofence</Text>
          <Switch
            value={geo}
            onValueChange={(v) => {
              setRequireGeofence(v);
              setGeo(v);
              push(`geofence ${v ? 'required' : 'bypassed'}`, true);
            }}
            trackColor={{ true: colors.accent, false: colors.border }}
          />
        </Row>
      </Card>

      <Spacer h={space.md} />
      <H2 style={{ marginBottom: space.sm }}>Maintenance</H2>
      <Button title="Force skip detection" variant="secondary" loading={busy === 'detect'} onPress={() => run('detect', () => dev.detectSkips())} />
      <Spacer h={space.sm} />
      <Button
        title="Ensure today's occurrences"
        variant="secondary"
        loading={busy === 'ensure'}
        onPress={() => run('ensure', () => dev.ensureOccurrences(todayKey()))}
      />

      <Spacer h={space.xl} />
      <H2 style={{ marginBottom: space.sm }}>Replay (if a phone dies)</H2>
      {others.length === 0 ? <Muted>No other members in your circle.</Muted> : null}
      {others.map((m) => (
        <View key={m.id} style={{ marginBottom: space.sm }}>
          <Button
            title={`Replay: check in as ${m.display_name}`}
            variant="secondary"
            loading={busy === `replay:${m.id}`}
            onPress={() => run(`replay:${m.id}`, () => dev.replayCheckin(m.id))}
          />
        </View>
      ))}
      <Button
        title="Replay: post explanation 'slept in'"
        variant="secondary"
        loading={busy === 'explain'}
        onPress={() => run('explain', () => dev.replayExplanation('slept in'))}
      />
      <Spacer h={space.sm} />
      <Button title="Replay: pay the forfeit" variant="secondary" loading={busy === 'pay'} onPress={() => run('pay', () => dev.replayPayForfeit())} />

      <Spacer h={space.xl} />
      <H2 style={{ marginBottom: space.sm }}>Log</H2>
      {log.length === 0 ? <Muted>Nothing yet.</Muted> : null}
      {log.map((l) => (
        <View key={l.id} style={[styles.logLine, { borderLeftColor: l.ok ? colors.green : colors.red }]}>
          <Text style={{ color: l.ok ? colors.text : colors.red, fontSize: 13, fontFamily: fonts.regular }}>{l.text}</Text>
          <Muted style={{ fontSize: 11 }}>{new Date(l.at).toLocaleTimeString('en-US', { timeZone: TZ })}</Muted>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  warning: {
    backgroundColor: colors.red,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.lg,
  },
  warningText: { color: colors.white, fontFamily: fonts.black, fontSize: 15 },
  logLine: {
    borderLeftWidth: 3,
    paddingLeft: space.sm,
    paddingVertical: 4,
    marginBottom: 6,
  },
});
