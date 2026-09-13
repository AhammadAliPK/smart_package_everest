import { Type, type Static } from '@sinclair/typebox';

import { PICKUP_CODE_LENGTH } from '@locker/domain';

import { lockerIdPattern } from './locker-schema.js';

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
    // Deliberately loose (no charset/length gate): the use case trims and
    // uppercases, so pasted or lowercase ids just work and anything else
    // lands on the calm LOCKER_NOT_FOUND — never a harsh 400.
    lockerId: Type.String({
      minLength: 1,
      maxLength: 32,
      description:
        'The locker id; case-insensitive and trimmed by the server (e.g. "k7q4m2").',
    }),
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
    lockerId: Type.String({
      pattern: lockerIdPattern,
      description: 'The locker the package was retrieved from.',
    }),
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
