import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PICKUP_CODE_ALPHABET } from '@locker/domain';

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
 * Integration suite for `POST /packages` — the store transaction (AD-3)
 * against the real compose Postgres: allocation rule, pickup code, `storedAt`,
 * occupancy flip, and the parallel-store smoke test.
 */

const CUID_PATTERN = /^c[a-z0-9]{20,32}$/;
const CODE_PATTERN = new RegExp(`^[${PICKUP_CODE_ALPHABET}]{8}$`);

describe('POST /packages (integration)', () => {
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

  function storePackage(payload: Record<string, unknown>) {
    return app!.inject({ method: 'POST', url: '/packages', payload });
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

  it('stores a SMALL package in the free SMALL locker and answers the frozen 201 body', async () => {
    await truncateAll();
    const prisma = getTestPrisma();
    const smallId = await createLocker('SMALL');
    await createLocker('MEDIUM');
    const before = Date.now();

    const response = await storePackage({
      size: 'SMALL',
      customerRef: 'Meera R.',
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(Object.keys(body).sort()).toEqual(['lockerId', 'pickupCode']);
    expect(body).toEqual({
      lockerId: smallId,
      pickupCode: expect.stringMatching(CODE_PATTERN) as unknown as string,
    });

    const locker = await prisma.locker.findUniqueOrThrow({ where: { id: smallId } });
    expect(locker.occupiedBy).toBeTypeOf('string');
    const stored = await prisma.storedPackage.findUnique({
      where: { id: locker.occupiedBy! },
    });
    expect(stored).not.toBeNull();
    expect(stored).toMatchObject({
      pickupCode: body.pickupCode,
      customerRef: 'Meera R.',
      status: 'STORED',
      retrievedAt: null,
    });
    // storedAt is the exact storage instant (FR5 / AD-5)…
    expect(stored!.storedAt.getTime()).toBeGreaterThanOrEqual(before - 1_000);
    expect(stored!.storedAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('flips the locker to occupied (occupied_by carries the package id)', async () => {
    await truncateAll();
    const prisma = getTestPrisma();
    const lockerId = await createLocker('SMALL');

    const response = await storePackage({ size: 'SMALL' });
    expect(response.statusCode).toBe(201);

    const locker = await prisma.locker.findUniqueOrThrow({ where: { id: lockerId } });
    expect(locker.occupiedBy).toBeTypeOf('string');
    await expect(
      prisma.storedPackage.findUnique({ where: { id: locker.occupiedBy! } }),
    ).resolves.toMatchObject({ pickupCode: (response.json() as { pickupCode: string }).pickupCode });
  });

  it('stores a MEDIUM package in the MEDIUM locker while a SMALL is also free (rank, then id)', async () => {
    await truncateAll();
    const smallId = await createLocker('SMALL');
    const mediumId = await createLocker('MEDIUM');

    const response = await storePackage({ size: 'MEDIUM' });

    expect(response.statusCode).toBe(201);
    expect((response.json() as { lockerId: string }).lockerId).toBe(mediumId);
    expect((response.json() as { lockerId: string }).lockerId).not.toBe(smallId);
  });

  it('breaks a rank tie by lowest locker id', async () => {
    await truncateAll();
    const first = await createLocker('SMALL');
    const second = await createLocker('SMALL');
    const lowestId = [first, second].sort()[0];

    const response = await storePackage({ size: 'SMALL' });

    expect(response.statusCode).toBe(201);
    expect((response.json() as { lockerId: string }).lockerId).toBe(lowestId);
  });

  it('fits-not-exact: a SMALL package takes the only free LARGE locker', async () => {
    await truncateAll();
    const largeId = await createLocker('LARGE');

    const response = await storePackage({ size: 'SMALL' });

    expect(response.statusCode).toBe(201);
    expect((response.json() as { lockerId: string }).lockerId).toBe(largeId);
  });

  it('never reuses a pickup code across two stores and always uses the restricted alphabet', async () => {
    await truncateAll();
    for (const size of ['SMALL', 'MEDIUM', 'LARGE'] as const) {
      await createLocker(size);
    }

    const codes: string[] = [];
    for (const size of ['SMALL', 'MEDIUM', 'LARGE'] as const) {
      const response = await storePackage({ size });
      expect(response.statusCode).toBe(201);
      const { pickupCode } = response.json() as { pickupCode: string };
      expect(pickupCode).toMatch(CODE_PATTERN);
      codes.push(pickupCode);
    }

    expect(new Set(codes).size).toBe(codes.length);
  });

  it('concurrency smoke: two truly-parallel stores into one free locker — one 201, one 409', async () => {
    await truncateAll();
    const prisma = getTestPrisma();
    const lockerId = await createLocker('MEDIUM');

    // Both stores fit MEDIUM, only one locker exists: the SKIP LOCKED scan
    // must let exactly one transaction through and refuse the other.
    const [first, second] = await Promise.all([
      storePackage({ size: 'MEDIUM' }),
      storePackage({ size: 'MEDIUM' }),
    ]);

    const statuses = [first.statusCode, second.statusCode].sort();
    expect(statuses).toEqual([201, 409]);

    const winners = [first, second].filter((r) => r.statusCode === 201);
    expect(
      (winners[0]!.json() as { lockerId: string }).lockerId,
    ).toBe(lockerId);

    // The loser must be side-effect free: one package row, one occupied locker.
    expect(await prisma.storedPackage.count()).toBe(1);
    const locker = await prisma.locker.findUniqueOrThrow({ where: { id: lockerId } });
    expect(locker.occupiedBy).toBeTypeOf('string');
  });

  it('records the response pickup code only in stored_package rows', async () => {
    await truncateAll();
    const prisma = getTestPrisma();
    await createLocker('SMALL');

    const response = await storePackage({ size: 'SMALL' });
    const { pickupCode } = response.json() as { pickupCode: string };

    const rows = await prisma.storedPackage.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.pickupCode).toBe(pickupCode);
    expect(await prisma.locker.count({ where: { occupiedBy: null } })).toBe(0);
  });
});
