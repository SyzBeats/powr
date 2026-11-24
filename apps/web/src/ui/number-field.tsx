import { NumberField as BaseNumberField } from '@base-ui/react/number-field';
import { Minus, Plus } from 'lucide-react';
import { useId } from 'react';

/** Stepper with a large value and 48 px buttons (WKT-02 sized for the gym). */
export function NumberField({
  label,
  unit,
  value,
  onChange,
  step,
  min,
  max,
  decrementLabel,
  incrementLabel,
}: {
  label: string;
  unit?: string;
  value: number | null;
  onChange: (value: number | null) => void;
  step: number;
  min: number;
  max: number;
  decrementLabel: string;
  incrementLabel: string;
}) {
  const id = useId();
  return (
    <BaseNumberField.Root
      id={id}
      value={value}
      onValueChange={onChange}
      step={step}
      min={min}
      max={max}
      className="flex flex-col gap-1"
    >
      <label htmlFor={id} className="text-sm font-medium text-fg-muted">
        {label}
      </label>
      <BaseNumberField.Group className="flex items-center gap-2">
        <BaseNumberField.Decrement
          aria-label={decrementLabel}
          className="flex size-target items-center justify-center rounded-xl border border-control bg-surface"
        >
          <Minus aria-hidden="true" />
        </BaseNumberField.Decrement>
        <BaseNumberField.Input className="min-h-target w-full min-w-0 rounded-xl border border-control bg-surface px-3 text-center text-2xl font-semibold tabular" />
        <BaseNumberField.Increment
          aria-label={incrementLabel}
          className="flex size-target items-center justify-center rounded-xl border border-control bg-surface"
        >
          <Plus aria-hidden="true" />
        </BaseNumberField.Increment>
        {unit ? <span className="w-8 text-fg-muted">{unit}</span> : null}
      </BaseNumberField.Group>
    </BaseNumberField.Root>
  );
}
