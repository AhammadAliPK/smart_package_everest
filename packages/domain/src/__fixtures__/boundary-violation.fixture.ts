/**
 * COMMITTED BOUNDARY VIOLATION — do not fix, do not import.
 *
 * This file exists to prove AD-2 enforcement works: `@locker/domain` must not
 * import `fastify` or `@prisma/*`. It is excluded from `tsc` builds and from
 * the normal lint pass, and is linted on purpose by
 * `scripts/check-boundaries.mjs`, which asserts ESLint fails on it.
 *
 * If you are tempted to delete this file, delete the check script's assertion
 * instead and explain why the rule no longer needs proving.
 */

import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';

export interface ViolatingFixture {
  readonly server: FastifyInstance;
  readonly db: PrismaClient;
}
