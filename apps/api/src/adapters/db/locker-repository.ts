import type { LockerSize } from '@locker/domain';

import type { Locker, LockerRepository } from '../../application/ports/locker-repository.js';
import type { PrismaClient } from './generated/prisma/client.js';

/**
 * Prisma implementation of the locker persistence port (AD-2, AD-8).
 *
 * This is the only code in the application that knows a locker is a `locker`
 * row: the cuid becomes `lockerId` (AD-9) and occupancy is derived from
 * `occupiedBy` — the column the Story 1.4 store transaction will CAS on.
 */
export class PrismaLockerRepository implements LockerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(size: LockerSize): Promise<Locker> {
    const created = await this.prisma.locker.create({ data: { size } });

    return {
      lockerId: created.id,
      size: created.size,
      occupied: created.occupiedBy !== null,
    };
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
