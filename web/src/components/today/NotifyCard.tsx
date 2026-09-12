// One-time nudge on Today: turn on notifications (class opening, friend requests, comments).
// Shows only while it can lead somewhere: permission not asked yet, or the app not yet installed.
import { useEffect, useState } from 'react';
import { IoClose, IoNotificationsOutline } from 'react-icons/io5';
import { prefs } from '@/lib/prefs';
import { enablePush, pushStatus, type PushStatus } from '@/lib/push';
import { errorMessage } from '@/lib/supabase';
import { Button, Card, Icon, Txt, useToast } from '@/ui';

export function NotifyCard({ className }: { className?: string }) {
  const toast = useToast();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [gone, setGone] = useState(() => !!prefs.get('notify_dismissed'));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void pushStatus().then(setStatus);
  }, []);
  if (gone || (status !== 'prompt' && status !== 'install')) return null;

  const dismiss = () => {
    prefs.set('notify_dismissed', true);
    setGone(true);
  };
  const turnOn = async () => {
    setBusy(true);
    try {
      const s = await enablePush();
      setStatus(s);
      if (s === 'on') {
        toast('Notifications on');
        dismiss();
      } else if (s === 'denied') toast('Notifications are blocked for Present in Settings');
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={className}>
      <div className="flex items-start gap-3">
        <Icon icon={IoNotificationsOutline} size={22} className="text-text mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <Txt variant="headline">Get a buzz when a class opens</Txt>
          <Txt variant="footnote" tone="secondary" className="mt-0.5">
            {status === 'install' ? 'Add Present to your Home Screen (Share, then Add to Home Screen), then turn notifications on here.' : 'Also friend requests, comments, and the moment you miss a class.'}
          </Txt>
        </div>
        <button type="button" aria-label="Not now" className="pressable p-1 -mr-1 text-text-tertiary" onClick={dismiss}>
          <Icon icon={IoClose} size={18} />
        </button>
      </div>
      {status === 'prompt' ? <Button title="Turn on notifications" size="lg" className="mt-3" loading={busy} onClick={turnOn} /> : null}
    </Card>
  );
}
