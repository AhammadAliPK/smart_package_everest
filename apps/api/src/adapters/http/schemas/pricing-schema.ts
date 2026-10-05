import { Type, type Static } from '@sinclair/typebox';

/**
 * Contract-first schemas for `GET /pricing` (AD-1).
 *
 * The rate card the UI renders verbatim (AD-10): the operator's base fee
 * plus one row per pricing tier, boundaries and all, so a client never
 * derives a rate itself. `toDay: null` marks the open-ended final tier.
 */

/** One tier of the published schedule. */
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

/** `GET /pricing` 200 response. */
export const pricingReplySchema = Type.Object(
  {
    baseFee: Type.Integer({
      minimum: 1,
      description: 'STORAGE_FEE_BASE — the tier-1 per-day rate (default 10).',
    }),
    tiers: Type.Array(pricingTierSchema, { minItems: 1 }),
  },
  { additionalProperties: false },
);

export type PricingTierReply = Static<typeof pricingTierSchema>;
export type PricingReply = Static<typeof pricingReplySchema>;
