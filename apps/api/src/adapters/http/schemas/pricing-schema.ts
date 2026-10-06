import { Type, type Static } from '@sinclair/typebox';

import { lockerSizeSchema } from './locker-schema.js';

/**
 * Contract-first schemas for `GET /pricing` (AD-1, FR9 size-based extension).
 *
 * One fully-priced block per declared size — the fee from `pricing_config`
 * times the domain tier multipliers — so a client renders the card verbatim
 * without deriving a rate (AD-10). `toDay: null` marks the open-ended final
 * tier.
 */

/** One tier of a size's schedule. */
export const pricingTierSchema = Type.Object(
  {
    tier: Type.Integer({
      minimum: 1,
      maximum: 3,
      description: 'The tier — ascending with the stay length.',
    }),
    fromDay: Type.Integer({
      minimum: 1,
      description: 'First day this tier covers (inclusive).',
    }),
    toDay: Type.Union(
      [
        Type.Integer({ minimum: 2, description: 'Last day this tier covers.' }),
        Type.Null({ description: 'Open-ended — the final tier.' }),
      ],
      { description: 'Last day this tier covers, or null for the final tier.' },
    ),
    perDay: Type.Integer({
      minimum: 1,
      description: 'Per-day rate in integer units (AD-5).',
    }),
  },
  { additionalProperties: false },
);

/** One size's rate card. */
export const sizePricingSchema = Type.Object(
  {
    size: lockerSizeSchema,
    baseFee: Type.Integer({
      minimum: 1,
      description: "This size's tier-1 per-day rate, from pricing_config.",
    }),
    tiers: Type.Array(pricingTierSchema, { minItems: 1 }),
  },
  { additionalProperties: false },
);

/** `GET /pricing` 200 response — a block per declared size. */
export const pricingReplySchema = Type.Object(
  {
    sizes: Type.Array(sizePricingSchema, { minItems: 1 }),
  },
  { additionalProperties: false },
);

export type PricingTierReply = Static<typeof pricingTierSchema>;
export type SizePricingReply = Static<typeof sizePricingSchema>;
export type PricingReply = Static<typeof pricingReplySchema>;
