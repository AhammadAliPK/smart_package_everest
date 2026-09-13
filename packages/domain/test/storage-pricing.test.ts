import { describe, expect, it } from 'vitest';

import { StoragePricingPolicy } from '../src/storage-pricing.js';

/**
 * Table-driven tests for the tiered storage charge (FR9, AD-5).
 *
 * Day counting is ceiling-based: day 1 starts at storage, an exact 24h is
 * still 1 day, 24h+1min is 2 days. Tiers stack — 1–5 days at X, 6–10 at 2X,
 * 11+ at 3X — and the breakdown lists only the tiers actually used.
 */

/** Midnight-anchored instants keep every case exact to the minute. */
const STORED_AT = new Date('2026-09-01T00:00:00.000Z');

function daysCharged(elapsedMs: number): number {
  return Math.ceil(elapsedMs / 86_400_000);
}

function at(elapsedMs: number): Date {
  return new Date(STORED_AT.getTime() + elapsedMs);
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('StoragePricingPolicy.charge', () => {
  it.each([
    ['stored and retrieved in the same instant', 0],
    ['one minute of storage', MINUTE],
    ['just under 24h', 24 * HOUR - MINUTE],
    ['an exact 24h', DAY],
  ])('charges one day at the base fee for %s', (_label, elapsed) => {
    const charge = StoragePricingPolicy.charge(STORED_AT, at(elapsed), 10);

    expect(charge.daysCharged).toBe(1);
    expect(charge.storageCharge).toBe(10);
    expect(charge.breakdown).toEqual([
      { tier: 1, days: 1, rate: 10, amount: 10 },
    ]);
  });

  it('charges a second day the minute after 24h (ceiling rule)', () => {
    const charge = StoragePricingPolicy.charge(
      STORED_AT,
      at(DAY + MINUTE),
      10,
    );

    expect(charge.daysCharged).toBe(2);
    expect(charge.storageCharge).toBe(20);
  });

  it.each([
    ['1 day', DAY, 10],
    ['2 days', 2 * DAY, 20],
    ['5 days (top of tier 1)', 5 * DAY, 50],
  ])('stays in tier 1 for %s', (_label, elapsed, amount) => {
    const charge = StoragePricingPolicy.charge(STORED_AT, at(elapsed), 10);

    expect(charge.storageCharge).toBe(amount);
    expect(charge.breakdown).toHaveLength(1);
    expect(charge.breakdown[0]).toEqual({
      tier: 1,
      days: daysCharged(elapsed),
      rate: 10,
      amount,
    });
  });

  it('enters tier 2 at day 6 and tops out at day 10', () => {
    const sixDays = StoragePricingPolicy.charge(STORED_AT, at(6 * DAY), 10);
    expect(sixDays.daysCharged).toBe(6);
    expect(sixDays.storageCharge).toBe(5 * 10 + 1 * 20);
    expect(sixDays.breakdown).toEqual([
      { tier: 1, days: 5, rate: 10, amount: 50 },
      { tier: 2, days: 1, rate: 20, amount: 20 },
    ]);

    const tenDays = StoragePricingPolicy.charge(STORED_AT, at(10 * DAY), 10);
    expect(tenDays.daysCharged).toBe(10);
    expect(tenDays.storageCharge).toBe(5 * 10 + 5 * 20);
    expect(tenDays.breakdown).toEqual([
      { tier: 1, days: 5, rate: 10, amount: 50 },
      { tier: 2, days: 5, rate: 20, amount: 100 },
    ]);
  });

  it('spreads a 12-day stay across all three tiers (210 at X=10)', () => {
    const charge = StoragePricingPolicy.charge(STORED_AT, at(12 * DAY), 10);

    expect(charge.daysCharged).toBe(12);
    expect(charge.storageCharge).toBe(210);
    expect(charge.breakdown).toEqual([
      { tier: 1, days: 5, rate: 10, amount: 50 },
      { tier: 2, days: 5, rate: 20, amount: 100 },
      { tier: 3, days: 2, rate: 30, amount: 60 },
    ]);
    // The breakdown must reconcile with the headline fields (AD-5).
    expect(
      charge.breakdown.reduce((sum, row) => sum + row.amount, 0),
    ).toBe(charge.storageCharge);
    expect(
      charge.breakdown.reduce((sum, row) => sum + row.days, 0),
    ).toBe(charge.daysCharged);
  });

  it('keeps charging tier 3 indefinitely (100 days)', () => {
    const charge = StoragePricingPolicy.charge(STORED_AT, at(100 * DAY), 10);

    expect(charge.daysCharged).toBe(100);
    expect(charge.storageCharge).toBe(50 + 100 + 90 * 30);
    expect(charge.breakdown).toEqual([
      { tier: 1, days: 5, rate: 10, amount: 50 },
      { tier: 2, days: 5, rate: 20, amount: 100 },
      { tier: 3, days: 90, rate: 30, amount: 2_700 },
    ]);
  });

  it('honours a non-default base fee (X=7)', () => {
    const charge = StoragePricingPolicy.charge(STORED_AT, at(6 * DAY), 7);

    expect(charge.storageCharge).toBe(5 * 7 + 1 * 14);
    expect(charge.breakdown).toEqual([
      { tier: 1, days: 5, rate: 7, amount: 35 },
      { tier: 2, days: 1, rate: 14, amount: 14 },
    ]);
  });

  it('works with the minimum base fee X=1', () => {
    const charge = StoragePricingPolicy.charge(STORED_AT, at(12 * DAY), 1);

    expect(charge.storageCharge).toBe(5 + 10 + 6);
    expect(charge.breakdown.map((row) => row.rate)).toEqual([1, 2, 3]);
  });

  it('returns integers only — never floats (AD-5)', () => {
    const charge = StoragePricingPolicy.charge(
      STORED_AT,
      at(13 * DAY + 7 * HOUR + 123),
      10,
    );

    expect(Number.isInteger(charge.storageCharge)).toBe(true);
    expect(Number.isInteger(charge.daysCharged)).toBe(true);
    for (const row of charge.breakdown) {
      expect(Number.isInteger(row.days)).toBe(true);
      expect(Number.isInteger(row.rate)).toBe(true);
      expect(Number.isInteger(row.amount)).toBe(true);
    }
  });

  it('derives the charge from the instants alone (no wall-clock reads)', () => {
    // Same elapsed window expressed at a different absolute time — the
    // policy must be a pure function of (storedAt, retrievedAt, baseFee).
    const shifted = new Date(STORED_AT.getTime() + 999 * DAY);
    const a = StoragePricingPolicy.charge(STORED_AT, at(6 * DAY), 10);
    const b = StoragePricingPolicy.charge(shifted, at(999 * DAY + 6 * DAY), 10);

    expect(b).toEqual(a);
  });
});
