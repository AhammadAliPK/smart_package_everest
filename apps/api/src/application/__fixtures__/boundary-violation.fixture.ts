/**
 * COMMITTED BOUNDARY VIOLATION — do not fix, do not import.
 *
 * This file exists to prove AD-2 enforcement works: `src/application/` (use
 * cases + ports) must not import `fastify` or `@sinclair/typebox`. It is
 * excluded from `tsc` builds and from the normal lint pass, and is linted on
 * purpose by `scripts/check-boundaries.mjs`, which asserts ESLint fails on it.
 */

import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';

export interface ViolatingFixture {
  readonly server: FastifyInstance;
  readonly schema: ReturnType<typeof Type.Object>;
}
