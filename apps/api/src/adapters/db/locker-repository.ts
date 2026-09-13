import type { LockerSize } from '@locker/domain';

import type { Locker, LockerRepository } from '../../application/ports/locker-repository.js';
import { Prisma, type PrismaClient } from './generated/prisma/client.js';

/** AD-3 spirit: a primary-key collision retries a bounded number of times, then fails. */
const MAX_ID_ATTEMPTS = 3;

/** Primary-key violation — here: a generated locker-id collision. */
const UNIQUE_VIOLATION = 'P2002';

/**
 * Prisma implementation of the locker persistence port (AD-2, AD-8).
 *
 * This is the only code in the application that knows a locker is a `locker`
 * row: the row's primary key IS the public locker id (AD-9 v1.1) — supplied
 * at create time from the injected generator — and occupancy is derived from
 * `occupiedBy`, the column the store transaction CASes on.
 */
export class PrismaLockerRepository implements LockerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(
    size: LockerSize,
    nextLockerId: () => string,
  ): Promise<Locker> {
    // 31⁶ ids — a collision is a ~1/887M event; regenerate, bounded.
    for (let attempt = 1; attempt <= MAX_ID_ATTEMPTS; attempt += 1) {
      try {
        const created = await this.prisma.locker.create({
          data: { id: nextLockerId(), size },
        });

        return {
          lockerId: created.id,
          size: created.size,
          occupied: created.occupiedBy !== null,
        };
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === UNIQUE_VIOLATION
        ) {
          continue;
        }
        throw error;
      }
    }

    throw new Prisma.PrismaClientKnownRequestError(
      'Locker id generation could not find a free id after retries',
      { code: UNIQUE_VIOLATION, clientVersion: Prisma.prismaVersion.client },
    );
  }

  /**
   * Read-only projection of the `locker` table: `occupied` is derived straight
   * from `occupied_by IS NOT NULL` — the list never joins packages (AD-1).
   */
  async list(): Promise<Locker[]> {
    const rows = await this.prisma.locker.findMany();

    return rows.map((row) => ({
      lockerId: row.id,
      size: row.size,
      occupied: row.occupiedBy !== null,
    }));
  }
}
