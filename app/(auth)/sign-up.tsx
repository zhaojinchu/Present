import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Button, ErrorText, Input, Screen, Txt } from '@/components/ui';
import { useSession } from '@/lib/session';
import { errorMessage } from '@/lib/supabase';
import { space } from '@/lib/theme';

export default function SignUp() {
  const { signUp } = useSession();
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    if (!displayName.trim()) {
      setError('What should your circle call you?');
      return;
    }
    if (!email.trim()) {
      setError('Enter an email.');
      return;
    }
    if (password.length < 6) {
      setError('Password needs at least 6 characters.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await signUp(email, password, displayName);
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
          <Txt variant="largeTitle">Create account</Txt>
          <Txt variant="subhead" tone="secondary" style={{ marginTop: space.sm }}>
            Your circle sees your name and your check-in photos. Nobody else does.
          </Txt>
          <View style={{ gap: space.md, marginTop: space.xxl }}>
            <Input placeholder="Display name" autoCapitalize="words" value={displayName} onChangeText={setDisplayName} />
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
              placeholder="Password (6+ characters)"
              secureTextEntry
              textContentType="newPassword"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={onSubmit}
              returnKeyType="go"
            />
          </View>
          <ErrorText>{error}</ErrorText>
          <Button title="Create account" size="lg" loading={busy} onPress={onSubmit} style={{ marginTop: space.lg }} />
          <Pressable onPress={() => router.back()} hitSlop={8} style={({ pressed }) => ({ marginTop: space.xl, opacity: pressed ? 0.6 : 1 })}>
            <Txt variant="subhead" tone="secondary" align="center">
              Already have an account?{' '}
              <Txt variant="subhead" tone="accent" weight="600">
                Sign in
              </Txt>
            </Txt>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
