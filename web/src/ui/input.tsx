import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cx } from './cx';
import { Txt } from './text';

const fieldClass = 'w-full bg-surface-raised text-text rounded-md px-4 text-body placeholder:text-text-tertiary outline-none appearance-none';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cx(fieldClass, 'h-[var(--input)]', className)} {...props} />;
});

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cx(fieldClass, 'py-3 min-h-[96px] resize-none', className)} {...props} />;
});

/** Label above an input, optional hint or error beneath. */
export function Field({ label, children, hint, error }: { label: string; children: ReactNode; hint?: string; error?: string | null }) {
  return (
    <label className="flex flex-col gap-1.5">
      <Txt variant="footnote" tone="secondary" weight={600}>
        {label}
      </Txt>
      {children}
      {error ? (
        <Txt variant="footnote" tone="danger">
          {error}
        </Txt>
      ) : hint ? (
        <Txt variant="footnote" tone="tertiary">
          {hint}
        </Txt>
      ) : null}
    </label>
  );
}

/** iOS-style segmented control: raised track, overlay thumb. */
export function Segmented<T extends string>({ options, value, onChange, className }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cx('flex bg-surface-raised rounded-md p-[3px]', className)} role="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={cx('flex-1 h-[34px] rounded-[9px] text-subhead font-semibold transition-colors duration-[var(--duration-base)]', on ? 'bg-surface-overlay text-text' : 'text-text-secondary')}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
