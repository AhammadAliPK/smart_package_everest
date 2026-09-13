/**
 * The smallest-fitting allocation rule (FR3, AD-3).
 *
 * Pure domain: given the free lockers and the package size, choose the locker
 * with the lowest size rank that still fits, breaking rank ties by lowest
 * locker id. The Prisma store transaction re-expresses this exact rule in SQL
 * (`ORDER BY rank, id ... FOR UPDATE SKIP LOCKED`) because only the database
 * can make it concurrency-safe — this function is the unit-tested mirror of
 * that query, not its replacement.
 */

import type { LockerSize } from './locker-size.js';

/** Fitting rank: SMALL(1) < MEDIUM(2) < LARGE(3). A package's size is the *minimum* locker size that fits it. */
export const SIZE_RANK: Readonly<Record<LockerSize, number>> = {
  SMALL: 1,
  MEDIUM: 2,
  LARGE: 3,
};
Object.freeze(SIZE_RANK);

/** The only facts the rule needs about a candidate locker. */
export interface FreeLocker {
  readonly lockerId: string;
  readonly size: LockerSize;
}

/**
 * Pick the smallest locker that fits `packageSize`, ties by lowest id.
 * Returns `null` when nothing fits — the caller (application layer) turns
 * that outcome into the `NO_SUITABLE_LOCKER` refusal.
 */
export function pickSmallestFitting(
  freeLockers: readonly FreeLocker[],
  packageSize: LockerSize,
): FreeLocker | null {
  const minimumRank = SIZE_RANK[packageSize];

  let best: FreeLocker | null = null;
  for (const locker of freeLockers) {
    const rank = SIZE_RANK[locker.size];
    if (rank < minimumRank) {
      continue;
    }
    if (
      best === null ||
      rank < SIZE_RANK[best.size] ||
      (rank === SIZE_RANK[best.size] && locker.lockerId < best.lockerId)
    ) {
      best = locker;
    }
  }

  return best;
}
