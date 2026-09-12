// Skeletons, empty states and toasts.
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cx } from './cx';
import { IconBadge, type IconType } from './icon';
import { Txt } from './text';

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cx('bg-surface-raised rounded-md animate-pulse', className)} style={style} aria-hidden />;
}

export function EmptyState({ icon, title, message, action, className }: { icon: IconType; title: string; message?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex flex-col items-center text-center py-12 px-6', className)}>
      <IconBadge icon={icon} size={56} />
      <Txt variant="headline" align="center" className="mt-3">
        {title}
      </Txt>
      {message ? (
        <Txt variant="subhead" tone="secondary" align="center" className="mt-1 max-w-[300px]">
          {message}
        </Txt>
      ) : null}
      {action ? <div className="mt-4 w-full">{action}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------- toast

interface Toast {
  id: number;
  text: string;
}
const ToastCtx = createContext<(text: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const show = useCallback((text: string) => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2200);
  }, []);
  const value = useMemo(() => show, [show]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar)+env(safe-area-inset-bottom)+12px)] z-[60] flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="bg-text text-text-inverse rounded-full px-4 py-2 text-subhead font-semibold shadow-none"
              role="status"
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
