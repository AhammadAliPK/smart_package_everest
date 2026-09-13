/** Separator — hairline rule; the ledger's only chrome (DESIGN.md charge summary). */

import * as React from 'react';

import { cn } from '../lib/cn.js';

export const Separator = React.forwardRef<
  HTMLHRElement,
  React.HTMLAttributes<HTMLHRElement>
>(({ className, ...props }, ref) => (
  <hr
    ref={ref}
    className={cn('border-0 border-t border-border', className)}
    {...props}
  />
));
Separator.displayName = 'Separator';
