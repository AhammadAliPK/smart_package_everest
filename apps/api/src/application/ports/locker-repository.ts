import type { LockerSize } from '@locker/domain';

/**
 * A locker as the application layer sees it (AD-9): the cuid is the only
 * identifier and `occupied` is the only availability fact.
 */
export interface Locker {
  readonly lockerId: string;
  readonly size: LockerSize;
  readonly occupied: boolean;
}

/**
 * Persistence port for lockers.
 *
 * Defined here, implemented by an adapter (`src/adapters/db/`) — the
 * application depends on this interface, never on Prisma (AD-2, AD-4).
 */
export interface LockerRepository {
  /** Persist a new, unoccupied locker of the given size. */
  create(size: LockerSize): Promise<Locker>;
}
