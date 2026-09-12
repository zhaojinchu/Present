// The two quiet feed lines for the moments before a class: someone heading out, someone nudged.
import { IoHandLeftOutline, IoWalkOutline } from 'react-icons/io5';
import { relative } from '@/lib/time';
import type { FeedEvent } from '@/lib/types';
import { Avatar, Icon, Strong, Txt } from '@/ui';

export function HeadingOutLine({ event, nowMs }: { event: FeedEvent; nowMs: number }) {
  const p = event.payload;
  const name = p.display_name ?? 'Someone';
  return (
    <div className="py-3 px-4 flex items-center gap-3">
      <span className="relative shrink-0">
        <Avatar name={name} src={p.avatar_url} size={40} />
        <span className="absolute -right-0.5 -bottom-0.5 w-5 h-5 rounded-full bg-bg flex items-center justify-center">
          <span className="w-4 h-4 rounded-full bg-text text-text-inverse flex items-center justify-center">
            <Icon icon={IoWalkOutline} size={10} />
          </span>
        </span>
      </span>
      <div className="flex-1 min-w-0">
        <Txt variant="body" lines={2}>
          <Strong>{name}</Strong> is heading to {p.location_text ?? p.course_code ?? 'class'}
          {p.location_text && p.course_code ? <span className="text-text-secondary"> · {p.course_code}</span> : null}
        </Txt>
      </div>
      <Txt variant="footnote" tone="tertiary" className="shrink-0">
        {relative(event.created_at, nowMs)}
      </Txt>
    </div>
  );
}

export function NudgeLine({ event, nowMs, meId }: { event: FeedEvent; nowMs: number; meId: string | null }) {
  const p = event.payload;
  const target = p.target_id === meId ? 'you' : p.target_name ?? 'someone';
  return (
    <div className="py-3 px-4 flex items-center justify-center gap-1.5">
      <Icon icon={IoHandLeftOutline} size={14} className="text-text-tertiary" />
      <Txt variant="footnote" tone="tertiary" align="center">
        <Strong className="text-text-secondary">{p.display_name}</Strong> nudged <Strong className="text-text-secondary">{target}</Strong> about {p.course_code ?? 'class'} · {relative(event.created_at, nowMs)}
      </Txt>
    </div>
  );
}
