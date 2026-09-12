import React from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { colors, fonts } from '@/lib/theme';

/** Slack-weight wordmark in Lato Black. */
export function PresentWordmark({ style }: { style?: StyleProp<TextStyle> }) {
  return (
    <Text style={[styles.wordmark, style]} numberOfLines={1}>
      Present
    </Text>
  );
}

const styles = StyleSheet.create({
  wordmark: {
    color: colors.text,
    fontFamily: fonts.black,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.6,
  },
});
