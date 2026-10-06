import type { LockerSize } from '@locker/domain';

import type { PricingConfigRepository } from '../../application/ports/pricing-config-repository.js';
import type { PrismaClient } from './generated/prisma/client.js';

/**
 * Prisma implementation of the per-size fee port (FR9 extension).
 *
 * Reads the `pricing_config` row for the size — the table operations can
 * edit without a deploy. A missing row falls back to the injected
 * `STORAGE_FEE_BASE` default rather than failing the retrieval: pricing
 * configuration gaps degrade to the historical flat fee, they never stop a
 * customer from getting their package.
 */
export class PrismaPricingConfigRepository implements PricingConfigRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly fallbackBaseFee: number,
  ) {}

  async getBaseFee(size: LockerSize): Promise<number> {
    const row = await this.prisma.pricingConfig.findUnique({
      where: { size },
      select: { baseFee: true },
    });
    return row?.baseFee ?? this.fallbackBaseFee;
  }
}
