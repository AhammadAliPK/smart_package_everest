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
 * Integration suite for Story 2.2 — the four calm invalid outcomes of
 * `POST /pickups` (FR8, AD-7), each proven side-effect free down to the rows:
 *
 *   malformed body        → 400 VALIDATION_ERROR
 *   unknown lockerId      → 404 LOCKER_NOT_FOUND
 *   wrong code            → 404 INVALID_PICKUP_CODE (no burn — retry works)
 *   nothing in the locker → 409 LOCKER_EMPTY (never stored, or already taken)
 */

const UNKNOWN_LOCKER = 'cdoesnotexist0000000000';

describe('POST /pickups — invalid outcomes (integration)', () => {
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

  /** Store one SMALL package and return where it landed. */
  async function storeOne(): Promise<{ lockerId: string; pickupCode: string }> {
    await createLocker('SMALL');
    const response = await app!.inject({
      method: 'POST',
      url: '/packages',
      payload: { size: 'SMALL' },
    });
    expect(response.statusCode).toBe(201);
    return response.json() as { lockerId: string; pickupCode: string };
  }

  function pickUp(payload: unknown) {
    return app!.inject({
      method: 'POST',
      url: '/pickups',
      payload: payload as Record<string, unknown>,
    });
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

  it('answers 400 VALIDATION_ERROR for every malformed shape and writes nothing', async () => {
    await truncateAll();
    const prisma = getTestPrisma();
    const { lockerId, pickupCode } = await storeOne();
    const lockersBefore = await prisma.locker.findMany();
    const packagesBefore = await prisma.storedPackage.findMany();

    for (const payload of [
      {}, // both fields missing
      { lockerId }, // pickupCode missing
      { pickupCode }, // lockerId missing
      { lockerId: '', pickupCode }, // empty lockerId
      { lockerId, pickupCode: 'ABC' }, // too short
      { lockerId, pickupCode: 'ABCDEFGHJ' }, // too long
      { lockerId, pickupCode, extra: 'field' }, // additional property
    ]) {
      const response = await pickUp(payload);

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    // Fastify's default Ajv coerces scalars (`42` arrives as `"42"` — the
    // documented store-refusal precedent), so a numeric lockerId is a
    // well-formed *unknown* id: the calm LOCKER_NOT_FOUND 404, not a 400.
    // A numeric pickupCode is coerced the same way and then fails the
    // 8-character rule → VALIDATION_ERROR. The use case's own non-string
    // rejection is pinned in retrieve-package.use-case.test.ts.
    const numericCode = await pickUp({ lockerId, pickupCode: 42 });
    expect(numericCode.statusCode).toBe(400);
    expect(numericCode.json()).toMatchObject({
      error: { code: 'VALIDATION_ERROR' },
    });
    const numericLockerId = await pickUp({ lockerId: 42, pickupCode });
    expect(numericLockerId.statusCode).toBe(404);
    expect(numericLockerId.json()).toMatchObject({
      error: { code: 'LOCKER_NOT_FOUND' },
    });

    expect(await prisma.locker.findMany()).toEqual(lockersBefore);
    expect(await prisma.storedPackage.findMany()).toEqual(packagesBefore);
  });

  it('answers 404 LOCKER_NOT_FOUND for an unknown lockerId, writing nothing', async () => {
    await truncateAll();
    const prisma = getTestPrisma();
    const stored = await storeOne();
    const lockersBefore = await prisma.locker.findMany();
    const packagesBefore = await prisma.storedPackage.findMany();

    const response = await pickUp({
      lockerId: UNKNOWN_LOCKER,
      pickupCode: stored.pickupCode,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: 'LOCKER_NOT_FOUND',
        message: expect.any(String) as unknown as string,
      },
    });
    expect(await prisma.locker.findMany()).toEqual(lockersBefore);
    expect(await prisma.storedPackage.findMany()).toEqual(packagesBefore);
  });

  it('answers 404 INVALID_PICKUP_CODE for a wrong code with zero writes — the right code still works immediately', async () => {
    await truncateAll();
    const prisma = getTestPrisma();
    const { lockerId, pickupCode } = await storeOne();

    // A well-formed code from the restricted alphabet, but not this one.
    const wrongCode = pickupCode === 'AAAAAAAA' ? 'BBBBBBBB' : 'AAAAAAAA';

    const lockersBefore = await prisma.locker.findMany();
    const packagesBefore = await prisma.storedPackage.findMany();

    const response = await pickUp({ lockerId, pickupCode: wrongCode });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: 'INVALID_PICKUP_CODE',
        message: expect.any(String) as unknown as string,
      },
    });

    // Zero mutation: locker still occupied, package still STORED and un-dated.
    expect(await prisma.locker.findMany()).toEqual(lockersBefore);
    expect(await prisma.storedPackage.findMany()).toEqual(packagesBefore);
    expect(
      (await prisma.storedPackage.findMany())[0]!.retrievedAt,
    ).toBeNull();

    // No burn: the correct code succeeds on the very next attempt.
    const retry = await pickUp({ lockerId, pickupCode });
    expect(retry.statusCode).toBe(200);
    expect(
      (retry.json() as { lockerId: string }).lockerId,
    ).toBe(lockerId);
  });

  it('answers 409 LOCKER_EMPTY for a locker that never held anything', async () => {
    await truncateAll();
    const prisma = getTestPrisma();
    const lockerId = await createLocker('SMALL');
    const lockersBefore = await prisma.locker.findMany();

    const response = await pickUp({ lockerId, pickupCode: 'AAAAAAAA' });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: {
        code: 'LOCKER_EMPTY',
        message: expect.any(String) as unknown as string,
      },
    });
    expect(await prisma.locker.findMany()).toEqual(lockersBefore);
    expect(await prisma.storedPackage.count()).toBe(0);
  });

  it('answers 409 LOCKER_EMPTY when the package was already retrieved', async () => {
    await truncateAll();
    const prisma = getTestPrisma();
    const { lockerId, pickupCode } = await storeOne();

    const first = await pickUp({ lockerId, pickupCode });
    expect(first.statusCode).toBe(200);

    const repeat = await pickUp({ lockerId, pickupCode });

    expect(repeat.statusCode).toBe(409);
    expect(repeat.json()).toEqual({
      error: {
        code: 'LOCKER_EMPTY',
        message: expect.any(String) as unknown as string,
      },
    });

    // Still exactly one RETRIEVED package; the repeat mutated nothing.
    const packages = await prisma.storedPackage.findMany();
    expect(packages).toHaveLength(1);
    expect(packages[0]).toMatchObject({
      status: 'RETRIEVED',
      retrievedAt: new Date((first.json() as { retrievedAt: string }).retrievedAt),
    });
    expect(
      (await prisma.locker.findUniqueOrThrow({ where: { id: lockerId } }))
        .occupiedBy,
    ).toBeNull();
  });
});
