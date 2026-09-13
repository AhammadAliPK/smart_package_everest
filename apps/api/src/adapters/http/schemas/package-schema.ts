import { Type, type Static } from '@sinclair/typebox';

import { lockerIdPattern, lockerSizeSchema } from './locker-schema.js';

/**
 * Contract-first schemas for `POST /packages` (AD-1).
 *
 * The reply is the frozen store contract: the assigned locker's id (named
 * `lockerId` here, per AD-9 v1.1) and the 8-character pickup code — nothing
 * else.
 */
export const createPackageRequestSchema = Type.Object(
  {
    size: lockerSizeSchema,
    customerRef: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const createPackageReplySchema = Type.Object(
  {
    lockerId: Type.String({
      pattern: lockerIdPattern,
      description: 'The assigned locker id — 6 unambiguous characters.',
    }),
    pickupCode: Type.String(),
  },
  { additionalProperties: false },
);

export type CreatePackageRequest = Static<typeof createPackageRequestSchema>;
export type CreatePackageReply = Static<typeof createPackageReplySchema>;
