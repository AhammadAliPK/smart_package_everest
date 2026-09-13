/**
 * Spinner — the in-place pending indicator (EXPERIENCE.md: submit pending
 * shows a spinner in the button; never a page-level blocker). Decorative
 * only: the disabled button text carries the state for screen readers, and
 * `prefers-reduced-motion` stops the spin globally.
 */

import { LoaderCircle } from 'lucide-react';

import { cn } from '../lib/cn.js';

export function Spinner({ className }: { className?: string }) {
  return (
    <LoaderCircle aria-hidden="true" className={cn('size-4 animate-spin', className)} />
  );
}
