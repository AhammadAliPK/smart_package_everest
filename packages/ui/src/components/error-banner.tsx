/**
 * ErrorBanner (EXPERIENCE.md Component Patterns).
 *
 * Calm, blame-free, physical-world copy only. Renders *above* the submit
 * button, politely announced, never destructive-red — a capacity refusal is
 * an operational fact, not an alarm. The caller owns the copy (mapped from
 * the AD-7 code); this component only renders it.
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';

export interface ErrorBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The human sentence, already mapped from the AD-7 code by the caller. */
  children: React.ReactNode;
  /** Optional retry affordance for INTERNAL_ERROR ("Something went wrong on our side."). */
  action?: React.ReactNode;
}

export function ErrorBanner({ children, action, className, ...rest }: ErrorBannerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'rounded-md border border-border bg-card px-4 py-3',
        'font-sans text-sm text-foreground',
        className,
      )}
      {...rest}
    >
      <p>{children}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
