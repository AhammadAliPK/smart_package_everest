import { LOCKER_SIZES, PRICING_TIERS, type LockerSize } from '@locker/domain';

import type { PricingConfigRepository } from '../ports/pricing-config-repository.js';

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

/** One size's rate card: its base fee and the fully-priced tier rows. */
export interface SizePricing {
  readonly size: LockerSize;
  readonly baseFee: number;
  readonly tiers: readonly PricingTierRate[];
}

/** The `GET /pricing` reply: a rate card per declared size (FR9 ext). */
export interface PricingSchedule {
  readonly sizes: readonly SizePricing[];
}

/**
 * `GET /pricing` — the storage rate card (FR9, AD-5 + size-based extension).
 *
 * One block per declared size: the fee the pricing config resolves for it,
 * times the domain's tier multipliers. The reply is fully priced (never
 * multiplier-only) so a client renders it verbatim without deriving a rate
 * (AD-10) — changing a fee in `pricing_config` changes what this serves on
 * the next request, no deploy.
 */
export class GetPricing {
  constructor(private readonly pricingConfig: PricingConfigRepository) {}

  async execute(): Promise<PricingSchedule> {
    const sizes = await Promise.all(
      LOCKER_SIZES.map(async (size): Promise<SizePricing> => {
        const baseFee = await this.pricingConfig.getBaseFee(size);
        return {
          size,
          baseFee,
          tiers: PRICING_TIERS.map((row) => ({
            tier: row.tier,
            fromDay: row.fromDay,
            toDay: row.toDay,
            perDay: row.multiplier * baseFee,
          })),
        };
      }),
    );

    return { sizes };
  }
}
