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
 * Integration suite for Story 2.3 — the charge in the retrieval reply is
 * computed from the *recorded* `storedAt` (FR5, FR9, AD-5), not from anything
 * the request carries. Each case stores a package through the real route,
 * backdates the row to a controlled age, retrieves through the real route,
 * and asserts the exact integer charge and tier breakdown.
 */

/**
 * One backdated case: age of the package at pickup. Ages sit one minute
 * *inside* their day window — an exact multiple of 24h could tip over the
 * ceiling with a few ms of test latency, and the exact-boundary semantics
 * (exact 24h = 1 day) are pinned precisely by the pure domain unit tests,
 * which control both instants. Negative minutes shave the age.
 */
const CASES = [
  { label: 'a stay just under 24h', days: 1, minutes: -1, daysCharged: 1, charge: 10 },
  { label: 'a stay just over 24h', days: 1, minutes: 1, daysCharged: 2, charge: 20 },
  { label: 'a stay just under 6 days', days: 6, minutes: -1, daysCharged: 6, charge: 70 },
  { label: 'a stay just under 12 days', days: 12, minutes: -1, daysCharged: 12, charge: 210 },
] as const;

describe('POST /pickups — charges from recorded storedAt (integration)', () => {
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

  /** Store one package, backdate it by days+minutes, then pick it up. */
  async function pickUpBackdated(
    days: number,
    minutes: number,
  ): Promise<{ status: number; body: Record<string, unknown> }> {
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

    // Backdate the recorded storage instant: the row keeps its original
    // pickup code and locker; only its age changes.
    await prisma.$executeRawUnsafe(
      `UPDATE stored_package
       SET stored_at = now() - interval '${days} days' - interval '${minutes} minutes'
       WHERE pickup_code = $1`,
      pickupCode,
    );

    const response = await app!.inject({
      method: 'POST',
      url: '/pickups',
      payload: { lockerId, pickupCode },
    });
    return { status: response.statusCode, body: response.json() };
  }

  it.each(CASES.map((c) => [c.label, c] as const))(
    'charges %s exactly, from the row, not the request',
    async (_label, testCase) => {
      await truncateAll();

      const { status, body } = await pickUpBackdated(
        testCase.days,
        testCase.minutes,
      );

      expect(status).toBe(200);
      expect(body.daysCharged).toBe(testCase.daysCharged);
      expect(body.storageCharge).toBe(testCase.charge);
      // The breakdown is derived per tier, only for tiers actually used.
      expect(body.breakdown).toEqual(expectedBreakdown(testCase.daysCharged, 10));
    },
  );

  it('spreads a 12-day stay across all three tiers with reconciling rows', async () => {
    await truncateAll();

    const { body } = await pickUpBackdated(12, -1);

    expect(body.breakdown).toEqual([
      { tier: 1, days: 5, rate: 10, amount: 50 },
      { tier: 2, days: 5, rate: 20, amount: 100 },
      { tier: 3, days: 2, rate: 30, amount: 60 },
    ]);
    const rows = body.breakdown as { days: number; amount: number }[];
    expect(rows.reduce((sum, row) => sum + row.amount, 0)).toBe(
      body.storageCharge,
    );
    expect(rows.reduce((sum, row) => sum + row.days, 0)).toBe(body.daysCharged);
  });

  it('ignores any charge-looking fields a client might send', async () => {
    await truncateAll();

    // A client cannot influence the charge: no charge field exists on the
    // request contract, and any smuggled extra is a 400 (closed schema).
    const response = await app!.inject({
      method: 'POST',
      url: '/pickups',
      payload: { lockerId: 'cwhatever00000000000000', pickupCode: 'AAAAAAAA', storageCharge: 0 },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });
});

/** The expected tier segmentation of `days` at base fee X. */
function expectedBreakdown(
  days: number,
  baseFee: number,
): { tier: number; days: number; rate: number; amount: number }[] {
  const rows: { tier: number; days: number; rate: number; amount: number }[] = [];
  const tiers = [
    { tier: 1, days: Math.min(days, 5), rate: baseFee },
    { tier: 2, days: Math.min(Math.max(days - 5, 0), 5), rate: 2 * baseFee },
    { tier: 3, days: Math.max(days - 10, 0), rate: 3 * baseFee },
  ];
  for (const { tier, days: tierDays, rate } of tiers) {
    if (tierDays > 0) {
      rows.push({ tier, days: tierDays, rate, amount: tierDays * rate });
    }
  }
  return rows;
}
