import { SIZE_RANK, type LockerSize } from '@locker/domain';

import {
  InvalidPickupCodeError,
  LockerEmptyError,
  LockerNotFoundError,
  NoSuitableLockerError,
} from '../../application/errors.js';
import type {
  PackageAllocation,
  PackageAllocationRequest,
  PackageRetrieval,
  PackageRepository,
} from '../../application/ports/package-repository.js';
import { Prisma, type PrismaClient } from './generated/prisma/client.js';

/** AD-3: a write conflict retries a bounded number of times, then fails. */
const MAX_TRANSACTION_ATTEMPTS = 3;

/** Prisma's optimistic-concurrency error code (write conflict / serialization). */
const WRITE_CONFLICT = 'P2034';

/** Unique-constraint violation — here: a pickup-code collision among STORED rows. */
const UNIQUE_VIOLATION = 'P2002';

/** `transactionOptions.maxWait`/`timeout` — one attempt of the store flow. */
const TRANSACTION_OPTIONS = { maxWait: 5_000, timeout: 5_000 } as const;

/** The raw row the SKIP LOCKED scan returns (rank computed in SQL, AD-3). */
interface CandidateRow {
  id: string;
  size: LockerSize;
}

/** The raw row the retrieval resolve join returns (AD-6). */
interface StoredRow {
  package_id: string;
  stored_at: Date;
}

/**
 * Prisma implementation of the package persistence port (AD-3, AD-6, AD-8).
 *
 * Allocation is ONE interactive transaction: a `$queryRaw` `FOR UPDATE SKIP
 * LOCKED` scan of free fitting lockers ordered by size rank then id (the
 * concurrency authority — the fluent API cannot express row locks), a
 * count-checked CAS occupy, and the package insert — commit or roll back
 * atomically at READ COMMITTED. `NoSuitableLockerError` is thrown from inside
 * the transaction, so nothing is written when no locker fits. Retrieval
 * (`retrieveWithin`) is the mirror image: one locked join resolve, a
 * count-checked CAS free, and the RETRIEVED flip.
 */
export class PrismaPackageRepository implements PackageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async allocate(
    request: PackageAllocationRequest,
    nextPickupCode: () => string,
  ): Promise<PackageAllocation> {
    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      const pickupCode = nextPickupCode();
      try {
        return await this.prisma.$transaction(
          (tx) => this.storeWithin(tx, request, pickupCode),
          TRANSACTION_OPTIONS,
        );
      } catch (error) {
        if (error instanceof NoSuitableLockerError) {
          throw error; // a clean refusal, not a conflict — never retried
        }
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === WRITE_CONFLICT || error.code === UNIQUE_VIOLATION)
        ) {
          // P2034 conflict, or P2002 code collision → regenerate + retry
          continue;
        }
        throw error;
      }
    }

    throw new Prisma.PrismaClientKnownRequestError(
      'The store transaction could not be completed after retries',
      { code: WRITE_CONFLICT, clientVersion: Prisma.prismaVersion.client },
    );
  }

  /** One transaction attempt — throws to roll back, returns to commit. */
  private async storeWithin(
    tx: Prisma.TransactionClient,
    request: PackageAllocationRequest,
    pickupCode: string,
  ): Promise<PackageAllocation> {
    const minimumRank = SIZE_RANK[request.size];

    // AD-3 verbatim: free lockers that fit, smallest rank first, ties by id,
    // locked and skipped so a parallel store cannot take the same row.
    const candidates = await tx.$queryRaw<
      CandidateRow[]
    >`SELECT id, size FROM "locker"
       WHERE occupied_by IS NULL
         AND (CASE size WHEN 'SMALL' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END) >= ${minimumRank}
       ORDER BY (CASE size WHEN 'SMALL' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END), id
       FOR UPDATE SKIP LOCKED
       LIMIT 1`;

    const target = candidates[0];
    if (!target) {
      throw new NoSuitableLockerError(request.size);
    }

    // The package row first, so the CAS can reference its real id; both write
    // in this transaction, so the CAS check below still rolls everything back.
    const created = await tx.storedPackage.create({
      data: {
        pickupCode,
        customerRef: request.customerRef ?? null,
        status: 'STORED',
      },
    });

    // AD-4: occupancy changes only through a compare-and-swap. Holding the
    // row lock the count must be 1 — anything else rolls the whole store back.
    const occupied = await tx.locker.updateMany({
      where: { id: target.id, occupiedBy: null },
      data: { occupiedBy: created.id },
    });
    if (occupied.count !== 1) {
      throw new Error(`Locker ${target.id} was occupied concurrently`);
    }

    return {
      lockerId: target.id,
      pickupCode: created.pickupCode,
      storedAt: created.storedAt,
    };
  }

  async retrieve(
    lockerId: string,
    pickupCode: string,
  ): Promise<PackageRetrieval> {
    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          (tx) => retrieveWithin(tx, lockerId, pickupCode),
          TRANSACTION_OPTIONS,
        );
      } catch (error) {
        // The four calm outcomes are verdicts, not conflicts — never retried.
        if (
          error instanceof LockerNotFoundError ||
          error instanceof InvalidPickupCodeError ||
          error instanceof LockerEmptyError
        ) {
          throw error;
        }
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === WRITE_CONFLICT
        ) {
          continue;
        }
        throw error;
      }
    }

    throw new Prisma.PrismaClientKnownRequestError(
      'The retrieval transaction could not be completed after retries',
      { code: WRITE_CONFLICT, clientVersion: Prisma.prismaVersion.client },
    );
  }
}

