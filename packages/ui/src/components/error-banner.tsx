/**
 * ErrorBanner (EXPERIENCE.md Component Patterns).
 *
 * Calm, blame-free, physical-world copy only — but the chrome is refusal
 * red, so a refusal can never be mistaken for a neutral card (feedback
 * 2026-10-05: the capacity banner was invisible next to the form cards).
 * Renders *above* the submit button, politely announced. The caller owns
 * the copy (mapped from the AD-7 code); this component only renders it.
 */

import { CircleAlert } from 'lucide-react';
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
        'flex gap-2.5 rounded-md border border-error-edge bg-error-wash px-4 py-3',
        'font-sans text-sm text-error',
        className,
      )}
      {...rest}
    >
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p>{children}</p>
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </div>
  );
}
