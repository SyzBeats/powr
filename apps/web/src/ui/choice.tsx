import { Checkbox } from '@base-ui/react/checkbox';
import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup } from '@base-ui/react/toggle-group';
import { Check } from 'lucide-react';
import { useId, type ReactNode } from 'react';

import { cn } from '#ui/cn';

export interface ChoiceOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly description?: ReactNode;
}

/**
 * Single choice as large cards (onboarding answers): a radio group with a visible legend. The
 * selected card shows a check icon and a thicker outline, not only a colour (WCAG 1.4.1).
 */
export function ChoiceCards<T extends string>({
  legend,
  hint,
  options,
  value,
  onChange,
  className,
}: {
  legend: string;
  hint?: ReactNode;
  options: readonly ChoiceOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <fieldset className={cn('flex min-w-0 flex-col gap-2', className)}>
      <legend id={`${id}-legend`} className="mb-2 text-lg font-semibold">
        {legend}
      </legend>
      {hint ? <p className="text-fg-muted">{hint}</p> : null}
      <RadioGroup
        aria-labelledby={`${id}-legend`}
        value={value ?? ''}
        onValueChange={(next) => onChange(next as T)}
        className="flex flex-col gap-2"
      >
        {options.map((option) => (
          <label
            key={option.value}
            className="relative flex min-h-target cursor-pointer items-start gap-3 rounded-2xl border border-control bg-surface p-3 has-[[data-checked]]:border-2 has-[[data-checked]]:border-primary"
          >
            <Radio.Root
              value={option.value}
              className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-control data-checked:border-primary data-checked:bg-primary data-checked:text-on-primary"
            >
              <Radio.Indicator className="flex data-unchecked:hidden">
                <Check aria-hidden="true" className="size-4" strokeWidth={3} />
              </Radio.Indicator>
            </Radio.Root>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="font-semibold">{option.label}</span>
              {option.description ? (
                <span className="text-sm text-fg-muted">{option.description}</span>
              ) : null}
            </span>
          </label>
        ))}
      </RadioGroup>
    </fieldset>
  );
}

/**
 * A toggle row like the mock-up's equipment list: the whole row is the checkbox's label (≥ 48 px),
 * the checked state shows a check mark in a filled box.
 */
export function CheckRow({
  label,
  description,
  checked,
  onChange,
  className,
}: {
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <label
      className={cn(
        'relative flex min-h-target cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5',
        className,
      )}
    >
      <Checkbox.Root
        checked={checked}
        onCheckedChange={(next) => onChange(next)}
        className="flex size-6 shrink-0 items-center justify-center rounded-md border-2 border-control data-checked:border-primary data-checked:bg-primary data-checked:text-on-primary"
      >
        <Checkbox.Indicator className="flex data-unchecked:hidden">
          <Check aria-hidden="true" className="size-4" strokeWidth={3} />
        </Checkbox.Indicator>
      </Checkbox.Root>
      <span className="flex min-w-0 flex-col">
        <span>{label}</span>
        {description ? <span className="text-sm text-fg-muted">{description}</span> : null}
      </span>
    </label>
  );
}

/** Multiple choice as wrapping chips (weekdays, priority muscles, avoided patterns). */
export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: readonly { readonly value: T; readonly label: string; readonly disabled?: boolean }[];
  value: readonly T[];
  onChange: (value: T[]) => void;
  className?: string;
}) {
  return (
    <ToggleGroup
      aria-label={label}
      multiple
      value={[...value]}
      onValueChange={(next) => onChange(next)}
      className={cn('flex flex-wrap gap-2', className)}
    >
      {options.map((option) => (
        <Toggle
          key={option.value}
          value={option.value}
          disabled={option.disabled === true && !value.includes(option.value)}
          className="inline-flex min-h-target items-center gap-1.5 rounded-full border border-control bg-surface px-4 font-medium text-fg data-[disabled]:opacity-60 data-[pressed]:border-primary data-[pressed]:bg-primary data-[pressed]:text-on-primary"
        >
          <Check
            aria-hidden="true"
            className="hidden size-4 in-data-[pressed]:inline"
            strokeWidth={3}
          />
          {option.label}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
