import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '#ui/cn';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 font-semibold transition-colors select-none disabled:opacity-50 data-[disabled]:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-on-primary',
        secondary: 'border border-control bg-surface text-fg',
        info: 'border-2 border-info bg-surface text-info',
        ghost: 'bg-transparent text-fg',
        danger: 'bg-danger text-on-danger',
      },
      size: {
        md: 'min-h-target text-base',
        lg: 'min-h-target-lg w-full text-lg',
        icon: 'size-target p-0',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;

/**
 * Button styles for links that look like buttons (`<Link className={buttonClass(…)}>`) and for the
 * native `<button>`s of the startup path (the route error boundary and the update notices), which
 * do not load Base UI's button (TD-63, M5z). A module of its own, so the startup path takes the
 * classes without `#ui/button`; that module re-exports it.
 */
export function buttonClass(options: ButtonVariantProps = {}, className?: string) {
  return cn(buttonVariants(options), className);
}
