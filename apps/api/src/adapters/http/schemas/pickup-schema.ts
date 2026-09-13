import { Type, type Static } from '@sinclair/typebox';

import { PICKUP_CODE_LENGTH } from '@locker/domain';

/**
 * Contract-first schemas for `POST /pickups` (AD-1).
 *
 * The request is the frozen retrieval pair; the reply carries the retrieval
 * facts plus the tiered charge from the pricing policy (FR9, AD-5) — every
 * money-adjacent field an integer, `retrievedAt` an ISO-8601 instant.
 */

/** `POST /pickups` request body. */
export const createPickupRequestSchema = Type.Object(
  {
    lockerId: Type.String({ minLength: 1 }),
    pickupCode: Type.String({
      minLength: PICKUP_CODE_LENGTH,
      maxLength: PICKUP_CODE_LENGTH,
    }),
  },
  { additionalProperties: false },
);

/** One tier segment of the charge: `amount === days * rate` always (AD-5). */
export const chargeBreakdownRowSchema = Type.Object(
  {
    tier: Type.Integer({ minimum: 1, maximum: 3 }),
    days: Type.Integer({ minimum: 1 }),
    rate: Type.Integer({ minimum: 1 }),
    amount: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false },
);

/** `POST /pickups` 200 response. */
export const pickupReplySchema = Type.Object(
  {
    lockerId: Type.String(),
    retrievedAt: Type.String({ format: 'date-time' }),
    storageCharge: Type.Integer({ minimum: 1 }),
    daysCharged: Type.Integer({ minimum: 1 }),
    breakdown: Type.Array(chargeBreakdownRowSchema),
  },
  { additionalProperties: false },
);

export type CreatePickupRequest = Static<typeof createPickupRequestSchema>;
export type ChargeBreakdownRowReply = Static<typeof chargeBreakdownRowSchema>;
export type PickupReply = Static<typeof pickupReplySchema>;
