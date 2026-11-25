import { Minus, Plus } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

import { cn } from '#ui/cn';

/** A decimal as typed, with a comma or a point; empty or not a number gives null. */
function parseDecimal(text: string): number | null {
  const value = Number(text.replace(',', '.'));
  return text.trim() === '' || !Number.isFinite(value) ? null : value;
}

/**
 * A workout stepper (WKT-02, WKT-03, NFR-USE-01): a large value the user can type into, between
 * a 48 px "less" and "more" button, with the unit next to the value. `onStep` decides what one
 * step is (the next achievable load of the equipment, one rep), so a change of weight or reps
 * takes one to three taps. The input keeps the text as typed while it still means the value
 * (a trailing decimal point survives, like `DecimalField`).
 */
export function Stepper({
  label,
  value,
  onChange,
  onStep,
  unit,
  decrementLabel,
  incrementLabel,
  min = 0,
  max,
  decimal = true,
  hint,
  inline = false,
  className,
}: {
  label: ReactNode;
  value: number | null;
  onChange: (value: number | null) => void;
  /** The value one step down (-1) or up (+1) from `current`, or null when there is none. */
  onStep: (direction: -1 | 1, current: number | null) => number | null;
  unit?: string;
  decrementLabel: string;
  incrementLabel: string;
  min?: number;
  max?: number;
  decimal?: boolean;
  hint?: ReactNode;
  /**
   * The label beside the control instead of above it (the session dock: one stepper per row, so
   * the value can be large, WKT-02 "≥ 1.5× body text"); it wraps above the control when narrow.
   */
  inline?: boolean;
  className?: string;
}) {
  const id = useId();
  const [typed, setTyped] = useState<string | null>(null);
  const shown =
    typed !== null && parseDecimal(typed) === value ? typed : value === null ? '' : String(value);
  const down = onStep(-1, value);
  const up = onStep(1, value);
  const clamp = (next: number) => Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, next));
  return (
    <div
      className={cn(
        inline
          ? 'flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1'
          : 'flex min-w-0 flex-col gap-1',
        className,
      )}
    >
      <label
        htmlFor={id}
        className={cn('text-sm font-medium text-fg-muted', inline && 'min-w-0 flex-[1_1_5.5rem]')}
      >
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-fg-muted">
          {hint}
        </p>
      ) : null}
      <div className={cn('flex items-center gap-2', inline && 'min-w-0 flex-[2_1_14rem]')}>
        <button
          type="button"
          aria-label={decrementLabel}
          disabled={down === null || (value !== null && value <= min)}
          onClick={() => {
            if (down === null) return;
            setTyped(null);
            onChange(clamp(down));
          }}
          className="flex size-target shrink-0 items-center justify-center rounded-xl border border-control bg-surface disabled:opacity-50"
        >
          <Minus aria-hidden="true" />
        </button>
        <span className="flex min-w-0 flex-1 items-center gap-1">
          <input
            id={id}
            inputMode={decimal ? 'decimal' : 'numeric'}
            autoComplete="off"
            aria-describedby={hint ? `${id}-hint` : undefined}
            value={shown}
            onChange={(event) => {
              const text = event.target.value;
              setTyped(text);
              const parsed = parseDecimal(text);
              if (parsed === null) {
                onChange(null);
                return;
              }
              if (parsed >= min && (max === undefined || parsed <= max))
                onChange(decimal ? parsed : Math.round(parsed));
            }}
            onBlur={() => setTyped(null)}
            className="min-h-target w-full min-w-0 rounded-xl border border-control bg-surface px-1 text-center text-2xl font-bold tabular"
          />
          {unit ? <span className="shrink-0 text-fg-muted">{unit}</span> : null}
        </span>
        <button
          type="button"
          aria-label={incrementLabel}
          disabled={up === null || (max !== undefined && value !== null && value >= max)}
          onClick={() => {
            if (up === null) return;
            setTyped(null);
            onChange(clamp(up));
          }}
          className="flex size-target shrink-0 items-center justify-center rounded-xl border border-control bg-surface disabled:opacity-50"
        >
          <Plus aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
