import { Input as InputPrimitive } from '@base-ui/react/input';
import * as React from 'react';

import { cn } from '#ui/cn';

// `pnpm --filter @powr/web ui:add input` (shadcn 4.23.0, style base-nova): the script points the
// `cn` import at #ui/cn, and the colour bridge in app.css resolves shadcn's colour names (input,
// ring, destructive, …) to POWR tokens; `dark:` follows the app theme. Reviewed (ADR-0003, TD-21):
// a 48 px target instead of `h-8` (NFR-A11Y-02), a POWR control radius, the global :focus-visible
// outline instead of `outline-none` + a 50% ring (< 3:1), and no `dark:aria-invalid:border-
// destructive/50`, which would halve the error border's contrast.
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        'min-h-target w-full min-w-0 rounded-xl border border-input bg-transparent px-2.5 py-1 text-base transition-colors file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:ring-destructive/40',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
