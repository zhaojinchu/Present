// The circle button in the Present top bar: a hand-drawn glyph of three people inside a ring (not an
// icon-library glyph, so it never reads as the two-people friends icon, and no count badge, so it
// never reads as a notification). With a circle selected the ring holds that circle's emoji. Opens a
// sheet listing Everyone plus each circle to filter the feed, and a way into the circles screen.
import { useState } from 'react';
import { IoCheckmark, IoPeopleCircleOutline, IoPeopleOutline, IoSettingsOutline } from 'react-icons/io5';
import { useNavigate } from 'react-router';
import { type Group } from '@/lib/groups';
import { Button, cx, Group as GroupList, Icon, ListRow, Sheet, StreakChip, Txt } from '@/ui';

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
      <button type="button" aria-label={active ? `Showing ${active.name}` : 'Circles'} onClick={() => setOpen(true)} className="pressable inline-flex items-center justify-center rounded-full shrink-0 w-11 h-11 text-text">
        {active ? (
          <span className={cx('flex items-center justify-center rounded-full border-[1.75px] border-current w-[23px] h-[23px] text-[12px] leading-none bg-surface-raised')} aria-hidden>
            {active.emoji ?? active.name.slice(0, 1).toUpperCase()}
          </span>
        ) : (
          <PeopleInRing size={22} />
        )}
      </button>

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
            Make a circle and only its presents show here.
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

/** Three people inside a ring. Drawn here so it is unmistakably not the friends icon. */
function PeopleInRing({ size }: { size: number }) {
  const person = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <circle cx={x} cy={y} r={1.6} fill="currentColor" />
      <path d={`M ${x - 2.4} ${y + 4.9} a 2.4 2.4 0 0 1 4.8 0 Z`} fill="currentColor" />
    </g>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable="false">
      <circle cx="12" cy="12" r="10.25" fill="none" stroke="currentColor" strokeWidth="1.75" />
      {person(12, 7.4)}
      {person(7.9, 13.2)}
      {person(16.1, 13.2)}
    </svg>
  );
}
