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
 * Integration suite for `GET /lockers` — the AD-1 frozen list contract:
 * `200 {"lockers":[{"id","size","occupied"}]}`, ordered by `id`, nothing else.
 * Isolation is truncate-after-suite (see test-db.ts).
 */
describe('GET /lockers (integration)', () => {
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

  it('answers 200 with an empty list on an empty station — never 404', async () => {
    await truncateAll();

    const response = await app!.inject({ method: 'GET', url: '/lockers' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.json()).toEqual({ lockers: [] });
  });

  it('lists every locker ordered by id with exactly the three frozen fields', async () => {
    await truncateAll();

    // Created deliberately out of alphabetical id order: the reply must still
    // come back ordered by id.
    const created: { id: string; size: string }[] = [];
    for (const size of ['LARGE', 'SMALL', 'MEDIUM'] as const) {
      const response = await app!.inject({
        method: 'POST',
        url: '/lockers',
        payload: { size },
      });
      expect(response.statusCode).toBe(201);
      const body = response.json();
      created.push({ id: body.lockerId, size });
    }

    const response = await app!.inject({ method: 'GET', url: '/lockers' });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(Object.keys(body)).toEqual(['lockers']);

    const ordered = [...created].sort((a, b) => (a.id < b.id ? -1 : 1));
    expect(body.lockers).toHaveLength(3);
    expect(body.lockers.map((l: { id: string }) => l.id)).toEqual(
      ordered.map((locker) => locker.id),
    );

    for (const [index, item] of body.lockers.entries()) {
      expect(Object.keys(item).sort()).toEqual(['id', 'occupied', 'size']);
      expect(item).toEqual({
        id: ordered[index]?.id,
        size: ordered[index]?.size,
        occupied: false,
      });
    }
  });

  it('derives occupied from occupied_by and carries no package detail (AD-1)', async () => {
    await truncateAll();
    const prisma = getTestPrisma();

    const response = await app!.inject({
      method: 'POST',
      url: '/lockers',
      payload: { size: 'SMALL' },
    });
    expect(response.statusCode).toBe(201);
    const lockerId = response.json().lockerId as string;

    // Simulate occupancy directly on the column the store transaction CASes —
    // the list must reflect it and must not expose any package fields.
    await prisma.locker.update({
      where: { id: lockerId },
      data: { occupiedBy: 'cpackageidplaceholder' },
    });

    const list = await app!.inject({ method: 'GET', url: '/lockers' });

    expect(list.statusCode).toBe(200);
    const body = list.json();
    expect(body.lockers).toEqual([
      { id: lockerId, size: 'SMALL', occupied: true },
    ]);
    expect(JSON.stringify(body)).not.toContain('pickupCode');
    expect(JSON.stringify(body)).not.toContain('cpackageidplaceholder');
  });

  it('exposes GET /lockers in the OpenAPI document', async () => {
    const response = await app!.inject({ method: 'GET', url: '/docs/json' });

    expect(response.statusCode).toBe(200);
    const document = response.json() as {
      paths: Record<string, Record<string, unknown>>;
    };
    expect(document.paths['/lockers']?.get).toBeDefined();
  });
});
