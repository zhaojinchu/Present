import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import type { ColorValue } from 'react-native';
import { useSession } from '@/lib/session';
import { colors, type } from '@/lib/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(outline: IconName, filled: IconName) {
  return ({ color, focused }: { color: ColorValue; focused: boolean }) => <Ionicons name={focused ? filled : outline} size={24} color={color as string} />;
}

export default function TabsLayout() {
  const { session, loading } = useSession();
  if (!loading && !session) return <Redirect href="/(auth)/sign-in" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border, borderTopWidth: 1 },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: { fontSize: type.caption.fontSize, fontWeight: '500' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: tabIcon('today-outline', 'today') }} />
      <Tabs.Screen name="feed" options={{ title: 'Circle', tabBarIcon: tabIcon('people-outline', 'people') }} />
      <Tabs.Screen name="you" options={{ title: 'You', tabBarIcon: tabIcon('person-outline', 'person') }} />
    </Tabs>
  );
}
