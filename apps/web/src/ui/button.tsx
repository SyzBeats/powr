import { Button as BaseButton } from '@base-ui/react/button';
import type { ComponentProps } from 'react';

import { buttonVariants, type ButtonVariantProps } from '#ui/button-class';
import { cn } from '#ui/cn';

export { buttonClass } from '#ui/button-class';

export type ButtonProps = ComponentProps<typeof BaseButton> & ButtonVariantProps;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <BaseButton className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
