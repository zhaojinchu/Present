// The circle button in the Present top bar: a badge with how many circles I have, filled when one
// is selected. Opens a sheet listing Everyone plus each circle to filter the feed, and a way into
// the circles screen. Replaces a whole chip row, which cost too much height on a phone.
import { useState } from 'react';
import { IoCheckmark, IoPeopleCircle, IoPeopleCircleOutline, IoPeopleOutline, IoSettingsOutline } from 'react-icons/io5';
import { useNavigate } from 'react-router';
import { type Group } from '@/lib/groups';
import { Button, Group as GroupList, Icon, IconButton, ListRow, Sheet, StreakChip, Txt } from '@/ui';

export function CirclePicker({ circles, value, onChange }: { circles: Group[]; value: string | null; onChange: (id: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const active = circles.find((c) => c.id === value) ?? null;
  const pick = (id: string | null) => {
    onChange(id);
    setOpen(false);
  };
  const tick = <Icon icon={IoCheckmark} size={18} className="text-text" />;

  return (
    <>
      <span className="relative">
        <IconButton icon={active ? IoPeopleCircle : IoPeopleCircleOutline} label={active ? `Showing ${active.name}` : 'Circles'} tone="plain" onClick={() => setOpen(true)} />
        {circles.length > 0 ? (
          <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-text text-text-inverse text-[10px] leading-4 font-semibold text-center tabular-nums pointer-events-none" aria-hidden>
            {circles.length}
          </span>
        ) : null}
      </span>

      <Sheet open={open} onOpenChange={setOpen} title="Show presents from">
        <GroupList>
          <ListRow
            leading={<span className="w-10 h-10 rounded-full bg-surface-raised flex items-center justify-center"><Icon icon={IoPeopleOutline} size={20} className="text-text-secondary" /></span>}
            title="Everyone"
            subtitle="All your friends and circles"
            trailing={value === null ? tick : null}
            chevron={false}
            onClick={() => pick(null)}
          />
          {circles.map((c) => (
            <ListRow
              key={c.id}
              leading={<span className="w-10 h-10 rounded-full bg-surface-raised flex items-center justify-center text-[20px] leading-none">{c.emoji ?? '👥'}</span>}
              title={c.name}
              subtitle={`${c.members.length} ${c.members.length === 1 ? 'member' : 'members'}${c.forfeit_text ? ` · a miss ${c.forfeit_text}` : ''}`}
              trailing={
                <span className="flex items-center gap-2">
                  <StreakChip value={c.streak} size="sm" />
                  {value === c.id ? tick : <span className="w-[18px]" />}
                </span>
              }
              chevron={false}
              onClick={() => pick(c.id)}
            />
          ))}
        </GroupList>
        {circles.length === 0 ? (
          <Txt variant="footnote" tone="secondary" className="mt-3">
            A circle is a private set of friends with one streak and one set of stakes. Make one and only their presents show here.
          </Txt>
        ) : null}
        <Button
          title={circles.length === 0 ? 'Make a circle' : 'Manage circles'}
          variant={circles.length === 0 ? 'primary' : 'secondary'}
          size="lg"
          icon={circles.length === 0 ? IoPeopleCircleOutline : IoSettingsOutline}
          className="mt-3"
          onClick={() => {
            setOpen(false);
            navigate(circles.length === 0 ? '/circles/new' : '/circles');
          }}
        />
      </Sheet>
    </>
  );
}
