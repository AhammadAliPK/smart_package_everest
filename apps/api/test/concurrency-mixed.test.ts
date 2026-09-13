import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../src/adapters/http/app.js';
import type { Env } from '../src/config/env.js';
import {
  applyMigrations,
  closeTestPrisma,
  getTestPrisma,
  testDatabaseUrl,
  truncateAll,
} from './test-db.js';

/**
 * Story 3.2 — availability stays correct under sustained mixed concurrency
 * (FR12). Rounds of parallel stores followed by parallel retrievals against
 * the real stack; after every half-round the invariant is asserted directly
 * in the database: occupied lockers == STORED packages, exactly. Freed
 * lockers must be immediately re-assignable, which the next round proves by
 * refilling the same M lockers.
 */
const ROUNDS = 6;
const CAPACITY = 4;

describe('mixed store/retrieve rounds (integration)', () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  beforeAll(async () => {
    await applyMigrations();

    app = await buildApp(
      {
        databaseUrl: testDatabaseUrl(),
        port: 0,
        storageFeeBase: 10,
      } satisfies Env,
      { logger: false },
    );
  });

  afterAll(async () => {
    await truncateAll();
    await app?.close();
    await closeTestPrisma();
  });

  async function assertInvariant(expectedStored: number): Promise<void> {
    const prisma = getTestPrisma();
    const occupied = await prisma.locker.count({
      where: { occupiedBy: { not: null } },
    });
    const stored = await prisma.storedPackage.count({
      where: { status: 'STORED' },
    });
    expect(occupied).toBe(expectedStored);
    expect(stored).toBe(expectedStored);
    expect(occupied).toBe(stored); // the invariant itself, never assumed
  }

  it(`keeps occupied == STORED across ${ROUNDS} full store→retrieve rounds`, async () => {
    await truncateAll();
    const prisma = getTestPrisma();

    for (let index = 0; index < CAPACITY; index += 1) {
      const created = await app!.inject({
        method: 'POST',
        url: '/lockers',
        payload: { size: 'SMALL' },
      });
      expect(created.statusCode).toBe(201);
    }

    let runningRetrieved = 0;

    for (let round = 1; round <= ROUNDS; round += 1) {
      // Fill the station with parallel stores — capacity successes expected.
      const stored = await Promise.all(
        Array.from({ length: CAPACITY }, () =>
          app!.inject({
            method: 'POST',
            url: '/packages',
            payload: { size: 'SMALL', customerRef: `round ${round}` },
          }),
        ),
      );
      const receipts = stored.map((response) => {
        expect(response.statusCode).toBe(201);
        return response.json() as { lockerId: string; pickupCode: string };
      });

      // Distinct lockers within the round — no double assignment.
      expect(new Set(receipts.map((r) => r.lockerId)).size).toBe(CAPACITY);
      await assertInvariant(CAPACITY);

      // Empty the station with parallel retrievals.
      const picked = await Promise.all(
        receipts.map((receipt) =>
          app!.inject({
            method: 'POST',
            url: '/pickups',
            payload: {
              lockerId: receipt.lockerId,
              pickupCode: receipt.pickupCode,
            },
          }),
        ),
      );
      for (const response of picked) {
        expect(response.statusCode).toBe(200);
      }
      await assertInvariant(0);

      runningRetrieved += CAPACITY;
      expect(
        await prisma.storedPackage.count({ where: { status: 'RETRIEVED' } }),
      ).toBe(runningRetrieved);

      // Round 2+ refilling the same lockers proves freed lockers are
      // immediately re-assignable — no stale occupancy after retrieval.
    }
  });

  it('two parallel pickups of the same package → one 200, one 409 LOCKER_EMPTY', async () => {
    await truncateAll();
    const prisma = getTestPrisma();

    const created = await app!.inject({
      method: 'POST',
      url: '/lockers',
      payload: { size: 'SMALL' },
    });
    expect(created.statusCode).toBe(201);
    const stored = await app!.inject({
      method: 'POST',
      url: '/packages',
      payload: { size: 'SMALL' },
    });
    expect(stored.statusCode).toBe(201);
    const { lockerId, pickupCode } = stored.json() as {
      lockerId: string;
      pickupCode: string;
    };

    const [first, second] = await Promise.all([
      app!.inject({ method: 'POST', url: '/pickups', payload: { lockerId, pickupCode } }),
      app!.inject({ method: 'POST', url: '/pickups', payload: { lockerId, pickupCode } }),
    ]);

    const statuses = [first.statusCode, second.statusCode].sort();
    expect(statuses).toEqual([200, 409]);
    const loser = [first, second].find((r) => r.statusCode === 409)!;
    expect(loser.json()).toMatchObject({ error: { code: 'LOCKER_EMPTY' } });

    // Exactly one retrieval recorded; the locker is free.
    expect(await prisma.storedPackage.count({ where: { status: 'RETRIEVED' } })).toBe(1);
    expect(
      (await prisma.locker.findUniqueOrThrow({ where: { id: lockerId } })).occupiedBy,
    ).toBeNull();
  });
});
