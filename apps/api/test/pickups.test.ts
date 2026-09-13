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
 * Integration suite for `POST /pickups` (FR7, FR9): the happy path of the
 * retrieval transaction — atomic free-and-RETRIEVED, the charge fields from
 * the pricing policy, the freed locker visible through the list contract,
 * and the route documented at `/docs` (AD-1).
 */
describe('POST /pickups (integration)', () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  async function createLocker(
    size: 'SMALL' | 'MEDIUM' | 'LARGE',
  ): Promise<string> {
    const response = await app!.inject({
      method: 'POST',
      url: '/lockers',
      payload: { size },
    });
    expect(response.statusCode).toBe(201);
    return (response.json() as { lockerId: string }).lockerId;
  }

  async function storePackage(): Promise<{
    lockerId: string;
    pickupCode: string;
  }> {
    await createLocker('SMALL');
    const response = await app!.inject({
      method: 'POST',
      url: '/packages',
      payload: { size: 'SMALL' },
    });
    expect(response.statusCode).toBe(201);
    return response.json() as { lockerId: string; pickupCode: string };
  }

  function pickUp(payload: Record<string, unknown>) {
    return app!.inject({ method: 'POST', url: '/pickups', payload });
  }

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

  it('retrieves a stored package and answers the frozen charge body', async () => {
    await truncateAll();
    const prisma = getTestPrisma();
    const { lockerId, pickupCode } = await storePackage();
    const before = Date.now();

    const response = await pickUp({ lockerId, pickupCode });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(Object.keys(body).sort()).toEqual([
      'breakdown',
      'daysCharged',
      'lockerId',
      'retrievedAt',
      'storageCharge',
    ]);
    expect(body.lockerId).toBe(lockerId);
    // retrievedAt is an ISO-8601 UTC instant committed by the transaction…
    expect(body.retrievedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/,
    );
    expect(Date.parse(body.retrievedAt)).toBeGreaterThanOrEqual(before - 1_000);
    // …and the stay just began, so the charge is one tier-1 day (AD-5).
    expect(body.storageCharge).toBe(10);
    expect(body.daysCharged).toBe(1);
    expect(body.breakdown).toEqual([
      { tier: 1, days: 1, rate: 10, amount: 10 },
    ]);

    // Atomic pair: the locker is free AND the package is RETRIEVED (FR7).
    const locker = await prisma.locker.findUniqueOrThrow({ where: { id: lockerId } });
    expect(locker.occupiedBy).toBeNull();
    const packages = await prisma.storedPackage.findMany();
    expect(packages).toHaveLength(1);
    expect(packages[0]).toMatchObject({
      pickupCode,
      status: 'RETRIEVED',
      retrievedAt: new Date(body.retrievedAt),
    });
  });

  it('frees the locker in the frozen list contract too', async () => {
    await truncateAll();
    const { lockerId, pickupCode } = await storePackage();

    const beforeList = await app!.inject({ method: 'GET', url: '/lockers' });
    expect(
      (beforeList.json() as { lockers: { id: string; occupied: boolean }[] }).lockers.find(
        (locker) => locker.id === lockerId,
      )?.occupied,
    ).toBe(true);

    const response = await pickUp({ lockerId, pickupCode });
    expect(response.statusCode).toBe(200);

    const afterList = await app!.inject({ method: 'GET', url: '/lockers' });
    expect(
      (afterList.json() as { lockers: { id: string; occupied: boolean }[] }).lockers.find(
        (locker) => locker.id === lockerId,
      )?.occupied,
    ).toBe(false);
  });

  it('prices with the env-injected base fee (STORAGE_FEE_BASE=7)', async () => {
    await truncateAll();
    const localApp = await buildApp(
      {
        databaseUrl: testDatabaseUrl(),
        port: 0,
        storageFeeBase: 7,
      } satisfies Env,
      { logger: false },
    );

    try {
      const created = await localApp.inject({
        method: 'POST',
        url: '/lockers',
        payload: { size: 'SMALL' },
      });
      expect(created.statusCode).toBe(201);
      const stored = await localApp.inject({
        method: 'POST',
        url: '/packages',
        payload: { size: 'SMALL' },
      });
      expect(stored.statusCode).toBe(201);
      const { lockerId, pickupCode } = stored.json() as {
        lockerId: string;
        pickupCode: string;
      };

      const response = await localApp.inject({
        method: 'POST',
        url: '/pickups',
        payload: { lockerId, pickupCode },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        storageCharge: 7,
        daysCharged: 1,
        breakdown: [{ tier: 1, days: 1, rate: 7, amount: 7 }],
      });
    } finally {
      await localApp.close();
    }
  });

  it('exposes POST /pickups in the OpenAPI document', async () => {
    const response = await app!.inject({ method: 'GET', url: '/docs/json' });

    expect(response.statusCode).toBe(200);
    const document = response.json() as {
      paths: Record<string, Record<string, { responses: Record<string, unknown> }>>;
    };
    const post = document.paths['/pickups']?.post;
    expect(post).toBeDefined();
    expect(Object.keys(post?.responses ?? {})).toContain('200');
  });
});
