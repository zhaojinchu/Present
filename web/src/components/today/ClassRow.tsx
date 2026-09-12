// One of my classes today in the list under the hero: time, course, location, status.
import type { Phase } from '@/lib/phase';
import { fmtTime } from '@/lib/time';
import type { Occurrence } from '@/lib/types';
import { ListRow, Txt } from '@/ui';
import { PhaseBadge } from './PromptCard';

export function ClassRow({ occurrence: o, phase, onClick }: { occurrence: Occurrence; phase: Phase; onClick?: () => void }) {
  return (
    <ListRow
      leading={
        <Txt variant="subhead" tabular className="w-[68px]" tone="secondary">
          {fmtTime(o.starts_at)}
        </Txt>
      }
      title={o.course_code}
      subtitle={o.location_text ?? o.name ?? undefined}
      trailing={<PhaseBadge phase={phase} />}
      onClick={onClick}
      chevron={false}
    />
  );
}
