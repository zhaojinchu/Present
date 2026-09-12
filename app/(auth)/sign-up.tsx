import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text } from 'react-native';
import { Button, ErrorText, H1, Input, Muted, Screen, Spacer } from '@/components/ui';
import { useSession } from '@/lib/session';
import { errorMessage } from '@/lib/supabase';
import { colors, fonts, space } from '@/lib/theme';

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
          <H1>Create account</H1>
          <Muted style={{ marginTop: space.sm, fontSize: 16, lineHeight: 22 }}>Your circle sees your name and your check-in photos. Nobody else does.</Muted>
          <Spacer h={space.xxl} />
          <Input placeholder="Display name" autoCapitalize="words" value={displayName} onChangeText={setDisplayName} />
          <Spacer h={space.sm} />
          <Input
            placeholder="Email"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
          />
          <Spacer h={space.sm} />
          <Input
            placeholder="Password (6+ characters)"
            secureTextEntry
            textContentType="newPassword"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={onSubmit}
            returnKeyType="go"
          />
          <ErrorText>{error}</ErrorText>
          <Spacer h={space.lg} />
          <Button title="Create account" size="lg" loading={busy} onPress={onSubmit} />
          <Spacer h={space.lg} />
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 15, fontFamily: fonts.regular }}>
              Already have an account? <Text style={{ color: colors.accent, fontFamily: fonts.bold }}>Sign in</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
