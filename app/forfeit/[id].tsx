import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Card, Center, ErrorText, H1, H2, Muted, P, Pill, Row, Screen, Spacer } from '@/components/ui';
import { markForfeitPaid } from '@/lib/api/circle';
import { useCircleState } from '@/lib/circleState';
import { errorMessage } from '@/lib/supabase';
import { colors, space, statusColor } from '@/lib/theme';
import { dayLabel, fmtTime, relative } from '@/lib/time';

export default function ForfeitDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { state, refresh } = useCircleState();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const forfeit = state?.forfeits.find((f) => f.id === id);

  if (!state || !forfeit) {
    return (
      <Screen edges={['left', 'right']}>
        <Center>
          <P>Forfeit not found</P>
          <Spacer />
          <Button title="Close" variant="ghost" onPress={() => router.back()} />
        </Center>
      </Screen>
    );
  }

  const owedByMe = forfeit.owed_by === state.me;
  const others = state.forfeits.filter((f) => f.status === 'owed' && f.id !== forfeit.id);

  const pay = async () => {
    setBusy(true);
    setErr(null);
    try {
      await markForfeitPaid(forfeit.id);
      await refresh();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['left', 'right']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Spacer />
        <Row style={{ justifyContent: 'space-between' }}>
          <H1>{forfeit.owed_by_name}</H1>
          <Pill label={forfeit.status} color={statusColor[forfeit.status] ?? colors.muted} />
        </Row>
        <Spacer h={space.sm} />
        <Text style={{ color: colors.amber, fontSize: 24, fontWeight: '800' }}>{forfeit.description}</Text>
        <Spacer />
        <Card>
          <Muted>Skipped</Muted>
          <P>
            {forfeit.course_code} at {fmtTime(forfeit.starts_at)} · {dayLabel(forfeit.starts_at)}
          </P>
          {forfeit.explanation ? (
            <>
              <Spacer h={space.sm} />
              <Muted>Their explanation</Muted>
              <P style={{ fontStyle: 'italic' }}>“{forfeit.explanation}”</P>
            </>
          ) : null}
          <Spacer h={space.sm} />
          <Muted>Owed since {relative(forfeit.created_at)}</Muted>
        </Card>

        {forfeit.status === 'owed' ? (
          owedByMe ? (
            <Card>
              <Muted>Only your circle can clear this. Pay up, then have someone tap “Mark paid”.</Muted>
            </Card>
          ) : (
            <>
              <Button title="Mark paid" variant="success" size="lg" loading={busy} onPress={pay} />
              <ErrorText>{err}</ErrorText>
            </>
          )
        ) : forfeit.status === 'paid' ? (
          <Card tone={colors.green}>
            <P>
              Paid <Text style={{ color: colors.green, fontWeight: '800' }}>✓</Text>
            </P>
            <Muted>
              Confirmed by {forfeit.paid_by_name ?? 'the circle'}
              {forfeit.paid_at ? ` · ${relative(forfeit.paid_at)}` : ''}
            </Muted>
          </Card>
        ) : (
          <Card tone={colors.faint}>
            <Muted>Voided: the skip was excused. No forfeit owed.</Muted>
          </Card>
        )}

        <Spacer h={space.xl} />
        <H2>Open forfeits in {state.circle?.name ?? 'your circle'}</H2>
        <Spacer h={space.sm} />
        {others.length === 0 ? (
          <Muted>{forfeit.status === 'owed' ? 'Just this one.' : 'Nobody owes anything. Nice.'}</Muted>
        ) : (
          others.map((f) => (
            <Pressable key={f.id} onPress={() => router.push(`/forfeit/${f.id}` as never)}>
              <Card tone={colors.amber}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <P>
                      <Text style={{ fontWeight: '800' }}>{f.owed_by_name}</Text> owes: {f.description}
                    </P>
                    <Muted>
                      {f.course_code} · {dayLabel(f.starts_at)}
                    </Muted>
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 18 }}>›</Text>
                </Row>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
