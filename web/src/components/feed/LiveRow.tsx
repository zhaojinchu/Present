// "3 friends are in class now": one avatar per friend with a live dot and their first name. The
// class does not matter here, only who is in one. Tap an avatar to open their profile.
import { ProfileLink } from '@/components/ProfileLink';
import { onePerPerson } from '@/lib/phase';
import type { Occurrence } from '@/lib/types';
import { Avatar, Txt } from '@/ui';

export function LiveRow({ inClass: raw }: { inClass: Occurrence[] }) {
  const inClass = onePerPerson(raw);
  if (inClass.length === 0) return null;
  const shown = inClass.slice(0, 8);
  return (
    <div className="px-4 pb-2">
      <Txt variant="footnote" tone="secondary" className="mb-2">
        {inClass.length === 1 ? '1 friend is in class now' : `${inClass.length} friends are in class now`}
      </Txt>
      <div className="flex gap-4 overflow-x-auto scrollbar-none">
        {shown.map((o) => (
          <ProfileLink key={o.user_id} username={o.username} className="flex flex-col items-center gap-1 shrink-0 w-14" label={`${o.display_name}, in class`}>
            <span className="relative">
              <Avatar name={o.display_name} src={o.avatar_url} size={40} />
              <span className="absolute right-0 bottom-0 w-3 h-3 rounded-full bg-success ring-2 ring-bg" aria-hidden />
            </span>
            <Txt variant="caption" tone="secondary" lines={1} className="w-full text-center">
              {o.display_name.split(' ')[0]}
            </Txt>
          </ProfileLink>
        ))}
      </div>
    </div>
  );
}
