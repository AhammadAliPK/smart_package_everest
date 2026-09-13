/**
 * The tiered storage charge (FR9, AD-5).
 *
 * Pure domain: a function of the two instants and the base fee, nothing
 * else — no wall-clock reads, no persistence, integer units throughout.
 * Day counting is ceiling-based: day 1 starts at storage, an exact 24h is
 * still 1 day and 24h+1min is 2 days. Tiers stack per day, so a long stay
 * is charged as several tier segments, not one flat rate:
 *
 *   days 1–5   → X per day
 *   days 6–10  → 2X per day
 *   days 11+   → 3X per day
 *
 * where X is the base fee (`STORAGE_FEE_BASE`, default 10) supplied by the
 * caller. The breakdown lists only the tiers a stay actually reached.
 */

/** Length of a pricing day in milliseconds (exact 24h). */
const DAY_MS = 86_400_000;

/** Tier boundaries: days 1–5 tier 1, 6–10 tier 2, 11+ tier 3. */
const TIER_1_MAX_DAYS = 5;
const TIER_2_MAX_DAYS = 10;

/** One tier segment of a stay: `amount === days * rate` always. */
export interface ChargeBreakdownRow {
  /** 1, 2 or 3 — ascending with the stay length. */
  readonly tier: 1 | 2 | 3;
  /** Days charged in this tier. */
  readonly days: number;
  /** The per-day rate of this tier: X, 2X or 3X. */
  readonly rate: number;
  /** `days * rate` — integer units (AD-5). */
  readonly amount: number;
}

/** The full charge for one stay. */
export interface StorageCharge {
  /** Total days billed — the ceiling of elapsed 24h periods, at least 1. */
  readonly daysCharged: number;
  /** Total amount — the sum of every breakdown row. */
  readonly storageCharge: number;
  /** Only the tiers actually used, ascending. Empty never happens: a stay is at least day 1. */
  readonly breakdown: readonly ChargeBreakdownRow[];
}

/** Split a stay into its tier segments and price each one. */
function segment(
  tier: 1 | 2 | 3,
  days: number,
  rate: number,
): ChargeBreakdownRow | null {
  return days > 0 ? { tier, days, rate, amount: days * rate } : null;
}

/**
 * The storage pricing policy (AD-5). Exposed as a frozen object — its one
 * method keeps the spec's `StoragePricingPolicy.charge(...)` call shape
 * while staying a pure function over its arguments.
 */
export const StoragePricingPolicy = Object.freeze({
  /**
   * Price a stay from `storedAt` to `retrievedAt` at `baseFee` per
   * tier-1 day. Both instants are exact; elapsed time is rounded up to
   * whole days because a locker held for any part of a day is held for
   * the day.
   */
  charge(
    storedAt: Date,
    retrievedAt: Date,
    baseFee: number,
  ): StorageCharge {
    const elapsedMs = Math.max(0, retrievedAt.getTime() - storedAt.getTime());
    // Day 1 starts at storage: even an instant's stay is one day, and an
    // exact multiple of 24h must not tip over into the next day.
    const daysCharged = Math.max(1, Math.ceil(elapsedMs / DAY_MS));

    const tier1Days = Math.min(daysCharged, TIER_1_MAX_DAYS);
    const tier2Days = Math.min(
      Math.max(daysCharged - TIER_1_MAX_DAYS, 0),
      TIER_2_MAX_DAYS - TIER_1_MAX_DAYS,
    );
    const tier3Days = Math.max(daysCharged - TIER_2_MAX_DAYS, 0);

    const breakdown = [
      segment(1, tier1Days, baseFee),
      segment(2, tier2Days, 2 * baseFee),
      segment(3, tier3Days, 3 * baseFee),
    ].filter((row): row is ChargeBreakdownRow => row !== null);

    return {
      daysCharged,
      storageCharge: breakdown.reduce((sum, row) => sum + row.amount, 0),
      breakdown,
    };
  },
});
