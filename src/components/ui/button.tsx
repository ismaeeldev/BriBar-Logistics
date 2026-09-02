import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * Sizes are set by the smallest comfortable touch target, not by the text.
 *
 * `default` is 44px tall, which is the WCAG 2.5.5 / iOS HIG minimum. `lg` is
 * 52px and is what the primary action on a driver screen uses — SRS 23.3 asks
 * for large touch targets on primary actions, and a driver may be tapping with
 * gloves on.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ' +
    'transition-colors disabled:pointer-events-none disabled:opacity-50 ' +
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary-hover shadow-xs',
        secondary: 'border border-input bg-card hover:bg-muted',
        ghost: 'hover:bg-muted',
        destructive: 'bg-destructive text-white hover:opacity-90 shadow-xs',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 px-3',
        default: 'h-11 px-4',
        lg: 'h-13 px-6 text-base',
        icon: 'size-11',
      },
      block: {
        true: 'w-full',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
);

export type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, block, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size, block }), className)} {...props} />
  );
}

export { buttonVariants };
