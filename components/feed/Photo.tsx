import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { usePhotoUrl } from '@/lib/photos';
import { colors, radius } from '@/lib/theme';

/** Renders a storage path through a signed URL. Grey block while loading; nothing if there is no path. */
export function Photo({
  path,
  style,
  aspectRatio = 3 / 4,
}: {
  path: string | null | undefined;
  style?: StyleProp<ViewStyle>;
  aspectRatio?: number;
}) {
  const url = usePhotoUrl(path);
  if (!path) return null;
  return (
    <View style={[styles.wrap, { aspectRatio }, style]}>
      {url ? (
        <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} cachePolicy="memory-disk" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
});
