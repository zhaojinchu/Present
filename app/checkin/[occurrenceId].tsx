import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import type { LocationObject } from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Panel } from '@/components/checkin/Panel';
import { Button, Center, Muted, Screen, Spacer } from '@/components/ui';
import { submitCheckin } from '@/lib/api/checkin';
import { useCircleState } from '@/lib/circleState';
import { useNow } from '@/lib/clock';
import { DUAL_CAPTURE, requireGeofence } from '@/lib/config';
import { evaluate, GeoError, getPosition } from '@/lib/geofence';
import { errorMessage, supabase } from '@/lib/supabase';
import { colors, radius, space } from '@/lib/theme';
import { fmtCountdown } from '@/lib/time';
import type { Building } from '@/lib/types';

type Phase =
  | { kind: 'camera' }
  | { kind: 'preview'; front: string; back: string | null }
  | { kind: 'submitting'; front: string; back: string | null; label: string }
  | { kind: 'success'; streak: number }
  | { kind: 'error'; icon: string; title: string; message: string; retry?: () => void; settings?: boolean };

// Attach a no-op handler so an early rejection is not "unhandled"; the original promise
// still rejects when awaited later.
function track<T>(p: Promise<T>): Promise<T> {
  p.catch(() => {});
  return p;
}

export default function CheckinScreen() {
  const { occurrenceId } = useLocalSearchParams<{ occurrenceId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, error: stateError, refresh } = useCircleState();
  const occurrence = state?.today.find((o) => o.id === occurrenceId && o.user_id === state.me) ?? null;

  const [phase, setPhase] = useState<Phase>({ kind: 'camera' });
  const [facing, setFacing] = useState<CameraType>('front');
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [perm, requestPerm] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const gpsRef = useRef<Promise<LocationObject> | null>(null);
  const buildingRef = useRef<Promise<Building | null> | null>(null);
  const startedRef = useRef(false);

  const now = useNow(1000);
  const nowMs = now.getTime();

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }, [router]);

  const openSettings = useCallback(() => {
    Linking.openSettings().catch(() => {});
  }, []);

  const startGps = useCallback(() => {
    gpsRef.current = track(getPosition());
  }, []);

  // Camera permission: ask once on mount. The "Allow camera" button covers retries.
  const askedRef = useRef(false);
  useEffect(() => {
    if (perm && !perm.granted && perm.canAskAgain && !askedRef.current) {
      askedRef.current = true;
      requestPerm().catch(() => {});
    }
  }, [perm, requestPerm]);

  // GPS fix + building lookup start as soon as we know which class this is, in parallel with camera warm-up.
  useEffect(() => {
    if (!occurrence || startedRef.current) return;
    startedRef.current = true;
    startGps();
    buildingRef.current = track(
      (async () => {
        const { data, error } = await supabase.from('buildings').select('*').eq('code', occurrence.building_code).maybeSingle();
        if (error) throw error;
        return (data as Building | null) ?? null;
      })(),
    );
  }, [occurrence, startGps]);

  // Auto-leave after success. Go back to where we came from (Home) rather than replace('/(tabs)'),
  // which would stack a second tabs navigator on top of the first.
  useEffect(() => {
    if (phase.kind !== 'success') return;
    const id = setTimeout(close, 2200);
    return () => clearTimeout(id);
  }, [phase.kind, close]);

  const capture = useCallback(async () => {
    if (!cameraRef.current || !cameraReady || capturing) return;
    setCapturing(true);
    try {
      const front = await cameraRef.current.takePictureAsync({ quality: 0.7, skipProcessing: false, shutterSound: false });
      if (!front?.uri) throw new Error('The camera returned no photo');
      let back: string | null = null;
      if (DUAL_CAPTURE) {
        setFacing('back');
        await new Promise((r) => setTimeout(r, 1000));
        try {
          const shot = await cameraRef.current?.takePictureAsync({ quality: 0.7, skipProcessing: false, shutterSound: false });
          back = shot?.uri ?? null;
        } catch {
          back = null;
        }
        setFacing('front');
      }
      setPhase({ kind: 'preview', front: front.uri, back });
    } catch (e) {
      setPhase({
        kind: 'error',
        icon: '📷',
        title: 'Camera hiccup',
        message: errorMessage(e),
        retry: () => {
          setCameraReady(false); // the CameraView remounts; wait for its onCameraReady again
          setPhase({ kind: 'camera' });
        },
      });
    } finally {
      setCapturing(false);
    }
  }, [cameraReady, capturing]);

  const submit = useCallback(
    async (front: string, back: string | null) => {
      if (!state || !occurrence) return;
      setPhase({ kind: 'submitting', front, back, label: 'Checking your location' });

      let inGeofence = false;
      try {
        const [pos, building] = await Promise.all([gpsRef.current, buildingRef.current]);
        if (pos && building) {
          const r = evaluate(pos, building);
          inGeofence = r.inside;
          if (!r.inside && requireGeofence()) {
            setPhase({
              kind: 'error',
              icon: '📍',
              title: 'Not in the building',
              message: `You're ${r.distance} m from ${building.name}. Get inside the building and try again.`,
              retry: () => {
                startGps();
                submit(front, back);
              },
            });
            return;
          }
        } else if (!building && requireGeofence()) {
          setPhase({
            kind: 'error',
            icon: '🏢',
            title: 'Unknown building',
            message: `We don't have a location for ${occurrence.building_code}. Ask whoever set up the schedule to pick a building.`,
            retry: () => submit(front, back),
          });
          return;
        }
      } catch (e) {
        inGeofence = false;
        if (requireGeofence()) {
          if (e instanceof GeoError && e.kind === 'denied') {
            setPhase({
              kind: 'error',
              icon: '📍',
              title: 'Location is off',
              message: 'Present needs your location to confirm you are in the room. Only a yes/no is stored, never coordinates.',
              settings: true,
              retry: () => {
                startGps();
                submit(front, back);
              },
            });
          } else {
            setPhase({
              kind: 'error',
              icon: '📡',
              title: 'No location fix',
              message: errorMessage(e),
              retry: () => {
                startGps();
                submit(front, back);
              },
            });
          }
          return;
        }
      }

      setPhase({ kind: 'submitting', front, back, label: 'Uploading' });
      try {
        await submitCheckin({ occurrenceId: occurrence.id, userId: state.me, frontUri: front, backUri: back, inGeofence });
      } catch (e) {
        setPhase({
          kind: 'error',
          icon: '⚠️',
          title: 'Check-in failed',
          message: errorMessage(e),
          retry: () => submit(front, back),
        });
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      let streak = state.personal_streak + 1;
      try {
        const fresh = await refresh();
        if (fresh) streak = fresh.personal_streak;
      } catch {
        // keep the optimistic number
      }
      setPhase({ kind: 'success', streak });
    },
    [state, occurrence, refresh, startGps],
  );

  // ---------------------------------------------------------------- non-camera states

  // No state yet (e.g. opened from a notification tap before the first fetch): spinner, not "not found".
  if (!state && !stateError) {
    return (
      <Screen>
        <Center>
          <ActivityIndicator color={colors.accent} />
        </Center>
      </Screen>
    );
  }

  if (!state) {
    return (
      <Panel
        icon="📡"
        tone={colors.red}
        title="Can't reach the server"
        message={stateError ?? 'Check your connection and try again.'}
        actions={[
          { title: 'Try again', onPress: () => refresh({ maintain: true }) },
          { title: 'Close', onPress: close, variant: 'ghost' },
        ]}
      />
    );
  }

  if (!occurrence) {
    return (
      <Panel
        icon="🤔"
        title="Class not found"
        message="This class is not on your schedule for today."
        actions={[{ title: 'Close', onPress: close, variant: 'secondary' }]}
      />
    );
  }

  if (phase.kind === 'success') {
    return (
      <Panel
        icon="✅"
        tone={colors.green}
        title="You're in."
        message={`${phase.streak}-day streak`}
        actions={[{ title: 'Done', onPress: close, variant: 'success' }]}
      />
    );
  }

  if (phase.kind === 'error') {
    const actions = [];
    if (phase.settings) actions.push({ title: 'Open Settings', onPress: openSettings });
    if (phase.retry) actions.push({ title: 'Try again', onPress: phase.retry, variant: phase.settings ? ('secondary' as const) : ('primary' as const) });
    actions.push({ title: 'Close', onPress: close, variant: 'ghost' as const });
    return <Panel icon={phase.icon} tone={colors.red} title={phase.title} message={phase.message} actions={actions} />;
  }

  if (occurrence.status !== 'pending') {
    const label = occurrence.status === 'checked_in' ? 'checked in' : occurrence.status;
    return (
      <Panel
        icon={occurrence.status === 'checked_in' ? '✅' : '🚫'}
        title={`Already ${label}`}
        message={`${occurrence.course_code} is already marked ${label} for today.`}
        actions={[{ title: 'Close', onPress: close, variant: 'secondary' }]}
      />
    );
  }

  const windowStartMs = new Date(occurrence.window_start).getTime();
  const windowEndMs = new Date(occurrence.window_end).getTime();
  const notOpen = nowMs < windowStartMs;
  const closed = nowMs > windowEndMs;

  if (closed && (phase.kind === 'camera' || phase.kind === 'preview')) {
    return (
      <Panel
        icon="⏰"
        tone={colors.red}
        title="Window closed"
        message={`The check-in window for ${occurrence.course_code} closed. Your circle will hear about it.`}
        actions={[{ title: 'Close', onPress: close, variant: 'secondary' }]}
      />
    );
  }

  if (perm && !perm.granted) {
    return (
      <Panel
        icon="📷"
        title="Camera is off"
        message="Present checks you in with a photo from inside the room. Allow camera access to continue."
        actions={[
          ...(perm.canAskAgain ? [{ title: 'Allow camera', onPress: () => requestPerm().catch(() => {}) }] : [{ title: 'Open Settings', onPress: openSettings }]),
          { title: 'Close', onPress: close, variant: 'ghost' },
        ]}
      />
    );
  }

  if (!perm) {
    return (
      <Screen>
        <Center>
          <ActivityIndicator color={colors.accent} />
        </Center>
      </Screen>
    );
  }

  if (phase.kind === 'submitting') {
    return (
      <View style={styles.fill}>
        <Image source={{ uri: phase.front }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View style={styles.dim} />
        <Center>
          <ActivityIndicator color={colors.accent} size="large" />
          <Spacer />
          <Text style={styles.overlayTitle}>{phase.label}…</Text>
          <Muted>Hold on a second</Muted>
        </Center>
      </View>
    );
  }

  if (phase.kind === 'preview') {
    return (
      <View style={styles.fill}>
        <Image source={{ uri: phase.front }} style={StyleSheet.absoluteFill} contentFit="cover" />
        {phase.back ? <Image source={{ uri: phase.back }} style={[styles.inset, { top: insets.top + 12 }]} contentFit="cover" /> : null}
        <View style={[styles.previewBar, { paddingBottom: insets.bottom + space.lg }]}>
          <Button title="Retake" variant="secondary" size="lg" style={styles.previewButton} onPress={() => {
          setCameraReady(false); // the CameraView remounts; wait for its onCameraReady again
          setPhase({ kind: 'camera' });
        }} />
          <Button title="Use photo" size="lg" style={styles.previewButton} onPress={() => submit(phase.front, phase.back)} />
        </View>
      </View>
    );
  }

  // ---------------------------------------------------------------- camera

  const countdown = notOpen ? `opens in ${fmtCountdown(windowStartMs - nowMs)}` : `closes in ${fmtCountdown(windowEndMs - nowMs)}`;
  const canCapture = cameraReady && !capturing && !notOpen;

  return (
    <View style={styles.fill}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        onCameraReady={() => setCameraReady(true)}
        animateShutter={false}
      />

      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={close} hitSlop={12} style={styles.iconButton}>
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.course}>{occurrence.course_code}</Text>
          <Text style={styles.building}>{occurrence.building_code}</Text>
        </View>
        <View style={[styles.countdown, notOpen ? styles.countdownWaiting : null]}>
          <Text style={styles.countdownText}>{countdown}</Text>
        </View>
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + space.xl }]}>
        <View style={styles.sideSlot} />
        <Pressable
          onPress={capture}
          disabled={!canCapture}
          style={({ pressed }) => [styles.shutter, { opacity: canCapture ? (pressed ? 0.7 : 1) : 0.4 }]}
          accessibilityLabel="Take photo"
        >
          {capturing ? <ActivityIndicator color={colors.accentText} /> : <View style={styles.shutterInner} />}
        </Pressable>
        <View style={styles.sideSlot}>
          <Pressable
            onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}
            disabled={capturing}
            hitSlop={12}
            style={styles.iconButton}
            accessibilityLabel="Flip camera"
          >
            <Ionicons name="camera-reverse" size={28} color={colors.text} />
          </Pressable>
        </View>
      </View>

      {!cameraReady ? (
        <View style={styles.readyOverlay} pointerEvents="none">
          <ActivityIndicator color={colors.text} />
        </View>
      ) : null}
      {notOpen ? (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>The window opens 10 minutes before class.</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  dim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,15,18,0.72)' },
  overlayTitle: { color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: space.xs },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    gap: space.md,
  },
  headerText: { flex: 1 },
  course: { color: colors.text, fontSize: 20, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },
  building: { color: colors.text, fontSize: 13, opacity: 0.85, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },
  countdown: {
    backgroundColor: 'rgba(15,15,18,0.7)',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  countdownWaiting: { borderColor: colors.muted },
  countdownText: { color: colors.text, fontWeight: '700', fontVariant: ['tabular-nums'] },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15,15,18,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xxl,
  },
  sideSlot: { width: 60, alignItems: 'center' },
  shutter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.accent,
    borderWidth: 5,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.accent },
  readyOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  hint: { position: 'absolute', bottom: 150, left: 0, right: 0, alignItems: 'center' },
  hintText: {
    color: colors.text,
    backgroundColor: 'rgba(15,15,18,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  inset: {
    position: 'absolute',
    left: 16,
    width: 110,
    height: 150,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.text,
  },
  previewBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    backgroundColor: 'rgba(15,15,18,0.75)',
  },
  previewButton: { flex: 1 },
});
