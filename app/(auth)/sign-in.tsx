import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text } from 'react-native';
import { Button, ErrorText, H1, Input, Muted, Screen, Spacer } from '@/components/ui';
import { UI_PREVIEW } from '@/lib/config';
import { PREVIEW } from '@/lib/preview';
import { useSession } from '@/lib/session';
import { errorMessage } from '@/lib/supabase';
import { colors, fonts, space } from '@/lib/theme';

export default function SignIn() {
  const { signIn } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState(UI_PREVIEW ? PREVIEW.email : '');
  const [password, setPassword] = useState(UI_PREVIEW ? PREVIEW.password : '');
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
          <H1 style={{ textAlign: 'center' }}>Present.</H1>
          <Muted style={{ marginTop: space.sm, fontSize: 16, lineHeight: 22, textAlign: 'center' }}>
            {UI_PREVIEW ? 'UI preview. Tap Sign in. No server needed.' : 'Check in from class. Your circle sees it.'}
          </Muted>
          <Spacer h={space.xxl} />
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
            placeholder="Password"
            secureTextEntry
            textContentType="password"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={onSubmit}
            returnKeyType="go"
          />
          <ErrorText>{error}</ErrorText>
          <Spacer h={space.lg} />
          <Button title="Sign in" size="lg" loading={busy} onPress={onSubmit} />
          <Spacer h={space.lg} />
          <Pressable onPress={() => router.push('/(auth)/sign-up')} hitSlop={8}>
            <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 15, fontFamily: fonts.regular }}>
              New here? <Text style={{ color: colors.accent, fontFamily: fonts.bold }}>Create an account</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
