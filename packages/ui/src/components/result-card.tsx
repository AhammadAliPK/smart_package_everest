/**
 * ResultCard (EXPERIENCE.md component patterns) — "the moment Rahul
 * photographs".
 *
 * The climax of the agent rhythm: locker ID + pickup code in oversized
 * monospace (butter on dark, ink on light), one-tap copy each confirmed by
 * a brief inline "Copied" swap — no toast. Focus moves here on render so
 * screen readers announce the result. Persists until the next store or
 * navigation; the caller owns that lifecycle.
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Button } from './button.js';
import { Eyebrow } from './brand.js';

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<number | undefined>(undefined);

  React.useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard unavailable (permissions, http:) — the swap still reads
      // as confirmation of intent; nothing here is worth an error.
    }
    setCopied(true);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="secondary"
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      className="min-h-11 px-3 py-1 text-xs"
      onClick={() => void copy()}
    >
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}

export interface ResultCardProps {
  lockerId: string;
  pickupCode: string;
  className?: string;
}

export function ResultCard({ lockerId, pickupCode, className }: ResultCardProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  // Route-change focus pattern (UX-DR18): announce the result, not the churn.
  React.useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div
      ref={ref}
      role="group"
      aria-label="Package stored"
      tabIndex={-1}
      className={cn(
        'rounded-lg border border-cream-edge bg-card px-6 py-4',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        className,
      )}
    >
      <Eyebrow>Package stored</Eyebrow>

      <div className="mt-2 flex items-baseline justify-between gap-3 border-b border-border py-2.5">
        <span className="font-sans text-xs tracking-code uppercase text-muted-foreground">
          Locker
        </span>
        <span className="flex items-center gap-2.5">
          <span className="font-mono text-[20px] font-medium tracking-[0.12em] text-foreground">
            {lockerId}
          </span>
          <CopyButton value={lockerId} label="locker ID" />
        </span>
      </div>

      <div className="flex items-baseline justify-between gap-3 py-2.5">
        <span className="font-sans text-xs tracking-code uppercase text-muted-foreground">
          Pickup code
        </span>
        <span className="flex items-center gap-2.5">
          <span className="font-mono text-code font-medium tracking-code text-foreground dark:text-butter">
            {pickupCode}
          </span>
          <CopyButton value={pickupCode} label="pickup code" />
        </span>
      </div>
    </div>
  );
}
