import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup } from '@base-ui/react/toggle-group';

import { cn } from '#ui/cn';

export interface SegmentedOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

/** Single-choice segmented control with large touch targets (theme switch, RIR chips). */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <ToggleGroup
      aria-label={label}
      value={value === null ? [] : [value]}
      onValueChange={(next) => {
        const selected = next[0];
        if (selected !== undefined) onChange(selected);
      }}
      className={cn('flex gap-2', className)}
    >
      {options.map((option) => (
        <Toggle
          key={option.value}
          value={option.value}
          className="min-h-target flex-1 rounded-xl border border-border bg-surface px-3 font-medium text-fg data-[pressed]:border-primary data-[pressed]:bg-primary data-[pressed]:text-on-primary"
        >
          {option.label}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
