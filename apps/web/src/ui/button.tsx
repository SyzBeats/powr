import { Button as BaseButton } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from './cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 font-semibold transition-colors select-none disabled:opacity-50 data-[disabled]:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-on-primary',
        secondary: 'border border-border bg-surface text-fg',
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

export type ButtonProps = ComponentProps<typeof BaseButton> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <BaseButton className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
