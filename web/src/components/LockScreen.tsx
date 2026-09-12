// The blocker. While a class of mine is open and unposted there is nothing else to do in the
// app, so this is the whole screen: one colour, the class, one button, one quiet way out.
import { useState } from 'react';
import { IoCameraOutline } from 'react-icons/io5';
import { useNavigate } from 'react-router';
import { ExcuseSheet } from '@/components/today/ExcuseSheet';
import { useNow } from '@/lib/clock';
import type { InClassLock } from '@/lib/lock';
import { fmtCountdown } from '@/lib/time';
import { Icon } from '@/ui';

export function LockScreen({ lock }: { lock: InClassLock }) {
  const now = useNow(1000);
  const navigate = useNavigate();
  const [excusing, setExcusing] = useState(false);
  const o = lock.occurrence;
  const late = lock.phase === 'late';
  const remaining = Math.max(0, (late ? Date.parse(o.deadline) : Date.parse(o.on_time_until)) - now);
  return (
    <div className="absolute inset-0 flex flex-col text-[#F2F2F5] select-none" style={{ background: '#1C1C1F', colorScheme: 'dark' }} role="dialog" aria-label={`Present from ${o.course_code}`}>
      <div className="safe-top" />
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <span className="text-[13px] font-semibold tracking-[0.08em] uppercase opacity-50">{late ? 'Late' : 'In class'}</span>
        <h1 className="mt-3 text-[40px] leading-[44px] font-bold tracking-tight">{o.course_code}</h1>
        <p className="mt-3 text-[17px] leading-6 opacity-70">{late ? 'Present late to unlock.' : 'Present to unlock.'}</p>
        <p className="mt-1 text-[15px] leading-5 opacity-50 tabular">
          {fmtCountdown(remaining)} {late ? 'until it counts as missed' : 'to stay on time'}
        </p>
      </div>
      <div className="flex flex-col items-center gap-3 px-6 pb-[calc(env(safe-area-inset-bottom)+28px)]">
        <button
          type="button"
          onClick={() => navigate(`/post/${o.id}`)}
          className="lock-pulse pressable w-full h-[var(--button-lg)] rounded-md bg-[#F2F2F5] text-[#0A0A0B] text-headline inline-flex items-center justify-center gap-2"
        >
          <Icon icon={IoCameraOutline} size={20} />
          Present
        </button>
        <button type="button" onClick={() => setExcusing(true)} className="pressable text-[15px] leading-5 opacity-50 py-2 px-4">
          Can't make it
        </button>
      </div>
      <ExcuseSheet occurrence={o} open={excusing} onOpenChange={setExcusing} />
    </div>
  );
}
