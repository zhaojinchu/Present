// The moment after posting: the photo dims, a check, the streak counts up, who else is there.
import { useEffect, useState } from 'react';
import { IoCheckmark, IoTimeOutline } from 'react-icons/io5';
import type { CreatePostResult } from '@/lib/api/post';
import type { Occurrence } from '@/lib/types';
import { AvatarStack, IconBadge, Stat, Txt } from '@/ui';

function useCountUp(from: number, to: number, ms = 600): number {
  const [v, setV] = useState(from);
  useEffect(() => {
    if (from === to) {
      setV(to);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      setV(Math.round(from + (to - from) * eased));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to, ms]);
  return v;
}

export function PostSuccess({ frontUrl, result, previousStreak, friendsThere, courseCode }: { frontUrl: string; result: CreatePostResult; previousStreak: number; friendsThere: Occurrence[]; courseCode: string }) {
  const streak = useCountUp(previousStreak, result.streak_after);
  const names = friendsThere.map((f) => f.display_name.split(' ')[0]);
  const thereLine = names.length === 0 ? null : names.length === 1 ? `${names[0]} is there too` : names.length === 2 ? `${names[0]} and ${names[1]} are there too` : `${names[0]}, ${names[1]} and ${names.length - 2} more are there too`;
  return (
    <div className="capture relative flex flex-col h-full">
      <img src={frontUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">
        <IconBadge icon={result.late ? IoTimeOutline : IoCheckmark} tone={result.late ? 'warning' : 'success'} size={80} />
        <Txt variant="largeTitle" tone="capture" className="mt-6">
          {result.late ? 'Posted late.' : "You're in."}
        </Txt>
        <Txt variant="subhead" tone="captureSecondary" className="mt-1">
          {result.late ? `Your friends see you made it to ${courseCode}.` : result.location_verified ? `Nearby, on time, from ${courseCode}.` : `On time, from ${courseCode}.`}
        </Txt>
        <Stat size="lg" value={streak} label={result.late ? 'Streak unchanged' : 'Day streak'} tone="capture" align="center" className="mt-8" />
        {thereLine ? (
          <div className="flex items-center gap-2 mt-8">
            <AvatarStack people={friendsThere.map((f) => ({ name: f.display_name, src: f.avatar_url }))} size={28} />
            <Txt variant="subhead" tone="capture">
              {thereLine}
            </Txt>
          </div>
        ) : null}
      </div>
    </div>
  );
}
