// "3 friends in class now": avatars with a live dot and the course each is in.
import type { Occurrence } from '@/lib/types';
import { Avatar, Txt } from '@/ui';

export function LiveRow({ inClass }: { inClass: Occurrence[] }) {
  if (inClass.length === 0) return null;
  const shown = inClass.slice(0, 6);
  return (
    <div className="px-4 pb-2">
      <Txt variant="footnote" tone="secondary" className="mb-2">
        {inClass.length === 1 ? '1 friend is in class now' : `${inClass.length} friends are in class now`}
      </Txt>
      <div className="flex gap-4 overflow-x-auto scrollbar-none">
        {shown.map((o) => (
          <div key={o.id} className="flex flex-col items-center gap-1 shrink-0 w-14">
            <span className="relative">
              <Avatar name={o.display_name} src={o.avatar_url} size={40} />
              <span className="absolute right-0 bottom-0 w-3 h-3 rounded-full bg-success ring-2 ring-bg" aria-label="in class" />
            </span>
            <Txt variant="caption" tone="secondary" lines={1} className="w-full text-center">
              {o.course_code}
            </Txt>
          </div>
        ))}
      </div>
    </div>
  );
}
