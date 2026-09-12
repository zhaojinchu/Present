// The emoji board: the full set with categories, search and skin tones, drawn with the system's
// own emoji (Apple's on an iPhone). A web page cannot open the keyboard's emoji pane itself, so
// this is the next best thing. The picker and its data load on first open, not with the app.
import { useEffect, useRef, useState } from 'react';
import { Sheet, Spinner } from '@/ui';

type PickerElement = HTMLElement & { remove(): void };

const FREQUENT_KEY = 'emoji-mart.frequently';

/**
 * "Frequently used" means what this person actually reacts with: seed the picker's own store with
 * counts from their reaction history (native emoji -> emoji-mart id), keeping whatever it already
 * counted on this device. Without any history the picker shows nothing special.
 */
function seedFrequent(data: { emojis: Record<string, { skins: { native: string }[] }> }, history: string[]): void {
  if (history.length === 0) return;
  const counts = new Map<string, number>();
  for (const n of history) counts.set(n, (counts.get(n) ?? 0) + 1);
  const idOf = new Map<string, string>();
  for (const [id, e] of Object.entries(data.emojis)) for (const skin of e.skins) idOf.set(skin.native, id);
  let stored: Record<string, number> = {};
  try {
    stored = JSON.parse(localStorage.getItem(FREQUENT_KEY) ?? '{}') as Record<string, number>;
  } catch {
    stored = {};
  }
  for (const [native, c] of counts) {
    const id = idOf.get(native);
    if (id) stored[id] = Math.max(stored[id] ?? 0, c);
  }
  try {
    localStorage.setItem(FREQUENT_KEY, JSON.stringify(stored));
  } catch {
    // no storage: the picker falls back to its own defaults
  }
}

async function mountPicker(host: HTMLDivElement, history: string[], onPick: (emoji: string) => void): Promise<PickerElement> {
  const [{ Picker }, { default: data }] = await Promise.all([import('emoji-mart'), import('@emoji-mart/data')]);
  seedFrequent(data as unknown as { emojis: Record<string, { skins: { native: string }[] }> }, history);
  const picker = new Picker({
    data,
    set: 'native',
    theme: 'light',
    locale: 'en',
    previewPosition: 'none',
    skinTonePosition: 'search',
    navPosition: 'top',
    searchPosition: 'sticky',
    perLine: 8,
    emojiSize: 28,
    emojiButtonSize: 42,
    emojiButtonRadius: '10px',
    maxFrequentRows: 2,
    dynamicWidth: true,
    autoFocus: false,
    onEmojiSelect: (e: { native?: string }) => {
      if (e.native) onPick(e.native);
    },
  }) as unknown as PickerElement;
  picker.style.setProperty('--rgb-accent', '10, 10, 11');
  picker.style.setProperty('--rgb-background', '255, 255, 255');
  picker.style.setProperty('--rgb-input', '242, 242, 245');
  picker.style.setProperty('--font-family', 'inherit');
  picker.style.setProperty('--border-radius', '12px');
  picker.style.setProperty('--shadow', 'none');
  picker.style.setProperty('--category-icon-size', '18px');
  picker.style.height = '100%';
  picker.style.width = '100%';
  host.replaceChildren(picker);
  return picker;
}

export function EmojiSheet({
  open,
  onOpenChange,
  onPick,
  history = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (emoji: string) => void;
  /** Every emoji this person has reacted with (repeats count), for the frequently used row. */
  history?: string[];
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const latest = useRef({ onPick, history });
  latest.current = { onPick, history };

  useEffect(() => {
    if (!open) return;
    let alive = true;
    let picker: PickerElement | null = null;
    setReady(false);
    // The sheet animates in first; the host exists once it has rendered.
    const t = window.setTimeout(() => {
      const host = hostRef.current;
      if (!host || !alive) return;
      void mountPicker(host, latest.current.history, (emoji) => latest.current.onPick(emoji))
        .then((p) => {
          if (!alive) {
            p.remove();
            return;
          }
          picker = p;
          setReady(true);
        })
        .catch(() => setReady(true));
    }, 60);
    return () => {
      alive = false;
      window.clearTimeout(t);
      picker?.remove();
    };
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="React">
      <div
        className="relative h-[min(60dvh,460px)]"
        data-vaul-no-drag
        style={{ touchAction: 'pan-y' }}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerMove={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        {!ready ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner size={22} className="text-text-tertiary" />
          </div>
        ) : null}
        <div ref={hostRef} className="h-full" />
      </div>
    </Sheet>
  );
}
