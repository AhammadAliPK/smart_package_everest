/**
 * ChargeSummary (EXPERIENCE.md component patterns) — "the ledger Meera must
 * trust".
 *
 * Rows for the tiers actually used, then the total. Every number is the
 * API's, verbatim — the SPA never recomputes a charge (AD-10). The only
 * thing derived here is the row's day-range label, from the tier's own
 * starting day and the API's per-tier `days`.
 */

import { cn } from '../lib/cn.js';
import { Eyebrow } from './brand.js';

/** Tier → first day it can cover (AD-5 pricing steps). */
const TIER_START: Record<number, number> = { 1: 1, 2: 6, 3: 11 };

export interface ChargeRow {
  tier: number;
  days: number;
  rate: number;
  amount: number;
}

export interface ChargeSummaryProps {
  daysCharged: number;
  storageCharge: number;
  breakdown: readonly ChargeRow[];
  className?: string;
}

export function ChargeSummary({
  daysCharged,
  storageCharge,
  breakdown,
  className,
}: ChargeSummaryProps) {
  return (
    <div
      className={cn('rounded-lg border border-border bg-card px-5 py-4', className)}
    >
      <Eyebrow>
        Storage charge · {daysCharged} {daysCharged === 1 ? 'day' : 'days'}
      </Eyebrow>

      {breakdown.map((row) => {
        const start = TIER_START[row.tier] ?? row.tier;
        const end = start + row.days - 1;
        return (
          <div
            key={row.tier}
            className="flex justify-between border-b border-border py-2.5 font-sans text-[15px] text-foreground"
          >
            <span>
              Days {start}–{end} × {row.rate}
            </span>
            <span className="tabular-nums">{row.amount}</span>
          </div>
        );
      })}

      <div className="flex justify-between pt-4 font-sans text-[17px] font-bold text-foreground">
        <span>Total</span>
        <span className="tabular-nums">{storageCharge} units</span>
      </div>
    </div>
  );
}
