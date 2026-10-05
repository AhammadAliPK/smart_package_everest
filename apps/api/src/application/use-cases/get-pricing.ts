import { PRICING_TIERS } from '@locker/domain';

/** One tier of the served rate card: `perDay === multiplier × baseFee`. */
export interface PricingTierRate {
  readonly tier: number;
  /** First day this tier covers (inclusive). */
  readonly fromDay: number;
  /** Last day this tier covers; `null` = open-ended. */
  readonly toDay: number | null;
  /** The per-day rate in integer units (AD-5). */
  readonly perDay: number;
}

/** The `GET /pricing` reply: everything a UI needs to show storage rates. */
export interface PricingSchedule {
  readonly baseFee: number;
  readonly tiers: readonly PricingTierRate[];
}

/**
 * `GET /pricing` — the storage rate card (FR9, AD-5).
 *
 * Today the schedule is env-shaped: `STORAGE_FEE_BASE` times the domain's
 * tier multipliers, with no I/O, so this use case is a pure projection —
 * rates change by config, tiers only by policy release. The locker-size
 * pricing extension swaps the injected number for a `PricingConfigRepository`
 * port (per-size base fees from a table); this return shape is the seam that
 * survives that change untouched.
 */
export class GetPricing {
  constructor(private readonly storageFeeBase: number) {}

  execute(): PricingSchedule {
    return {
      baseFee: this.storageFeeBase,
      tiers: PRICING_TIERS.map((row) => ({
        tier: row.tier,
        fromDay: row.fromDay,
        toDay: row.toDay,
        perDay: row.multiplier * this.storageFeeBase,
      })),
    };
  }
}
