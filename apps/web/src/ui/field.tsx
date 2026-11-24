import { CircleAlert } from 'lucide-react';
import { useId, type ComponentProps, type ReactNode } from 'react';

import { cn } from '#ui/cn';
import { Input } from '#ui/input';

/**
 * A labelled text or number input with its hint and error (WCAG 3.3.1–3.3.3): the error is text
 * with an icon, says how to fix it, and is tied to the input with `aria-describedby`.
 */
export function Field({
  label,
  hint,
  error,
  suffix,
  className,
  ...input
}: Omit<ComponentProps<'input'>, 'id'> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  suffix?: ReactNode;
}) {
  const id = useId();
  const described = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-fg-muted">
          {hint}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <Input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={described || undefined}
          className="text-base"
          {...input}
        />
        {suffix ? <span className="shrink-0 text-fg-muted">{suffix}</span> : null}
      </div>
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1 text-sm font-medium text-danger">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
