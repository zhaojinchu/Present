import {
  Lato_400Regular,
  Lato_400Regular_Italic,
  Lato_700Bold,
  Lato_900Black,
  useFonts,
} from '@expo-google-fonts/lato';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Pressable, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppEffects } from '@/components/AppEffects';
import { CircleStateProvider } from '@/lib/circleState';
import { configureNotifications } from '@/lib/notifications';
import { SessionProvider } from '@/lib/session';
import { colors, fonts } from '@/lib/theme';

configureNotifications();

// iOS native-stack modals show no back button; give them an explicit Close.
function HeaderClose() {
  const router = useRouter();
  return (
    <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={12} style={{ paddingHorizontal: 4 }}>
      <Text style={{ color: colors.text, fontSize: 16, fontFamily: fonts.bold }}>Close</Text>
    </Pressable>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    Lato_400Regular,
    Lato_400Regular_Italic,
    Lato_700Bold,
    Lato_900Black,
  });
  if (!loaded) return null;
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <CircleStateProvider>
          <StatusBar style="dark" />
          <AppEffects />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
              headerStyle: { backgroundColor: colors.bg },
              headerTintColor: colors.text,
              headerTitleStyle: { color: colors.text, fontFamily: fonts.bold },
              headerShadowVisible: false,
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="checkin/[occurrenceId]" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
            <Stack.Screen name="explain/[skipId]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="forfeit/[id]" options={{ headerShown: true, title: 'Forfeit' }} />
            <Stack.Screen name="circle/index" />
            <Stack.Screen name="schedule/index" options={{ headerShown: true, title: 'Your schedule' }} />
            <Stack.Screen
              name="schedule/edit"
              options={{ presentation: 'modal', headerShown: true, title: 'Class', headerLeft: () => <HeaderClose /> }}
            />
            <Stack.Screen
              name="dev"
              options={{ presentation: 'modal', headerShown: true, title: 'Demo controls', headerLeft: () => <HeaderClose /> }}
            />
          </Stack>
        </CircleStateProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
