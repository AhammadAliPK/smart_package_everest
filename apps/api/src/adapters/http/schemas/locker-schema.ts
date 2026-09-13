import { Type, type Static } from '@sinclair/typebox';

import { LOCKER_ID_LENGTH, PICKUP_CODE_ALPHABET } from '@locker/domain';

/**
 * Contract-first schemas for the locker endpoints (AD-1).
 *
 * The TypeBox schema is the single source of truth: Fastify validates the
 * request body against it (anything else becomes a 400 VALIDATION_ERROR via
 * the AD-7 error mapper) and `@fastify/swagger` derives the OpenAPI document
 * from it, so `/docs` can never drift from what the route actually accepts.
 */

/**
 * AD-9 v1.1: a locker id is generated over the unambiguous pickup-code
 * alphabet (`0/O/1/I` excluded) — derived from the domain constants so the
 * contract can never drift from the generator. E.g. `"K7Q4M2"`.
 */
export const lockerIdPattern = `^[${PICKUP_CODE_ALPHABET}]{${LOCKER_ID_LENGTH}}$`;

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

/** `POST /lockers` 201 response (AD-9 v1.1: the public id is the only identifier). */
export const createLockerReplySchema = Type.Object(
  {
    lockerId: Type.String({
      pattern: lockerIdPattern,
      description: 'The locker id — 6 unambiguous characters, e.g. "K7Q4M2".',
    }),
    size: lockerSizeSchema,
    occupied: Type.Boolean(),
  },
  { additionalProperties: false },
);

export type CreateLockerRequest = Static<typeof createLockerRequestSchema>;
export type CreateLockerReply = Static<typeof createLockerReplySchema>;

/**
 * `GET /lockers` list item — the AD-1 frozen contract verbatim: the locker
 * id is carried as `id` here (unlike the AD-9 v1.1 `lockerId` of the create
 * reply) and these three fields are all a list item may ever carry.
 */
export const lockerListItemSchema = Type.Object(
  {
    id: Type.String({
      pattern: lockerIdPattern,
      description: 'The locker id — 6 unambiguous characters, e.g. "K7Q4M2".',
    }),
    size: lockerSizeSchema,
    occupied: Type.Boolean(),
  },
  { additionalProperties: false },
);

/** `GET /lockers` 200 response — an empty station is `{"lockers":[]}`. */
export const listLockersReplySchema = Type.Object(
  {
    lockers: Type.Array(lockerListItemSchema),
  },
  { additionalProperties: false },
);

export type LockerListItem = Static<typeof lockerListItemSchema>;
export type ListLockersReply = Static<typeof listLockersReplySchema>;
