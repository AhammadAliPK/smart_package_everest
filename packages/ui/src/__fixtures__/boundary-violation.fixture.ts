/**
 * COMMITTED BOUNDARY VIOLATION — do not fix, do not import.
 *
 * This file exists to prove the AD-10 boundary works: `@locker/ui` is
 * presentation-only and must never import the app (`@locker/web`) or anything
 * server-side. It is excluded from `tsc` builds and from the normal lint pass,
 * and is linted on purpose by `scripts/check-boundaries.mjs`, which asserts
 * ESLint fails on it.
 *
 * If you are tempted to delete this file, delete the check script's assertion
 * instead and explain why the rule no longer needs proving.
 */

import '@locker/web';
import 'fastify';

export const VIOLATION = true;
