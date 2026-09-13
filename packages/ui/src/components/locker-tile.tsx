/**
 * LockerTile (DESIGN.md components: locker tile).
 *
 * Availability is the brightest thing on screen: a FREE locker is a cream
 * door (lit, physical); an OCCUPIED one sinks to card/border and goes quiet.
 * The size label is always visible and the locker id renders in
 * `typography.code` ("locker ID in typography.code when shown" — DESIGN.md):
 * a door with a number on it. The yellow glow sliver is the deck's "live"
 * accent — at most one per surface, so it is opt-in via `accent`.
 *
 * Free tiles are the whole click target (a real button — "Tap to prefill");
 * occupied tiles are not interactive (EXPERIENCE.md LockerCard).
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';

export interface LockerTileProps {
  /** The public locker id (AD-9 v1.1) — e.g. "K7Q4M2". Rendered in code type. */
  lockerId: string;
  /** API spelling, uppercased for the label: "SMALL · FREE". */
  size: string;
  occupied: boolean;
  /** Render the glow sliver (≤1 per surface). */
  accent?: boolean;
  /** Free-tile activation — prefills the store form's size. */
  onSelect?: () => void;
  className?: string;
}

export const LockerTile = React.forwardRef<HTMLLIElement, LockerTileProps>(
  ({ lockerId, size, occupied, accent = false, onSelect, className }, ref) => {
    const label = `${size} · ${occupied ? 'OCCUPIED' : 'FREE'}`;

    if (occupied) {
      return (
        <li
          ref={ref}
          aria-disabled="true"
          className={cn(
            'flex min-h-26 cursor-default flex-col justify-between rounded-lg border border-border bg-card p-4',
            className,
          )}
        >
          <span className="font-sans text-[11px] font-medium tracking-caps text-muted-foreground">
            {label}
          </span>
          <span className="font-mono text-[15px] font-medium tracking-code text-muted-foreground">
            {lockerId}
          </span>
        </li>
      );
    }

    return (
      <li ref={ref} className={className}>
        <button
          type="button"
          onClick={onSelect}
          className={cn(
            'flex min-h-26 w-full cursor-pointer flex-col justify-between rounded-lg border border-cream-edge bg-cream p-4 text-left',
            'transition-[border-color] duration-150 hover:border-brand',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          )}
        >
          <span className="font-sans text-[11px] font-medium tracking-caps text-on-brand">
            {label}
          </span>
          <span className="font-mono text-[15px] font-medium tracking-code text-on-brand">
            {lockerId}
          </span>
          <span className="font-sans text-[13px] font-bold text-on-brand">
            Tap to prefill
            {accent ? (
              <span aria-hidden="true" className="mt-2 block h-0.75 w-[70%] rounded-full bg-glow" />
            ) : null}
          </span>
        </button>
      </li>
    );
  },
);
LockerTile.displayName = 'LockerTile';
