import { Type, type Static } from '@sinclair/typebox';

/**
 * Contract-first schemas for the locker endpoints (AD-1).
 *
 * The TypeBox schema is the single source of truth: Fastify validates the
 * request body against it (anything else becomes a 400 VALIDATION_ERROR via
 * the AD-7 error mapper) and `@fastify/swagger` derives the OpenAPI document
 * from it, so `/docs` can never drift from what the route actually accepts.
 */

/** The declared sizes — mirrors `LOCKER_SIZES` in @locker/domain. */
export const lockerSizeSchema = Type.Union([
  Type.Literal('SMALL'),
  Type.Literal('MEDIUM'),
  Type.Literal('LARGE'),
]);

/** `POST /lockers` request body. */
export const createLockerRequestSchema = Type.Object(
  {
    size: lockerSizeSchema,
  },
  { additionalProperties: false },
);

/** `POST /lockers` 201 response (AD-9: the cuid is the only identifier). */
export const createLockerReplySchema = Type.Object(
  {
    lockerId: Type.String(),
    size: lockerSizeSchema,
    occupied: Type.Boolean(),
  },
  { additionalProperties: false },
);

export type CreateLockerRequest = Static<typeof createLockerRequestSchema>;
export type CreateLockerReply = Static<typeof createLockerReplySchema>;
