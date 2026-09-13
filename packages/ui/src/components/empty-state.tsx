/**
 * EmptyState (EXPERIENCE.md component patterns).
 *
 * `display-sm` headline + a single primary action — used when the station
 * has no lockers yet. Never an illustration graveyard: one sentence, one
 * next step.
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';

export interface EmptyStateProps {
  headline: string;
  /** The single primary action (e.g. "Create the first locker"). */
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ headline, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'mt-10 rounded-lg border border-border bg-card px-6 py-10 text-center',
        className,
      )}
    >
      <h2 className="font-display text-display-sm uppercase text-foreground">
        {headline}
      </h2>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}
