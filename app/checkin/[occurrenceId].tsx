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
import { Button, Center, IconButton, Screen, Txt } from '@/components/ui';
import { submitCheckin } from '@/lib/api/checkin';
import { useCircleState } from '@/lib/circleState';
import { useNow } from '@/lib/clock';
import { DUAL_CAPTURE, requireGeofence } from '@/lib/config';
import { evaluate, GeoError, getPosition } from '@/lib/geofence';
import { errorMessage, supabase } from '@/lib/supabase';
import { capture as cam, colors, radius, space, type } from '@/lib/theme';
import { fmtCountdown } from '@/lib/time';
import type { Building } from '@/lib/types';

type PanelIcon = React.ComponentProps<typeof Ionicons>['name'];

type Phase =
  | { kind: 'camera' }
  | { kind: 'preview'; front: string; back: string | null }
  | { kind: 'submitting'; front: string; back: string | null; label: string }
  | { kind: 'success'; streak: number }
  | { kind: 'error'; icon: PanelIcon; title: string; message: string; retry?: () => void; settings?: boolean };

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
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
        icon: 'camera-outline',
        title: 'Camera problem',
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
              icon: 'location-outline',
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
            icon: 'business-outline',
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
              icon: 'location-outline',
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
              icon: 'navigate-outline',
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
          icon: 'alert-circle-outline',
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
          <ActivityIndicator color={colors.textSecondary} />
        </Center>
      </Screen>
    );
  }

  if (!state) {
    return (
      <Panel
        icon="cloud-offline-outline"
        tone="danger"
        title="Can't reach the server"
        message={stateError ?? 'Check your connection and try again.'}
        actions={[
          { title: 'Try again', onPress: () => refresh({ maintain: true }) },
          { title: 'Close', onPress: close, variant: 'tertiary' },
        ]}
      />
    );
  }

  if (!occurrence) {
    return (
      <Panel
        icon="help-circle-outline"
        title="Class not found"
        message="This class is not on your schedule for today."
        actions={[{ title: 'Close', onPress: close, variant: 'secondary' }]}
      />
    );
  }

  if (phase.kind === 'success') {
    return (
      <Panel
        icon="checkmark"
        tone="success"
        title="You're in."
        message={`${occurrence.course_code} · counted for today`}
        stat={{ value: phase.streak, label: phase.streak === 1 ? 'day streak' : 'day streak' }}
        actions={[{ title: 'Done', onPress: close }]}
      />
    );
  }

  if (phase.kind === 'error') {
    const actions = [];
    if (phase.settings) actions.push({ title: 'Open Settings', onPress: openSettings });
    if (phase.retry) actions.push({ title: 'Try again', onPress: phase.retry, variant: phase.settings ? ('secondary' as const) : ('primary' as const) });
    actions.push({ title: 'Close', onPress: close, variant: 'tertiary' as const });
    return <Panel icon={phase.icon} tone="danger" title={phase.title} message={phase.message} actions={actions} />;
  }

  if (occurrence.status !== 'pending') {
    const label = occurrence.status === 'checked_in' ? 'checked in' : occurrence.status;
    return (
      <Panel
        icon={occurrence.status === 'checked_in' ? 'checkmark' : 'ban-outline'}
        tone={occurrence.status === 'checked_in' ? 'success' : 'neutral'}
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
        icon="time-outline"
        tone="danger"
        title="Window closed"
        message={`The check-in window for ${occurrence.course_code} closed. Your circle will hear about it.`}
        actions={[{ title: 'Close', onPress: close, variant: 'secondary' }]}
      />
    );
  }

  if (perm && !perm.granted) {
    return (
      <Panel
        icon="camera-outline"
        title="Camera is off"
        message="Present checks you in with a photo from inside the room. Allow camera access to continue."
        actions={[
          ...(perm.canAskAgain ? [{ title: 'Allow camera', onPress: () => requestPerm().catch(() => {}) }] : [{ title: 'Open Settings', onPress: openSettings }]),
          { title: 'Close', onPress: close, variant: 'tertiary' as const },
        ]}
      />
    );
  }

  if (!perm) {
    return (
      <Screen>
        <Center>
          <ActivityIndicator color={colors.textSecondary} />
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
          <ActivityIndicator color={cam.text} size="large" />
          <Txt variant="title" style={{ marginTop: space.lg, color: cam.text }}>
            {phase.label}…
          </Txt>
          <Txt variant="subhead" style={{ marginTop: space.xs, color: cam.textSecondary }}>
            Hold on a second
          </Txt>
        </Center>
      </View>
    );
  }

  if (phase.kind === 'preview') {
    return (
      <View style={styles.fill}>
        <Image source={{ uri: phase.front }} style={StyleSheet.absoluteFill} contentFit="cover" />
        {phase.back ? <Image source={{ uri: phase.back }} style={[styles.inset, { top: insets.top + space.md }]} contentFit="cover" /> : null}
        <View style={[styles.previewBar, { paddingBottom: insets.bottom + space.lg }]}>
          <Button
            title="Retake"
            variant="secondary"
            size="lg"
            style={styles.previewButton}
            onPress={() => {
              setCameraReady(false); // the CameraView remounts; wait for its onCameraReady again
              setPhase({ kind: 'camera' });
            }}
          />
          <Button title="Use photo" variant="inverse" size="lg" style={styles.previewButton} onPress={() => submit(phase.front, phase.back)} />
        </View>
      </View>
    );
  }

  // ---------------------------------------------------------------- camera

  const countdown = notOpen ? `Opens in ${fmtCountdown(windowStartMs - nowMs)}` : `Closes in ${fmtCountdown(windowEndMs - nowMs)}`;
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
        <IconButton name="close" onPress={close} bg={cam.scrim} color={cam.text} size={40} iconSize={22} accessibilityLabel="Close" />
        <View style={styles.headerText}>
          <Text style={styles.course}>{occurrence.course_code}</Text>
          <Text style={styles.building}>{occurrence.building_code}</Text>
        </View>
        <View style={styles.countdown}>
          {!notOpen ? <View style={styles.liveDot} /> : null}
          <Text style={styles.countdownText}>{countdown}</Text>
        </View>
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + space.xl }]}>
        <View style={styles.sideSlot} />
        <Pressable
          onPress={capture}
          disabled={!canCapture}
          style={({ pressed }) => [styles.shutter, { opacity: canCapture ? 1 : 0.4, transform: [{ scale: pressed ? 0.94 : 1 }] }]}
          accessibilityLabel="Take photo"
        >
          {capturing ? <ActivityIndicator color={cam.bg} /> : <View style={styles.shutterInner} />}
        </Pressable>
        <View style={styles.sideSlot}>
          <IconButton
            name="camera-reverse-outline"
            onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}
            disabled={capturing}
            bg={cam.scrim}
            color={cam.text}
            accessibilityLabel="Flip camera"
          />
        </View>
      </View>

      {!cameraReady ? (
        <View style={styles.readyOverlay} pointerEvents="none">
          <ActivityIndicator color={cam.text} />
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

const shadow = { textShadow: '0 1px 6px rgba(0,0,0,0.6)' } as const;

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: cam.bg },
  dim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)' },
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
  course: { ...type.headline, color: cam.text, ...shadow },
  building: { ...type.footnote, color: cam.text, opacity: 0.85, ...shadow },
  countdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: cam.scrim,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    height: 32,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.ember },
  countdownText: { ...type.subhead, fontWeight: '600', color: cam.text, fontVariant: ['tabular-nums'] },
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
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: cam.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: cam.text },
  readyOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  hint: { position: 'absolute', bottom: 150, left: 0, right: 0, alignItems: 'center' },
  hintText: {
    ...type.footnote,
    color: cam.text,
    backgroundColor: cam.scrim,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  inset: {
    position: 'absolute',
    left: space.lg,
    width: 110,
    height: 147,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: cam.text,
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
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  previewButton: { flex: 1 },
});
