// Haptic ticks. Android: navigator.vibrate. iOS Safari has no vibration API, but toggling a
// `<input type="checkbox" switch>` plays the system switch haptic (iOS 17.4+; from a user gesture),
// so a hidden one is clicked instead. Always safe to call; a no-op where nothing is available.
export type HapticKind = 'light' | 'medium' | 'success' | 'error';

let toggle: HTMLInputElement | null = null;
function switchInput(): HTMLInputElement | null {
  if (typeof document === 'undefined') return null;
  if (toggle) return toggle;
  const label = document.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  label.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.tabIndex = -1;
  label.appendChild(input);
  document.body.appendChild(label);
  toggle = input;
  return toggle;
}

const PATTERN: Record<HapticKind, number | number[]> = { light: 8, medium: 16, success: [10, 40, 12], error: [24, 40, 24, 40, 24] };

export function haptic(kind: HapticKind = 'light'): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' && navigator.vibrate(PATTERN[kind])) return;
  } catch {
    // ignore
  }
  try {
    const el = switchInput();
    if (!el) return;
    el.click();
    if (kind === 'success') window.setTimeout(() => el.click(), 90);
    if (kind === 'error') {
      window.setTimeout(() => el.click(), 80);
      window.setTimeout(() => el.click(), 160);
    }
  } catch {
    // ignore
  }
}