/**
 * One retrieval transaction attempt (FR7, AD-4, AD-6): resolve the package
 * with a single locked join of locker → `occupied_by` → `pickup_code` +
 * `STORED`, CAS-free the locker, flip the package. Every failure path throws
 * having written nothing.
 *
 * The `FOR UPDATE` on the resolve is what makes two parallel pickups of the
 * same package safe: the loser blocks on the row lock, then Postgres's
 * READ-COMMITTED re-check drops the row the winner already RETRIEVED, so it
 * falls through to the outcome branch and answers `LOCKER_EMPTY`.
 */
async function retrieveWithin(
  tx: Prisma.TransactionClient,
  lockerId: string,
  pickupCode: string,
): Promise<PackageRetrieval> {
  const stored = await tx.$queryRaw<StoredRow[]>`
    SELECT p.id AS package_id, p.stored_at AS stored_at
    FROM "locker" l
    JOIN "stored_package" p ON p.id = l.occupied_by
    WHERE l.id = ${lockerId} AND p.pickup_code = ${pickupCode} AND p.status = 'STORED'
    FOR UPDATE`;

  if (stored.length === 0) {
    // Distinguish the three calm outcomes with one read of the locker row.
    const locker = await tx.locker.findUnique({
      where: { id: lockerId },
      select: { occupiedBy: true },
    });
    if (locker === null) {
      throw new LockerNotFoundError(lockerId);
    }
    if (locker.occupiedBy === null) {
      throw new LockerEmptyError(lockerId);
    }
    // Occupied, but not by a STORED package carrying this code.
    throw new InvalidPickupCodeError(lockerId);
  }

  const { package_id: packageId, stored_at: storedAt } = stored[0]!;
  const retrievedAt = new Date();

  // AD-4: occupancy changes only through a compare-and-swap. Holding the row
  // lock from the join the count must be 1 — anything else rolls back.
  const freed = await tx.locker.updateMany({
    where: { id: lockerId, occupiedBy: packageId },
    data: { occupiedBy: null },
  });
  if (freed.count !== 1) {
    throw new Error(
      `Locker ${lockerId} was freed concurrently (expected package ${packageId})`,
    );
  }

  await tx.storedPackage.update({
    where: { id: packageId },
    data: { status: 'RETRIEVED', retrievedAt },
  });

  return { lockerId, storedAt, retrievedAt };
}
