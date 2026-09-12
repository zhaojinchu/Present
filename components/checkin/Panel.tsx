import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Center, H1, Muted, Screen, Spacer } from '@/components/ui';
import { colors, space } from '@/lib/theme';

export interface PanelAction {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
}

/** Full-screen dark panel for every non-camera state of the check-in flow. */
export function Panel({
  icon,
  title,
  message,
  actions,
  tone,
}: {
  icon?: string;
  title: string;
  message?: string | null;
  actions: PanelAction[];
  tone?: string;
}) {
  return (
    <Screen>
      <Center>
        {icon ? <Text style={[styles.icon, tone ? { color: tone } : null]}>{icon}</Text> : null}
        <H1 style={styles.title}>{title}</H1>
        {message ? (
          <>
            <Spacer h={space.sm} />
            <Muted style={styles.message}>{message}</Muted>
          </>
        ) : null}
        <Spacer h={space.xl} />
        <View style={styles.actions}>
          {actions.map((a) => (
            <Button key={a.title} title={a.title} variant={a.variant ?? 'primary'} onPress={a.onPress} size="lg" style={styles.action} />
          ))}
        </View>
      </Center>
    </Screen>
  );
}

const styles = StyleSheet.create({
  icon: { fontSize: 72, marginBottom: space.md, color: colors.text },
  title: { textAlign: 'center' },
  message: { textAlign: 'center', fontSize: 16, lineHeight: 22 },
  actions: { width: '100%', gap: space.md },
  action: { width: '100%' },
});
