/**
 * StorageRates (EXPERIENCE.md component patterns) — the rate card.
 *
 * The schedule a customer or agent can see *before* money exists: under the
 * agent's store form and on the customer's pickup form. One block per size —
 * the fee from pricing_config times the domain tiers, served fully priced —
 * and every number is the API's, verbatim (AD-10); the SPA never derives a
 * rate. Contrast with ChargeSummary, which prices an actual stay after
 * retrieval; this card only states the policy.
 */

import { cn } from '../lib/cn.js';
import { Eyebrow } from './brand.js';

/** One tier row as GET /pricing serves it. */
export interface PricingTierDisplayRow {
  tier: number;
  fromDay: number;
  toDay: number | null;
  perDay: number;
}

/** One size's block as GET /pricing serves it. */
export interface SizePricingDisplayRow {
  size: string;
  baseFee: number;
  tiers: readonly PricingTierDisplayRow[];
}

export interface StorageRatesProps {
  sizes: readonly SizePricingDisplayRow[];
  className?: string;
}

/** "Days 1–5" / "Day 6" / "Day 11 onwards" — the tier's own bounds. */
function dayRange(row: PricingTierDisplayRow): string {
  if (row.toDay === null) return `Day ${row.fromDay} onwards`;
  if (row.fromDay === row.toDay) return `Day ${row.fromDay}`;
  return `Days ${row.fromDay}–${row.toDay}`;
}

export function StorageRates({ sizes, className }: StorageRatesProps) {
  return (
    <div
      className={cn('rounded-lg border border-border bg-card px-5 py-4', className)}
      aria-label="Storage rates"
    >
      <Eyebrow>Storage rates</Eyebrow>

      <div
        className={cn(
          'mt-2 grid gap-x-6 gap-y-4',
          // One block (the selected size) spans the card; three sit side by side.
          sizes.length > 1 && 'sm:grid-cols-3',
        )}
      >
        {sizes.map((block) => (
          <div key={block.size} aria-label={`Storage rates · ${block.size}`}>
            <Eyebrow>
              {block.size} · {block.baseFee} / day base
            </Eyebrow>

            {block.tiers.map((row) => (
              <div
                key={row.tier}
                className="flex justify-between border-b border-border py-2.5 font-sans text-[15px] text-foreground last:border-b-0"
              >
                <span>{dayRange(row)}</span>
                <span className="tabular-nums">{row.perDay} / day</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
