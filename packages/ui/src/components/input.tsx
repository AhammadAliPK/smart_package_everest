/** Input — shadcn-style text field, rounded-sm, ≥44px target (UX-DR18). */

import * as React from 'react';

import { cn } from '../lib/cn.js';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = 'text', ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      'min-h-11 w-full rounded-sm border border-border bg-background px-3',
      'font-sans text-base text-foreground placeholder:text-faint',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'aria-invalid:border-ring',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';
