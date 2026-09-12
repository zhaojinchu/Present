// /you — my profile: streak, best, posts, memories grid, friends, schedule, settings.
import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import { IoCalendarOutline, IoPeopleCircleOutline, IoPeopleOutline, IoQrCodeOutline, IoSettingsOutline } from 'react-icons/io5';
import { useNavigate } from 'react-router';
import { Header, Main, Screen } from '@/app/AppShell';
import { PostMedia } from '@/components/feed/PostMedia';
import { WeekStats } from '@/components/you/WeekStats';
import { getMemories } from '@/lib/api/post';
import { useAppState, useFriends, useMe } from '@/lib/appState';
import { env } from '@/lib/config';
import { fmtDate } from '@/lib/time';
import { Avatar, Group, IconButton, ListRow, Skeleton, Txt } from '@/ui';

export default function You() {
  const me = useMe();
  const { friends, requests } = useFriends();
  const groups = useAppState().data?.groups ?? [];
  const navigate = useNavigate();
  const taps = useRef(0);
  const memories = useQuery({ queryKey: ['memories'], queryFn: getMemories, enabled: !!me, staleTime: 30_000 });

  const onAvatarTap = () => {
    if (!env.devPanel) return;
    taps.current += 1;
    window.setTimeout(() => (taps.current = 0), 2500);
    if (taps.current >= 5) {
      taps.current = 0;
      navigate('/dev');
    }
  };

  return (
    <Screen tabs>
      <Header title="You" large right={<IconButton icon={IoSettingsOutline} label="Settings" tone="plain" onClick={() => navigate('/settings')} />} />
      <Main>
        {me ? (
          <>
            <button type="button" className="flex items-center gap-4 w-full text-left" onClick={onAvatarTap} aria-label="Profile photo">
              <Avatar name={me.display_name} src={me.avatar_url} size={72} />
              <span className="min-w-0">
                <Txt variant="title" lines={1}>
                  {me.display_name}
                </Txt>
                <Txt variant="subhead" tone="secondary">
                  @{me.username}
                </Txt>
              </span>
            </button>
          </>
        ) : (
          <Skeleton className="h-24" />
        )}

        <WeekStats className="mt-5" />

        <Group className="mt-6">
          <ListRow leading={<IoPeopleOutline size={20} className="text-text-secondary" />} title="Friends" subtitle={requests.incoming.length > 0 ? `${requests.incoming.length} request${requests.incoming.length > 1 ? 's' : ''} waiting` : `${friends.length} friend${friends.length === 1 ? '' : 's'}`} onClick={() => navigate('/friends')} />
          <ListRow leading={<IoPeopleCircleOutline size={20} className="text-text-secondary" />} title="Circles" subtitle={groups.length > 0 ? groups.map((g) => g.name).join(', ') : undefined} onClick={() => navigate('/circles')} />
          <ListRow leading={<IoQrCodeOutline size={20} className="text-text-secondary" />} title="Share my link" onClick={() => navigate('/friends/share')} />
          <ListRow leading={<IoCalendarOutline size={20} className="text-text-secondary" />} title="Schedule" subtitle={me ? `${me.class_count} class${me.class_count === 1 ? '' : 'es'}` : undefined} onClick={() => navigate('/schedule')} />
        </Group>

        <Txt variant="label" tone="tertiary" className="mt-6 mb-2">
          Memories
        </Txt>
        {memories.isPending ? (
          <div className="grid grid-cols-3 gap-1">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} style={{ aspectRatio: '3 / 4' }} />
            ))}
          </div>
        ) : memories.data && memories.data.length > 0 ? (
          <div className="grid grid-cols-3 gap-1">
            {memories.data.map((m) => (
              <div key={m.id} className="relative">
                <PostMedia mainPath={m.photo_path} insetPath={m.photo_back_path} rounded="rounded-sm" placeholder={m.course_code} />
                <span className="absolute left-1.5 bottom-1.5 rounded-full bg-scrim text-text-inverse text-[10px] leading-4 px-1.5 font-semibold">{fmtDate(m.starts_at)}</span>
              </div>
            ))}
          </div>
        ) : (
          <Txt variant="subhead" tone="tertiary">
            Your posts from the last 30 days will show here.
          </Txt>
        )}
        <Txt variant="footnote" tone="tertiary" className="mt-3 mb-8">
          Presents are kept for 30 days.
        </Txt>
      </Main>
    </Screen>
  );
}
