/**
 * COMMITTED BOUNDARY VIOLATION — do not fix, do not import.
 *
 * This file exists to prove the AD-10 boundary works: `apps/web` computes no
 * domain outcomes — every charge, assignment and error it renders comes from
 * an API response — so it must never import `@locker/domain`. It is excluded
 * from `tsc` builds and from the normal lint pass, and is linted on purpose
 * by `scripts/check-boundaries.mjs`, which asserts ESLint fails on it.
 *
 * If you are tempted to delete this file, delete the check script's assertion
 * instead and explain why the rule no longer needs proving.
 */

import { LOCKER_SIZES } from '@locker/domain';

export const VIOLATION = LOCKER_SIZES;
