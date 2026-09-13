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
 * Story 3.1 — parallel stores never double-assign a locker (FR11).
 *
 * True `Promise.all` fan-out against the real route stack and the real
 * Postgres: no artificial serialization, no sleeps, seeded fixtures and
 * truncate isolation. The SKIP LOCKED scan is the authority under contention;
 * these tests make its guarantees visible at the HTTP boundary.
 */
describe('POST /packages under parallel load (integration)', () => {
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

  async function seedLockers(count: number): Promise<string[]> {
    const ids: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const response = await app!.inject({
        method: 'POST',
        url: '/lockers',
        payload: { size: 'SMALL' },
      });
      expect(response.statusCode).toBe(201);
      ids.push((response.json() as { lockerId: string }).lockerId);
    }
    return ids;
  }

  function storesInParallel(count: number, size = 'SMALL') {
    return Promise.all(
      Array.from({ length: count }, () =>
        app!.inject({ method: 'POST', url: '/packages', payload: { size } }),
      ),
    );
  }

  it('oversubscription: 8 parallel stores into 3 free lockers → exactly 3 distinct 201s, 5 refusals', async () => {
    await truncateAll();
    const prisma = getTestPrisma();
    const seeded = await seedLockers(3);

    const responses = await storesInParallel(8);

    const successes = responses.filter((r) => r.statusCode === 201);
    const refusals = responses.filter((r) => r.statusCode === 409);
    expect(successes).toHaveLength(3);
    expect(refusals).toHaveLength(5);
    for (const refusal of refusals) {
      expect(refusal.json()).toMatchObject({
        error: { code: 'NO_SUITABLE_LOCKER' },
      });
    }

    // No locker double-assigned: three distinct ids, all from the seed.
    const assigned = successes.map(
      (r) => (r.json() as { lockerId: string }).lockerId,
    );
    expect(new Set(assigned).size).toBe(3);
    expect(seeded.sort()).toEqual([...assigned].sort());

    // Occupancy == successes, and the losers wrote nothing.
    expect(
      await prisma.locker.count({ where: { occupiedBy: { not: null } } }),
    ).toBe(3);
    expect(await prisma.storedPackage.count()).toBe(3);
    expect(await prisma.storedPackage.count({ where: { status: 'STORED' } })).toBe(3);
  });

  it('parallel mixed sizes contend only within their fit range', async () => {
    await truncateAll();
    const prisma = getTestPrisma();
    // One SMALL and one LARGE: SMALL stores can take either, LARGE only the LARGE.
    async function seedOne(size: 'SMALL' | 'LARGE'): Promise<string> {
      const created = await app!.inject({
        method: 'POST',
        url: '/lockers',
        payload: { size },
      });
      expect(created.statusCode).toBe(201);
      return (created.json() as { lockerId: string }).lockerId;
    }
    const smallId = await seedOne('SMALL');
    const largeId = await seedOne('LARGE');

    const responses = await Promise.all([
      app!.inject({ method: 'POST', url: '/packages', payload: { size: 'LARGE' } }),
      app!.inject({ method: 'POST', url: '/packages', payload: { size: 'LARGE' } }),
      app!.inject({ method: 'POST', url: '/packages', payload: { size: 'SMALL' } }),
    ]);

    const successes = responses.filter((r) => r.statusCode === 201);
    expect(successes).toHaveLength(2);

    // Exactly one LARGE store won the LARGE locker.
    const largeWinners = successes.filter(
      (r) => (r.json() as { lockerId: string }).lockerId === largeId,
    );
    expect(largeWinners).toHaveLength(1);

    const occupied = await prisma.locker.findMany({
      where: { occupiedBy: { not: null } },
    });
    expect(occupied.map((l) => l.id).sort()).toEqual([largeId, smallId].sort());
    expect(await prisma.storedPackage.count()).toBe(2);
  });

  it('no double assignment at the row level: every occupied locker holds a distinct STORED package', async () => {
    await truncateAll();
    const prisma = getTestPrisma();
    await seedLockers(6);

    await storesInParallel(6);

    const lockers = await prisma.locker.findMany({
      where: { occupiedBy: { not: null } },
    });
    expect(lockers).toHaveLength(6);
    const packageIds = lockers.map((l) => l.occupiedBy);
    expect(new Set(packageIds).size).toBe(6); // distinct — no locker shares a package
    expect(await prisma.storedPackage.count({ where: { status: 'STORED' } })).toBe(6);
  });
});
