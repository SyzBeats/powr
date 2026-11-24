import { Input as InputPrimitive } from '@base-ui/react/input';
import * as React from 'react';

import { cn } from '#ui/cn';

// Added with `shadcn add input` (shadcn 4.23.0, style base-nova), then reviewed (ADR-0003):
// `cn` comes from #ui/cn instead of the `cn` package; POWR tokens instead of shadcn's token names;
// a 48 px target (NFR-A11Y-02); the global :focus-visible outline instead of a ring; no `dark:`
// classes, because the tokens follow the app theme through light-dark() (§8.9.3).
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        'min-h-target w-full min-w-0 rounded-xl border border-border bg-surface px-3 py-1 text-base text-fg transition-colors file:inline-flex file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-fg placeholder:text-fg-muted disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
