import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { GetPricing } from '../../../application/use-cases/get-pricing.js';
import { pricingReplySchema } from '../schemas/pricing-schema.js';

/** Dependencies the route needs — injected by `buildApp`. */
export interface PricingRoutesOptions {
  /** `STORAGE_FEE_BASE` from the validated env (AD-5, default 10). */
  readonly storageFeeBase: number;
}

/**
 * Pricing endpoint (FR9).
 *
 * Parse/validate/delegate only — the schedule itself is the use case's pure
 * projection of the domain tier table and the operator's base fee, so the
 * reply is computed synchronously with nothing to persist. The served
 * contract (and the generated OpenAPI the web client types itself from) is
 * pinned by `pricingReplySchema`.
 */
export const pricingRoutes: FastifyPluginAsyncTypebox<PricingRoutesOptions> =
  async (app, { storageFeeBase }) => {
    const getPricing = new GetPricing(storageFeeBase);

    app.get(
      '/pricing',
      {
        schema: {
          response: { 200: pricingReplySchema },
        },
      },
      async (_request, reply) => {
        const schedule = getPricing.execute();
        // The domain keeps its arrays readonly; the reply contract's Static
        // type is mutable — spread into a plain copy, as the pickups route
        // does with its breakdown.
        return reply.code(200).send({
          baseFee: schedule.baseFee,
          tiers: schedule.tiers.map((row) => ({ ...row })),
        });
      },
    );
  };
