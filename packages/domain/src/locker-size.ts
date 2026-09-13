/**
 * Locker size vocabulary and its validation rule (FR1, AD-2).
 *
 * Pure domain: no HTTP, no Prisma, no schema library — the smallest-fitting
 * allocation rule (Story 1.4) and every adapter build on this one definition.
 */

/** The declared sizes a locker can have, in fitting rank order. */
export const LOCKER_SIZES = ['SMALL', 'MEDIUM', 'LARGE'] as const;
Object.freeze(LOCKER_SIZES);

/** A declared locker size. Uppercase only — `"small"` is not a size. */
export type LockerSize = (typeof LOCKER_SIZES)[number];

/** Type guard: is this value exactly one of the declared sizes? */
export function isLockerSize(value: unknown): value is LockerSize {
  return (
    typeof value === 'string' &&
    (LOCKER_SIZES as readonly string[]).includes(value)
  );
}
