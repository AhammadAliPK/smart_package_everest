import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { LOCKER_ID_LENGTH, PICKUP_CODE_ALPHABET } from '@locker/domain';

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
 * Integration suite: the real route stack against the real compose Postgres.
 * Isolation is truncate-after-suite (see test-db.ts).
 */

/** The AD-9 v1.1 identifier: 6 chars over the unambiguous alphabet. */
const LOCKER_ID_PATTERN = new RegExp(
  `^[${PICKUP_CODE_ALPHABET}]{${LOCKER_ID_LENGTH}}$`,
);

describe('POST /lockers (integration)', () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  beforeAll(async () => {
    await applyMigrations();
    await truncateAll();

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

  it('creates a locker and answers 201 with the AD-9 body shape', async () => {
    const response = await app!.inject({
      method: 'POST',
      url: '/lockers',
      payload: { size: 'MEDIUM' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.headers['content-type']).toContain('application/json');

    const body = response.json();
    expect(Object.keys(body).sort()).toEqual([
      'lockerId',
      'occupied',
      'size',
    ]);
    expect(body).toEqual({
      lockerId: expect.stringMatching(LOCKER_ID_PATTERN) as unknown as string,
      size: 'MEDIUM',
      occupied: false,
    });
  });

  it.each(['SMALL', 'MEDIUM', 'LARGE'] as const)(
    'persists an unoccupied %s locker row',
    async (size) => {
      const prisma = getTestPrisma();

      const response = await app!.inject({
        method: 'POST',
        url: '/lockers',
        payload: { size },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();

      const stored = await prisma.locker.findUnique({
        where: { id: body.lockerId },
      });
      expect(stored).toMatchObject({ size, occupiedBy: null });
    },
  );

  it.each([
    ['unknown size', { size: 'HUGE' }],
    ['lowercase size', { size: 'small' }],
    ['mixed case size', { size: 'Small' }],
    ['missing size', {}],
    ['null size', { size: null }],
    ['wrong type', { size: 42 }],
  ])('rejects %s with the AD-7 envelope and creates nothing', async (_label, payload) => {
    const prisma = getTestPrisma();
    const before = await prisma.locker.count();

    const response = await app!.inject({
      method: 'POST',
      url: '/lockers',
      payload: payload as Record<string, unknown>,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: expect.any(String) as unknown as string,
      },
    });

    expect(await prisma.locker.count()).toBe(before);
  });
});
