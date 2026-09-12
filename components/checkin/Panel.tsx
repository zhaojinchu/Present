import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Center, IconBadge, Screen, Stat, Txt, type IconName } from '@/components/ui';
import { space } from '@/lib/theme';

export interface PanelAction {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'destructive' | 'ghost' | 'danger' | 'success';
}

/** Full-screen state panel for every non-camera state of the check-in flow. */
export function Panel({
  icon,
  tone = 'neutral',
  title,
  message,
  stat,
  actions,
}: {
  icon: IconName;
  tone?: 'neutral' | 'accent' | 'success' | 'danger' | 'warning' | 'info';
  title: string;
  message?: string | null;
  /** Optional big number under the message, e.g. the new streak. */
  stat?: { value: React.ReactNode; label: string };
  actions: PanelAction[];
}) {
  return (
    <Screen>
      <Center>
        <IconBadge name={icon} tone={tone} size={80} />
        <Txt variant="largeTitle" align="center" style={styles.title}>
          {title}
        </Txt>
        {message ? (
          <Txt variant="subhead" tone="secondary" align="center" style={styles.message}>
            {message}
          </Txt>
        ) : null}
        {stat ? <Stat size="lg" value={stat.value} label={stat.label} align="center" style={{ marginTop: space.xl }} /> : null}
        <View style={styles.actions}>
          {actions.map((a) => (
            <Button key={a.title} title={a.title} variant={a.variant ?? 'primary'} onPress={a.onPress} size="lg" />
          ))}
        </View>
      </Center>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space.xl },
  message: { marginTop: space.sm, maxWidth: 320 },
  actions: { width: '100%', gap: space.sm, marginTop: space.xxl },
});
