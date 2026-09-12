import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

export const unstable_settings = {
  initialRouteName: 'feed',
};

export default function TabsLayout() {
  const { session, loading } = useSession();
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.backgroundColor;
    const prevBody = body.style.backgroundColor;
    html.style.backgroundColor = colors.bg;
    body.style.backgroundColor = colors.bg;
    const root = document.getElementById('root');
    const prevRoot = root ? root.getAttribute('style') : null;
    if (root) {
      root.style.maxWidth = '430px';
      root.style.margin = '0 auto';
      root.style.minHeight = '100vh';
      root.style.backgroundColor = colors.bg;
      root.style.boxShadow = `0 0 0 1px ${colors.igHairline}`;
    }
    return () => {
      html.style.backgroundColor = prevHtml;
      body.style.backgroundColor = prevBody;
      if (root) {
        if (prevRoot == null) root.removeAttribute('style');
        else root.setAttribute('style', prevRoot);
      }
    };
  }, []);
  if (!loading && !session) return <Redirect href="/(auth)/sign-in" />;
  return (
    <View style={styles.shell}>
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.bg },
          tabBarShowLabel: false,
          tabBarStyle: {
            backgroundColor: colors.bg,
            borderTopColor: colors.igHairline,
            borderTopWidth: StyleSheet.hairlineWidth,
          },
          tabBarActiveTintColor: colors.text,
          tabBarInactiveTintColor: colors.text,
        }}
      >
        <Tabs.Screen
          name="feed"
          options={{
            title: 'Home',
            tabBarIcon: ({ focused, color }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={26} color={color} />,
          }}
        />
        <Tabs.Screen
          name="index"
          options={{
            title: 'Today',
            tabBarIcon: ({ focused, color }) => (
              <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={26} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="you"
          options={{
            title: 'Profile',
            tabBarIcon: ({ focused, color }) => <Ionicons name={focused ? 'person' : 'person-outline'} size={26} color={color} />,
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 430 : undefined,
    alignSelf: 'center',
    backgroundColor: colors.bg,
    ...(Platform.OS === 'web'
      ? {
          borderLeftWidth: StyleSheet.hairlineWidth,
          borderRightWidth: StyleSheet.hairlineWidth,
          borderColor: colors.igHairline,
        }
      : null),
  },
});
