import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { colors } from '@/lib/theme';
import { Photo } from './Photo';

const DOUBLE_MS = 280;

/** Instagram-width photo with a BeReal front-camera pip in the corner. Tap the pip to swap. */
export function BeRealMedia({
  face,
  room,
  onDoubleLike,
}: {
  face?: string | null;
  room?: string | null;
  onDoubleLike?: () => void;
}) {
  const { width } = useWindowDimensions();
  const [layoutW, setLayoutW] = useState(0);
  const [swapped, setSwapped] = useState(false);
  const lastTap = useRef(0);
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;

  const hero = swapped ? (face ?? room) : (room ?? face);
  const pip = room && face ? (swapped ? room : face) : null;
  const pipSize = Math.round((layoutW || Math.min(width, 430)) * 0.28);

  const burst = () => {
    heartScale.setValue(0.35);
    heartOpacity.setValue(1);
    Animated.parallel([
      Animated.spring(heartScale, { toValue: 1, friction: 4, useNativeDriver: true }),
      Animated.timing(heartOpacity, { toValue: 0, duration: 520, delay: 380, useNativeDriver: true }),
    ]).start();
  };

  const onHeroPress = () => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_MS) {
      lastTap.current = 0;
      burst();
      onDoubleLike?.();
    } else {
      lastTap.current = now;
    }
  };

  if (!hero) return null;

  return (
    <View style={styles.frame} onLayout={(e) => setLayoutW(e.nativeEvent.layout.width)}>
      <Pressable onPress={onHeroPress}>
        <Photo path={hero} rounded={false} aspectRatio={4 / 5} style={styles.hero} />
      </Pressable>
      {pip ? (
        <Pressable
          onPress={() => setSwapped((s) => !s)}
          style={({ pressed }) => [styles.pip, { width: pipSize }, pressed && { opacity: 0.92 }]}
        >
          <Photo path={pip} rounded={false} aspectRatio={3 / 4} style={styles.pipPhoto} />
        </Pressable>
      ) : null}
      <Animated.View
        pointerEvents="none"
        style={[styles.heartWrap, { opacity: heartOpacity, transform: [{ scale: heartScale }] }]}
      >
        <Ionicons name="heart" size={96} color={colors.white} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: colors.cardAlt, width: '100%' },
  hero: { width: '100%', borderRadius: 0 },
  pip: {
    position: 'absolute',
    top: 12,
    left: 12,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: colors.white,
    overflow: 'hidden',
    backgroundColor: colors.cardAlt,
    boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
    elevation: 6,
  },
  pipPhoto: { width: '100%', borderRadius: 0 },
  heartWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
