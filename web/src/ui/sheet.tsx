// iOS-style bottom sheet on Vaul: drag handle, spring, scrim. Used for comments, explain, class edit.
import { useEffect, type ReactNode } from 'react';
import { Drawer } from 'vaul';
import { cx } from './cx';
import { Txt } from './text';

export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  // iOS scrolls the (hidden-overflow) document when a field inside the sheet takes focus; on the
  // next open that offset is still there and the sheet appears far down. Pin the document.
  useEffect(() => {
    if (!open) return;
    const pin = () => {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    pin();
    const t = window.setTimeout(pin, 450);
    return () => {
      window.clearTimeout(t);
      pin();
    };
  }, [open]);
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-scrim z-40" />
        <Drawer.Content
          className={cx('fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[430px] bg-bg rounded-t-xl outline-none flex flex-col max-h-[92dvh]', className)}
          aria-describedby={undefined}
        >
          <div className="mx-auto mt-2 mb-1 h-[5px] w-9 rounded-full bg-surface-overlay" aria-hidden />
          <Drawer.Title asChild>
            <Txt variant="headline" align="center" className="px-4 py-2">
              {title}
            </Txt>
          </Drawer.Title>
          <div className="scroll-main px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
