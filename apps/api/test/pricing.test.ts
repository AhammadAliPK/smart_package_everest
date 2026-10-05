import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Locker, LockerRepository } from '../src/application/ports/locker-repository.js';
import type { LockerSize } from '@locker/domain';
import { buildApp } from '../src/adapters/http/app.js';
import type { Env } from '../src/config/env.js';

/** The rate card is static metadata: an in-memory port keeps this suite DB-free. */
class UnusedLockerRepository implements LockerRepository {
  async create(
    size: LockerSize,
    _nextLockerId: () => string,
  ): Promise<Locker> {
    return { lockerId: 'unused', size, occupied: false };
  }

  async list(): Promise<Locker[]> {
    return [];
  }
}

/** The exact 200 body the default base fee (10) must produce. */
const EXPECTED_AT_10 = {
  baseFee: 10,
  tiers: [
    { tier: 1, fromDay: 1, toDay: 5, perDay: 10 },
    { tier: 2, fromDay: 6, toDay: 10, perDay: 20 },
    { tier: 3, fromDay: 11, toDay: null, perDay: 30 },
  ],
};

describe('GET /pricing (FR9 rate card)', () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  beforeAll(async () => {
    app = await buildApp(
      {
        databaseUrl: 'postgres://unused:unused@localhost:5432/unused',
        port: 0,
        storageFeeBase: 10,
      } satisfies Env,
      { logger: false, lockerRepository: new UnusedLockerRepository() },
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  it('serves the base fee and the three stacking tiers, nothing else', async () => {
    const response = await app!.inject({ method: 'GET', url: '/pricing' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    // toEqual (not toMatchObject): the contract is closed — any extra field
    // the route ever grows must be a deliberate schema change, not drift.
    expect(response.json()).toEqual(EXPECTED_AT_10);
  });

  it('reconciles with what POST /pickups actually charges', async () => {
    // The rate card a customer sees before retrieving must be the card the
    // retrieval itself prices by: tier 1's perDay is the base fee, and the
    // tiers escalate ×1/×2/×3 — the same multipliers the charge breakdown
    // carries (see pickup-charges.test.ts).
    const { tiers } = (await app!.inject({ method: 'GET', url: '/pricing' }))
      .json() as typeof EXPECTED_AT_10;

    expect(tiers.map((row) => row.perDay)).toEqual([10, 20, 30]);
    expect(tiers[0]!.perDay).toBe(EXPECTED_AT_10.baseFee);
  });

  it('honours a non-default STORAGE_FEE_BASE', async () => {
    const other = await buildApp(
      {
        databaseUrl: 'postgres://unused:unused@localhost:5432/unused',
        port: 0,
        storageFeeBase: 7,
      } satisfies Env,
      { logger: false, lockerRepository: new UnusedLockerRepository() },
    );
    try {
      const response = await other.inject({ method: 'GET', url: '/pricing' });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        baseFee: 7,
        tiers: [
          { tier: 1, fromDay: 1, toDay: 5, perDay: 7 },
          { tier: 2, fromDay: 6, toDay: 10, perDay: 14 },
          { tier: 3, fromDay: 11, toDay: null, perDay: 21 },
        ],
      });
    } finally {
      await other.close();
    }
  });

  it('documents the endpoint in the OpenAPI collection (AD-1)', async () => {
    const response = await app!.inject({ method: 'GET', url: '/docs/json' });

    expect(response.statusCode).toBe(200);
    const document = response.json() as {
      paths: Record<string, Record<string, { responses: Record<string, unknown> }>>;
    };

    const get = document.paths['/pricing']?.get;
    expect(get).toBeDefined();
    expect(Object.keys(get?.responses ?? {})).toContain('200');
    expect(JSON.stringify(get)).toContain('baseFee');
    expect(JSON.stringify(get)).toContain('perDay');
  });
});
