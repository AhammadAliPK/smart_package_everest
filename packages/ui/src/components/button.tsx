/**
 * Button (DESIGN.md components: button-primary + inherited shadcn variants).
 *
 * The `primary` variant is the brand CTA: orange fill, ink text, rounded-md —
 * exactly one visible per view. All variants keep a ≥44px touch target
 * (UX-DR18) and inherit the global brand focus ring.
 */

import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '../lib/cn.js';

export const buttonVariants = cva(
  [
    'inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap',
    'rounded-md px-5 font-sans text-sm font-medium',
    'transition-[opacity,background-color,border-color,color] duration-150',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
    'disabled:pointer-events-none disabled:opacity-50',
  ].join(' '),
  {
    variants: {
      variant: {
        primary: 'bg-brand text-on-brand hover:bg-brand/90 active:opacity-90',
        secondary:
          'border border-border bg-card text-foreground hover:border-brand hover:text-foreground',
        ghost: 'text-foreground hover:bg-muted/10',
      },
    },
    defaultVariants: {
      variant: 'secondary',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant }), className)}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
