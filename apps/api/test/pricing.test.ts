import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Locker, LockerRepository } from '../src/application/ports/locker-repository.js';
import type { PricingConfigRepository } from '../src/application/ports/pricing-config-repository.js';
import type { LockerSize } from '@locker/domain';
import { buildApp } from '../src/adapters/http/app.js';
import type { Env } from '../src/config/env.js';

/** The rate card is a read: in-memory ports keep this suite DB-free. */
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

/** Fees as the seeded migration ships them (SMALL keeps the default 10). */
const SEEDED_FEES: Record<LockerSize, number> = {
  SMALL: 10,
  MEDIUM: 15,
  LARGE: 20,
};

class InMemoryPricingConfig implements PricingConfigRepository {
  constructor(private readonly fees: Record<LockerSize, number>) {}

  async getBaseFee(size: LockerSize): Promise<number> {
    return this.fees[size];
  }
}

describe('GET /pricing (FR9 size-based rate card)', () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  beforeAll(async () => {
    app = await buildApp(
      {
        databaseUrl: 'postgres://unused:unused@localhost:5432/unused',
        port: 0,
        storageFeeBase: 10,
      } satisfies Env,
      {
        logger: false,
        lockerRepository: new UnusedLockerRepository(),
        pricingConfigRepository: new InMemoryPricingConfig(SEEDED_FEES),
      },
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  it('serves one fully-priced block per size, nothing else', async () => {
    const response = await app!.inject({ method: 'GET', url: '/pricing' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    // toEqual (not toMatchObject): the contract is closed — any extra field
    // the route ever grows must be a deliberate schema change, not drift.
    expect(response.json()).toEqual({
      sizes: [
        {
          size: 'SMALL',
          baseFee: 10,
          tiers: [
            { tier: 1, fromDay: 1, toDay: 5, perDay: 10 },
            { tier: 2, fromDay: 6, toDay: 10, perDay: 20 },
            { tier: 3, fromDay: 11, toDay: null, perDay: 30 },
          ],
        },
        {
          size: 'MEDIUM',
          baseFee: 15,
          tiers: [
            { tier: 1, fromDay: 1, toDay: 5, perDay: 15 },
            { tier: 2, fromDay: 6, toDay: 10, perDay: 30 },
            { tier: 3, fromDay: 11, toDay: null, perDay: 45 },
          ],
        },
        {
          size: 'LARGE',
          baseFee: 20,
          tiers: [
            { tier: 1, fromDay: 1, toDay: 5, perDay: 20 },
            { tier: 2, fromDay: 6, toDay: 10, perDay: 40 },
            { tier: 3, fromDay: 11, toDay: null, perDay: 60 },
          ],
        },
      ],
    });
  });

  it('reflects a fee change without a deploy — configuration, not policy', async () => {
    const repriced = await buildApp(
      {
        databaseUrl: 'postgres://unused:unused@localhost:5432/unused',
        port: 0,
        storageFeeBase: 10,
      } satisfies Env,
      {
        logger: false,
        lockerRepository: new UnusedLockerRepository(),
        pricingConfigRepository: new InMemoryPricingConfig({
          ...SEEDED_FEES,
          LARGE: 25,
        }),
      },
    );
    try {
      const response = await repriced.inject({ method: 'GET', url: '/pricing' });
      const { sizes } = response.json() as {
        sizes: { size: string; baseFee: number }[];
      };

      expect(response.statusCode).toBe(200);
      expect(sizes.find((s) => s.size === 'LARGE')?.baseFee).toBe(25);
      expect(sizes.find((s) => s.size === 'SMALL')?.baseFee).toBe(10);
    } finally {
      await repriced.close();
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
    const schemaText = JSON.stringify(get);
    expect(schemaText).toContain('baseFee');
    expect(schemaText).toContain('perDay');
    expect(schemaText).toContain('MEDIUM');
  });
});
