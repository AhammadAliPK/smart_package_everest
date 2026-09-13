import { Type, type Static } from '@sinclair/typebox';

import { lockerSizeSchema } from './locker-schema.js';

/**
 * Contract-first schemas for `POST /packages` (AD-1).
 *
 * The reply is the frozen store contract: the assigned locker's cuid (named
 * `lockerId` here, per AD-9) and the 8-character pickup code — nothing else.
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
    lockerId: Type.String(),
    pickupCode: Type.String(),
  },
  { additionalProperties: false },
);

export type CreatePackageRequest = Static<typeof createPackageRequestSchema>;
export type CreatePackageReply = Static<typeof createPackageReplySchema>;
