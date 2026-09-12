import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { Button, Center, Divider, ErrorText, Screen, Txt } from '@/components/ui';
import { excuseSkip, explainSkip } from '@/lib/api/circle';
import { useCircleState } from '@/lib/circleState';
import { EXPLANATION_MAX } from '@/lib/config';
import { errorMessage } from '@/lib/supabase';
import { colors, radius, space, type } from '@/lib/theme';
import { fmtTime } from '@/lib/time';
import type { UnexplainedSkip } from '@/lib/types';

export default function ExplainModal() {
  const { skipId } = useLocalSearchParams<{ skipId: string }>();
  const router = useRouter();
  const { state, refresh } = useCircleState();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<'post' | 'excuse' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // After posting, the refreshed state no longer lists this skip; keep the last resolved one
  // so the form does not flash "Nothing to explain" in the frame before we close.
  const [resolved, setResolved] = useState<UnexplainedSkip | null>(null);

  const raw = Array.isArray(skipId) ? skipId[0] : skipId ?? '';
  const found = raw.startsWith('occ:')
    ? state?.my_unexplained_skips.find((s) => s.occurrence_id === raw.slice(4))
    : state?.my_unexplained_skips.find((s) => s.id === raw);
  if (found && found.id !== resolved?.id) setResolved(found);
  const skip = found ?? resolved;

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/' as never);
  };

  if (!skip) {
    return (
      <Screen>
        <Center>
          <Txt variant="headline">Nothing to explain</Txt>
          <Button title="Close" variant="tertiary" onPress={close} style={{ marginTop: space.md }} />
        </Center>
      </Screen>
    );
  }

  const post = async () => {
    setBusy('post');
    setErr(null);
    try {
      await explainSkip(skip.id, text);
      await refresh();
      close();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const excuse = async () => {
    setBusy('excuse');
    setErr(null);
    try {
      await excuseSkip(skip.id);
      await refresh();
      close();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ paddingTop: space.xl }}>
          <Txt variant="largeTitle">You skipped {skip.course_code}.</Txt>
          <Txt variant="subhead" tone="secondary" style={{ marginTop: space.sm }}>
            {fmtTime(skip.starts_at)} · Your circle is waiting.
          </Txt>
        </View>
        <TextInput
          value={text}
          onChangeText={(t) => setText(t.slice(0, EXPLANATION_MAX))}
          placeholder="One line."
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.accent}
          multiline
          maxLength={EXPLANATION_MAX}
          autoFocus
          style={styles.input}
        />
        <Txt variant="footnote" tone="tertiary" align="right" tabular style={{ marginTop: space.xs }}>
          {text.length}/{EXPLANATION_MAX}
        </Txt>
        <ErrorText>{err}</ErrorText>
        <Button title="Post" size="lg" loading={busy === 'post'} disabled={text.trim().length === 0 || busy !== null} onPress={post} style={{ marginTop: space.md }} />
        <Divider style={{ marginVertical: space.xl }} />
        <Button title="It was sick or emergency" variant="secondary" loading={busy === 'excuse'} disabled={busy !== null} onPress={excuse} />
        <Txt variant="footnote" tone="tertiary" align="center" style={{ marginTop: space.sm }}>
          No forfeit, streak stays. Your circle will see it.
        </Txt>
        <View style={{ flex: 1 }} />
        <Button title="Later" variant="tertiary" onPress={close} style={{ marginBottom: space.xl }} />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    ...type.body,
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    padding: space.lg,
    minHeight: 120,
    textAlignVertical: 'top',
    marginTop: space.xl,
  },
});
