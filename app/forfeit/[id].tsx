import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Avatar, Badge, Button, Center, ErrorText, Group, ListRow, Row, Screen, SectionLabel, Txt } from '@/components/ui';
import { markForfeitPaid } from '@/lib/api/circle';
import { useCircleState } from '@/lib/circleState';
import { errorMessage } from '@/lib/supabase';
import { space, statusLabel } from '@/lib/theme';
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
          <Txt variant="headline">Forfeit not found</Txt>
          <Button title="Close" variant="tertiary" onPress={() => router.back()} style={{ marginTop: space.md }} />
        </Center>
      </Screen>
    );
  }

  const owedByMe = forfeit.owed_by === state.me;
  const others = state.forfeits.filter((f) => f.status === 'owed' && f.id !== forfeit.id);
  const member = state.members.find((m) => m.id === forfeit.owed_by);
  const tone = forfeit.status === 'owed' ? 'warning' : forfeit.status === 'paid' ? 'success' : 'neutral';

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
      <ScrollView contentContainerStyle={{ paddingTop: space.lg, paddingBottom: space.xxxl }} showsVerticalScrollIndicator={false}>
        <Row gap={space.lg}>
          <Avatar name={forfeit.owed_by_name} uri={member?.avatar_url} size={56} />
          <View style={{ flex: 1 }}>
            <Txt variant="title" numberOfLines={1}>
              {forfeit.owed_by_name}
            </Txt>
            <Badge label={statusLabel[forfeit.status] ?? forfeit.status} tone={tone} style={{ marginTop: 4 }} />
          </View>
        </Row>
        <Txt variant="headline" style={{ marginTop: space.lg }}>
          Owes the circle: {forfeit.description}
        </Txt>

        <SectionLabel>Details</SectionLabel>
        <Group>
          <ListRow title="Skipped" trailing={<Txt variant="subhead" tone="secondary">{`${forfeit.course_code} · ${dayLabel(forfeit.starts_at)} ${fmtTime(forfeit.starts_at)}`}</Txt>} />
          {forfeit.explanation ? (
            <ListRow
              title="Their explanation"
              subtitle={
                <Txt variant="body" tone="secondary">
                  “{forfeit.explanation}”
                </Txt>
              }
            />
          ) : null}
          <ListRow title="Owed since" trailing={<Txt variant="subhead" tone="secondary">{relative(forfeit.created_at)}</Txt>} />
          {forfeit.status === 'paid' ? (
            <ListRow
              title="Paid"
              trailing={
                <Txt variant="subhead" tone="secondary">
                  {forfeit.paid_by_name ?? 'the circle'}
                  {forfeit.paid_at ? ` · ${relative(forfeit.paid_at)}` : ''}
                </Txt>
              }
            />
          ) : null}
        </Group>

        <View style={{ marginTop: space.xl }}>
          {forfeit.status === 'owed' ? (
            owedByMe ? (
              <Txt variant="footnote" tone="secondary" align="center">
                Only your circle can clear this. Pay up, then have someone tap Mark paid.
              </Txt>
            ) : (
              <>
                <Button title="Mark paid" icon="checkmark" size="lg" loading={busy} onPress={pay} />
                <ErrorText>{err}</ErrorText>
              </>
            )
          ) : forfeit.status === 'voided' ? (
            <Txt variant="footnote" tone="secondary" align="center">
              Voided: the skip was excused. Nothing owed.
            </Txt>
          ) : null}
        </View>

        <SectionLabel>Open forfeits in {state.circle?.name ?? 'your circle'}</SectionLabel>
        {others.length === 0 ? (
          <Txt variant="footnote" tone="tertiary">
            {forfeit.status === 'owed' ? 'Just this one.' : 'Nobody owes anything.'}
          </Txt>
        ) : (
          <Group>
            {others.map((f) => (
              <ListRow
                key={f.id}
                leading={<Avatar name={f.owed_by_name} uri={state.members.find((m) => m.id === f.owed_by)?.avatar_url} size={32} />}
                title={
                  <Txt variant="body" numberOfLines={1}>
                    <Txt variant="headline">{f.owed_by_name}</Txt> owes: {f.description}
                  </Txt>
                }
                subtitle={`${f.course_code} · ${dayLabel(f.starts_at)}`}
                onPress={() => router.push(`/forfeit/${f.id}` as never)}
              />
            ))}
          </Group>
        )}
      </ScrollView>
    </Screen>
  );
}
