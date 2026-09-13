import type { LockerSize } from '@locker/domain';

/**
 * A locker as the application layer sees it (AD-9 v1.1): the generated
 * 6-char code is the only public identifier and `occupied` is the only
 * availability fact.
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
  /**
   * Persist a new, unoccupied locker of the given size under a fresh public
   * id. `nextLockerId` is drawn per attempt so the adapter can retry the
   * (~1/887M) unique collision itself (AD-3's bounded-retry spirit).
   */
  create(size: LockerSize, nextLockerId: () => string): Promise<Locker>;
  /**
   * Every locker in the station, free and occupied alike. No ordering is
   * promised — the `ListLockers` use case normalises it to the frozen AD-1
   * "ordered by id" contract.
   */
  list(): Promise<readonly Locker[]>;
}
