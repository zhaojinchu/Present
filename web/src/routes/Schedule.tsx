// /schedule — my classes, and the way in for imports and manual entry.
import { useQuery } from '@tanstack/react-query';
import { IoAdd, IoCloudDownloadOutline } from 'react-icons/io5';
import { useNavigate } from 'react-router';
import { Header, Main, Screen } from '@/app/AppShell';
import { listMyClasses } from '@/lib/api/schedule';
import { fmtClock, fmtDays } from '@/lib/time';
import { Button, Group, IconButton, ListRow, Skeleton, Txt } from '@/ui';
import { BackButton } from './_Stub';

export const CLASSES_KEY = ['classes'] as const;

export default function Schedule() {
  const navigate = useNavigate();
  const classes = useQuery({ queryKey: CLASSES_KEY, queryFn: listMyClasses });
  const today = new Date().toISOString().slice(0, 10);
  const rows = (classes.data ?? []).filter((c) => !c.term_end || c.term_end >= today);
  return (
    <Screen>
      <Header title="Schedule" left={<BackButton />} right={<IconButton icon={IoAdd} label="Add class" tone="plain" onClick={() => navigate('/schedule/edit')} />} />
      <Main>
        {classes.isPending ? (
          <div className="flex flex-col gap-2 mt-2">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-2 flex flex-col gap-2">
            <Txt variant="subhead" tone="secondary">
              No classes yet. Import your calendar, or add them one at a time.
            </Txt>
            <Button title="Import from calendar" size="lg" icon={IoCloudDownloadOutline} onClick={() => navigate('/schedule/import')} className="mt-2" />
            <Button title="Add a class" variant="secondary" size="lg" icon={IoAdd} onClick={() => navigate('/schedule/edit')} />
          </div>
        ) : (
          <>
            <Group className="mt-2">
              {rows.map((c) => (
                <ListRow
                  key={c.id}
                  title={c.course_code}
                  subtitle={[c.name, c.location_text].filter(Boolean).join(' · ') || undefined}
                  trailing={
                    <span className="text-right">
                      <Txt variant="subhead" tabular>
                        {fmtDays(c.days_of_week)}
                      </Txt>
                      <Txt variant="footnote" tone="secondary" tabular>
                        {fmtClock(c.start_time)}
                      </Txt>
                    </span>
                  }
                  onClick={() => navigate(`/schedule/edit/${c.id}`)}
                />
              ))}
            </Group>
            <Button title="Import from calendar" variant="secondary" size="lg" icon={IoCloudDownloadOutline} onClick={() => navigate('/schedule/import')} className="mt-4" />
            <Txt variant="footnote" tone="tertiary" className="mt-3">
              Posting opens 2 minutes before each class and stays on time for 10 minutes after it starts.
            </Txt>
          </>
        )}
      </Main>
    </Screen>
  );
}
