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
 * Integration suite for Story 1.5 — the graceful refusal (FR6, AD-7):
 * `NO_SUITABLE_LOCKER` is a 409 envelope and, above all, a no-op: no package
 * row, no locker state change.
 */
describe('POST /packages — graceful refusal (integration)', () => {
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

  async function createLocker(size: 'SMALL' | 'MEDIUM' | 'LARGE'): Promise<string> {
    const response = await app!.inject({
      method: 'POST',
      url: '/lockers',
      payload: { size },
    });
    expect(response.statusCode).toBe(201);
    return (response.json() as { lockerId: string }).lockerId;
  }

  it('refuses on an empty station with a 409 envelope and zero side effects', async () => {
    await truncateAll();
    const prisma = getTestPrisma();

    const response = await app!.inject({
      method: 'POST',
      url: '/packages',
      payload: { size: 'SMALL' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: {
        code: 'NO_SUITABLE_LOCKER',
        message: expect.any(String) as unknown as string,
      },
    });

    expect(await prisma.storedPackage.count()).toBe(0);
    expect(await prisma.locker.count()).toBe(0);
  });

  it('refuses when every fitting locker is occupied — rows and lockers untouched', async () => {
    await truncateAll();
    const prisma = getTestPrisma();
    const smallId = await createLocker('SMALL');
    await createLocker('MEDIUM');

    // Fill the only fitting lockers (SMALL and MEDIUM fit a SMALL package).
    await app!.inject({ method: 'POST', url: '/packages', payload: { size: 'SMALL' } });
    await app!.inject({ method: 'POST', url: '/packages', payload: { size: 'MEDIUM' } });

    const packagesBefore = await prisma.storedPackage.count();
    const lockersBefore = await prisma.locker.findMany();

    const response = await app!.inject({
      method: 'POST',
      url: '/packages',
      payload: { size: 'SMALL', customerRef: 'Late arrival' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      error: { code: 'NO_SUITABLE_LOCKER' },
    });

    expect(await prisma.storedPackage.count()).toBe(packagesBefore);
    expect(await prisma.locker.findMany()).toEqual(lockersBefore);
    expect(lockersBefore.every((locker) => locker.occupiedBy !== null)).toBe(
      true,
    );
    expect(smallId).toBeTypeOf('string');
  });

  it('per-size exhaustion: a SMALL package still fits a free MEDIUM locker', async () => {
    await truncateAll();
    const prisma = getTestPrisma();
    const smallId = await createLocker('SMALL');
    const mediumId = await createLocker('MEDIUM');

    // Occupy the SMALL locker; the MEDIUM stays free.
    await app!.inject({ method: 'POST', url: '/packages', payload: { size: 'SMALL' } });

    const response = await app!.inject({
      method: 'POST',
      url: '/packages',
      payload: { size: 'SMALL' },
    });

    expect(response.statusCode).toBe(201);
    expect((response.json() as { lockerId: string }).lockerId).toBe(mediumId);
    expect(await prisma.locker.findUniqueOrThrow({ where: { id: smallId } }))
      .toMatchObject({ occupiedBy: expect.any(String) as unknown as string });
  });

  it('rejects an invalid size with 400 VALIDATION_ERROR and writes nothing', async () => {
    await truncateAll();
    const prisma = getTestPrisma();
    await createLocker('SMALL');
    const lockersBefore = await prisma.locker.findMany();

    // Wrong-typed `customerRef` is intentionally absent here: Fastify's
    // default Ajv coerces scalars, so `42` arrives at the use case as "42".
    // The use case still rejects non-strings — proven in
    // store-package.use-case.test.ts.
    for (const payload of [
      { size: 'HUGE' },
      { size: 'small' },
      { size: 42 },
      {},
    ]) {
      const response = await app!.inject({
        method: 'POST',
        url: '/packages',
        payload: payload as Record<string, unknown>,
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    expect(await prisma.storedPackage.count()).toBe(0);
    expect(await prisma.locker.findMany()).toEqual(lockersBefore);
  });

  it('exposes POST /packages in the OpenAPI document', async () => {
    const response = await app!.inject({ method: 'GET', url: '/docs/json' });

    expect(response.statusCode).toBe(200);
    const document = response.json() as {
      paths: Record<string, Record<string, { responses: Record<string, unknown> }>>;
    };
    const post = document.paths['/packages']?.post;
    expect(post).toBeDefined();
    expect(Object.keys(post?.responses ?? {})).toContain('201');
  });
});
