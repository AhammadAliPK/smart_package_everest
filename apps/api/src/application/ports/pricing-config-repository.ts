import type { LockerSize } from '@locker/domain';

/**
 * Per-size base fee lookup (FR9 extension: size-based pricing).
 *
 * The application never knows *where* a fee comes from — today the
 * `pricing_config` table (seeded per size, editable by operations without a
 * deploy), with `STORAGE_FEE_BASE` as the missing-row fallback. Tier
 * multipliers stay in @locker/domain: they are policy, this is
 * configuration.
 */
export interface PricingConfigRepository {
  /** The base fee for a size — tier-1's per-day rate. */
  getBaseFee(size: LockerSize): Promise<number>;
}
