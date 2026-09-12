import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Button, ErrorText, Input, Screen, Txt, Wordmark } from '@/components/ui';
import { useSession } from '@/lib/session';
import { errorMessage } from '@/lib/supabase';
import { space } from '@/lib/theme';

export default function SignIn() {
  const { signIn } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
      router.replace('/');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: space.xxl }} keyboardShouldPersistTaps="handled">
          <Wordmark size={32} />
          <Txt variant="subhead" tone="secondary" style={{ marginTop: space.sm }}>
            Strava for showing up to class.
          </Txt>
          <View style={{ gap: space.md, marginTop: space.xxl }}>
            <Input
              placeholder="Email"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
            />
            <Input
              placeholder="Password"
              secureTextEntry
              textContentType="password"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={onSubmit}
              returnKeyType="go"
            />
          </View>
          <ErrorText>{error}</ErrorText>
          <Button title="Sign in" size="lg" loading={busy} onPress={onSubmit} style={{ marginTop: space.lg }} />
          <Pressable onPress={() => router.push('/(auth)/sign-up')} hitSlop={8} style={({ pressed }) => ({ marginTop: space.xl, opacity: pressed ? 0.6 : 1 })}>
            <Txt variant="subhead" tone="secondary" align="center">
              New here?{' '}
              <Txt variant="subhead" tone="accent" weight="600">
                Create an account
              </Txt>
            </Txt>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
