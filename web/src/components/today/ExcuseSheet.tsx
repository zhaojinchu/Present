// "Can't make it": the reason is required and public. Shared by the Today card and the lock screen.
import { useState } from 'react';
import { excuseOccurrence } from '@/lib/api/social';
import { useInvalidateState } from '@/lib/appState';
import { EXPLANATION_MAX } from '@/lib/config';
import { haptic } from '@/lib/haptics';
import { errorMessage } from '@/lib/supabase';
import type { Occurrence } from '@/lib/types';
import { Button, ErrorText, Sheet, TextArea, Txt } from '@/ui';

export function ExcuseSheet({ occurrence: o, open, onOpenChange }: { occurrence: Occurrence; open: boolean; onOpenChange: (open: boolean) => void }) {
  const invalidate = useInvalidateState();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const announce = async () => {
    setBusy(true);
    setErr(null);
    try {
      await excuseOccurrence(o.id, reason.trim());
      haptic('success');
      await invalidate();
      onOpenChange(false);
      setReason('');
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={`Can't make ${o.course_code}?`}>
      <Txt variant="subhead" tone="secondary">
        Say why. Everyone sees it.
      </Txt>
      <TextArea value={reason} onChange={(e) => setReason(e.target.value.slice(0, EXPLANATION_MAX))} placeholder="dentist at 2, back for the lab" maxLength={EXPLANATION_MAX} autoFocus className="mt-3" />
      <Txt variant="footnote" tone="tertiary" align="right" tabular className="mt-1">
        {reason.length}/{EXPLANATION_MAX}
      </Txt>
      <Button title="Announce it" size="lg" className="mt-2" loading={busy} disabled={!reason.trim()} onClick={announce} />
      <ErrorText>{err}</ErrorText>
    </Sheet>
  );
}
