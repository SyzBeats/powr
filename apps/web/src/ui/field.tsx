import { CircleAlert } from 'lucide-react';
import { useId, useState, type ComponentProps, type ReactNode } from 'react';

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

/** A decimal as typed, with a comma or a point; empty or not a number gives null. */
function parseDecimal(text: string): number | null {
  const value = Number(text.replace(',', '.'));
  return text.trim() === '' || !Number.isFinite(value) ? null : value;
}

/**
 * A text field for a decimal number (body weight, height). A controlled input that showed the
 * parsed number would drop a trailing point while the user types ("80." is 80, so "80.5" became
 * "805"). This field shows the text as typed while it still means the current value, and the
 * value itself when it changes from outside (a draft that loads, a reset).
 */
export function DecimalField({
  value,
  onValueChange,
  ...field
}: Omit<ComponentProps<typeof Field>, 'value' | 'onChange' | 'inputMode'> & {
  value: number | null;
  onValueChange: (value: number | null) => void;
}) {
  const [typed, setTyped] = useState<string | null>(null);
  const shown =
    typed !== null && parseDecimal(typed) === value ? typed : value === null ? '' : String(value);
  return (
    <Field
      {...field}
      inputMode="decimal"
      value={shown}
      onChange={(event) => {
        setTyped(event.target.value);
        onValueChange(parseDecimal(event.target.value));
      }}
    />
  );
}
