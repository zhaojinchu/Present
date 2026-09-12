// One-line hint on iOS Safari when the app is not yet on the home screen. Full-screen mode, the
// icon and camera permissions that stick all come from installing it.
import { useState } from 'react';
import { IoClose, IoShareOutline } from 'react-icons/io5';
import { prefs } from '@/lib/prefs';
import { Icon, Txt } from '@/ui';

function shouldShow(): boolean {
  if (typeof window === 'undefined') return false;
  if (prefs.get('install_hint_dismissed')) return false;
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

export function InstallHint() {
  const [show, setShow] = useState(shouldShow);
  if (!show) return null;
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-surface">
      <Icon icon={IoShareOutline} size={20} className="text-text-secondary shrink-0" />
      <Txt variant="footnote" tone="secondary" className="flex-1">
        Add Present to your Home Screen: tap <span className="font-semibold text-text">Share</span>, then <span className="font-semibold text-text">Add to Home Screen</span>.
      </Txt>
      <button
        type="button"
        aria-label="Dismiss"
        className="pressable p-1 text-text-tertiary"
        onClick={() => {
          prefs.set('install_hint_dismissed', true);
          setShow(false);
        }}
      >
        <Icon icon={IoClose} size={18} />
      </button>
    </div>
  );
}
