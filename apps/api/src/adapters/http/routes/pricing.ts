import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import type { PricingConfigRepository } from '../../../application/ports/pricing-config-repository.js';
import { GetPricing } from '../../../application/use-cases/get-pricing.js';
import { pricingReplySchema } from '../schemas/pricing-schema.js';

/** Dependencies the route needs — injected by `buildApp`. */
export interface PricingRoutesOptions {
  readonly pricingConfig: PricingConfigRepository;
}

/**
 * Pricing endpoint (FR9, size-based extension).
 *
 * Parse/validate/delegate only — the schedule is the use case's projection
 * of the pricing config's per-size fees over the domain tier table, so the
 * reply is a read with nothing to persist. The served contract (and the
 * generated OpenAPI the web client types itself from) is pinned by
 * `pricingReplySchema`.
 */
export const pricingRoutes: FastifyPluginAsyncTypebox<PricingRoutesOptions> =
  async (app, { pricingConfig }) => {
    const getPricing = new GetPricing(pricingConfig);

    app.get(
      '/pricing',
      {
        schema: {
          response: { 200: pricingReplySchema },
        },
      },
      async (_request, reply) => {
        const schedule = await getPricing.execute();
        // The use case keeps its arrays readonly; the reply contract's
        // Static type is mutable — spread into plain copies, as the pickups
        // route does with its breakdown.
        return reply.code(200).send({
          sizes: schedule.sizes.map((block) => ({
            ...block,
            tiers: block.tiers.map((row) => ({ ...row })),
          })),
        });
      },
    );
  };
