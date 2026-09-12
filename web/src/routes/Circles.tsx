// /circles — my circles and the two ways to start or join one.
import { IoAdd, IoEnterOutline, IoPeopleCircleOutline } from 'react-icons/io5';
import { useNavigate } from 'react-router';
import { Header, Main, Screen } from '@/app/AppShell';
import { useAppState } from '@/lib/appState';
import { Button, EmptyState, Group as GroupList, IconButton, ListRow, StreakChip } from '@/ui';
import { BackButton } from './_Stub';

export default function Circles() {
  const navigate = useNavigate();
  const q = useAppState();
  const groups = q.data?.groups ?? [];

  return (
    <Screen>
      <Header title="Circles" left={<BackButton />} right={<IconButton icon={IoAdd} label="New circle" tone="plain" onClick={() => navigate('/circles/new')} />} />
      <Main>
        {groups.length === 0 ? (
          <EmptyState icon={IoPeopleCircleOutline} title="No circles yet" message="One streak, one set of stakes, for the friends you pick." />
        ) : (
          <GroupList className="mt-2">
            {groups.map((g) => (
              <ListRow
                key={g.id}
                leading={<span className="w-10 h-10 rounded-full bg-surface-raised flex items-center justify-center text-[20px] leading-none">{g.emoji ?? '👥'}</span>}
                title={g.name}
                subtitle={`${g.members.length} ${g.members.length === 1 ? 'member' : 'members'}${g.forfeit_text ? ` · stakes: ${g.forfeit_text}` : ''}`}
                trailing={<StreakChip value={g.streak} size="sm" />}
                onClick={() => navigate(`/circles/${g.id}`)}
              />
            ))}
          </GroupList>
        )}

        <div className="flex flex-col gap-2 mt-6 mb-8">
          <Button title="New circle" size="lg" icon={IoAdd} onClick={() => navigate('/circles/new')} />
          <Button title="Join with a code" variant="secondary" size="lg" icon={IoEnterOutline} onClick={() => navigate('/circles/join')} />
        </div>
      </Main>
    </Screen>
  );
}
