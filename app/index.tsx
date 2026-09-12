import { Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator } from 'react-native';
import { Button, Center, Muted, P, Screen, Spacer } from '@/components/ui';
import { useCircleState } from '@/lib/circleState';
import { useSession } from '@/lib/session';
import { supabaseConfigured } from '@/lib/supabase';
import { colors } from '@/lib/theme';

function Splash() {
  return (
    <Screen>
      <Center>
        <ActivityIndicator color={colors.accent} />
      </Center>
    </Screen>
  );
}

/** Entry point: decides where a user goes. Every "done" screen does router.replace('/') to come back here. */
export default function Index() {
  const { session, loading } = useSession();
  const { state, loading: stateLoading, error, refresh } = useCircleState();

  if (!supabaseConfigured) {
    return (
      <Screen>
        <Center>
          <P>Supabase isn't configured.</P>
          <Spacer />
          <Muted style={{ textAlign: 'center' }}>
            Copy .env.example to .env, fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart with
            "npx expo start -c".
          </Muted>
        </Center>
      </Screen>
    );
  }
  if (loading) return <Splash />;
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (!state) {
    if (error && !stateLoading) {
      return (
        <Screen>
          <Center>
            <P>Couldn't reach the server.</P>
            <Spacer />
            <Muted style={{ textAlign: 'center' }}>{error}</Muted>
            <Spacer />
            <Button title="Retry" onPress={() => refresh({ maintain: true })} />
          </Center>
        </Screen>
      );
    }
    return <Splash />;
  }
  if (!state.circle) return <Redirect href="/circle" />;
  if (state.my_class_count === 0) return <Redirect href="/schedule?onboarding=1" />;
  return <Redirect href="/(tabs)" />;
}
