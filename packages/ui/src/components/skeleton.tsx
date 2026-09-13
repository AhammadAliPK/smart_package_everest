/** Skeleton — shadcn-style loading placeholder; tonal pulse only (matte depth). */

import { cn } from '../lib/cn.js';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-lg border border-border bg-card', className)}
    />
  );
}
