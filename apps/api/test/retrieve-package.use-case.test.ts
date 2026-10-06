import { describe, expect, it } from 'vitest';

import type { LockerSize } from '@locker/domain';

import type { PricingConfigRepository } from '../src/application/ports/pricing-config-repository.js';
import type {
  PackageAllocation,
  PackageAllocationRequest,
  PackageRetrieval,
  PackageRepository,
} from '../src/application/ports/package-repository.js';
import { RetrievePackage } from '../src/application/use-cases/retrieve-package.js';

/**
 * Unit tests for the `RetrievePackage` use case (FR7–FR9).
 *
 * Both ports are scripted mocks: these tests pin the use case's own duties —
 * validating the request shape, pricing the stay via the fee the pricing
 * config resolves for the locker's size (AD-5) and passing the four outcome
 * errors through untouched — while the integration suites prove the real
 * transaction.
 */

const STORED_AT = new Date('2026-09-07T09:15:00.000Z');
const RETRIEVED_AT = new Date('2026-09-13T09:15:00.000Z'); // exactly 6 days

class ScriptedPackageRepository implements PackageRepository {
  readonly retrieveCalls: { lockerId: string; pickupCode: string }[] = [];
  /** What the scripted transaction will return — or the error it raises. */
  result: PackageRetrieval | Error = {
    lockerId: 'K7Q4M2',
    size: 'SMALL',
    storedAt: STORED_AT,
    retrievedAt: RETRIEVED_AT,
  };

  async allocate(
    _request: PackageAllocationRequest,
    _nextPickupCode: () => string,
  ): Promise<PackageAllocation> {
    throw new Error('allocate is not part of this suite');
  }

  async retrieve(
    lockerId: string,
    pickupCode: string,
  ): Promise<PackageRetrieval> {
    this.retrieveCalls.push({ lockerId, pickupCode });
    if (this.result instanceof Error) {
      throw this.result;
    }
    return this.result;
  }
}

class ScriptedPricingConfig implements PricingConfigRepository {
  readonly feeCalls: LockerSize[] = [];
  /** The seeded fees (SMALL keeps the historical default 10). */
  fees: Record<LockerSize, number> = { SMALL: 10, MEDIUM: 15, LARGE: 20 };

  async getBaseFee(size: LockerSize): Promise<number> {
    this.feeCalls.push(size);
    return this.fees[size];
  }
}

function makeUseCase() {
  const packages = new ScriptedPackageRepository();
  const pricingConfig = new ScriptedPricingConfig();
  return {
    packages,
    pricingConfig,
    retrievePackage: new RetrievePackage(packages, pricingConfig),
  };
}

describe('RetrievePackage use case', () => {
  it('returns the retrieval facts plus the tiered charge for the stay', async () => {
    const { retrievePackage, pricingConfig } = makeUseCase();

    const result = await retrievePackage.execute({
      lockerId: 'K7Q4M2',
      pickupCode: 'ABCDEFGH',
    });

    expect(pricingConfig.feeCalls).toEqual(['SMALL']);

    expect(result).toEqual({
      lockerId: 'K7Q4M2',
      retrievedAt: RETRIEVED_AT,
      storageCharge: 70, // 5 days × 10 + 1 day × 20
      daysCharged: 6,
      breakdown: [
        { tier: 1, days: 5, rate: 10, amount: 50 },
        { tier: 2, days: 1, rate: 20, amount: 20 },
      ],
    });
    expect(Object.keys(result).sort()).toEqual([
      'breakdown',
      'daysCharged',
      'lockerId',
      'retrievedAt',
      'storageCharge',
    ]);
  });

  it('prices a MEDIUM stay with the MEDIUM fee, not the SMALL default', async () => {
    const { packages, retrievePackage, pricingConfig } = makeUseCase();
    packages.result = {
      lockerId: 'K7Q4M2',
      size: 'MEDIUM',
      storedAt: STORED_AT,
      retrievedAt: RETRIEVED_AT,
    };

    const result = await retrievePackage.execute({
      lockerId: 'K7Q4M2',
      pickupCode: 'ABCDEFGH',
    });

    expect(pricingConfig.feeCalls).toEqual(['MEDIUM']);
    expect(result.storageCharge).toBe(5 * 15 + 1 * 30); // 105
    expect(result.breakdown.map((row) => row.rate)).toEqual([15, 30]);
  });

  it.each([
    ['lockerId is missing', { pickupCode: 'ABCDEFGH' }],
    ['lockerId is not a string', { lockerId: 42, pickupCode: 'ABCDEFGH' }],
    ['lockerId is an empty string', { lockerId: '', pickupCode: 'ABCDEFGH' }],
    ['lockerId is only whitespace', { lockerId: '   ', pickupCode: 'ABCDEFGH' }],
    ['pickupCode is missing', { lockerId: 'K7Q4M2' }],
    ['pickupCode is not a string', { lockerId: 'K7Q4M2', pickupCode: 42 }],
    ['pickupCode is too short', { lockerId: 'K7Q4M2', pickupCode: 'ABC' }],
    ['pickupCode is too long', { lockerId: 'K7Q4M2', pickupCode: 'ABCDEFGHJ' }],
  ])('rejects before touching storage when %s', async (_label, command) => {
    const { packages, retrievePackage } = makeUseCase();

    await expect(
      retrievePackage.execute(command as Record<string, unknown>),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 });
    expect(packages.retrieveCalls).toHaveLength(0);
  });

  it.each([
    ['unknown locker', 'LOCKER_NOT_FOUND', 404],
    ['wrong code for an occupied locker', 'INVALID_PICKUP_CODE', 404],
    ['nothing stored in the locker', 'LOCKER_EMPTY', 409],
  ])('passes the %s outcome through untouched', (_label, code, status) => {
    const { packages, retrievePackage } = makeUseCase();
    packages.result = Object.assign(new Error(code), {
      code,
      status,
      name: 'AppError',
    });

    return expect(
      retrievePackage.execute({
        lockerId: 'K7Q4M2',
        pickupCode: 'ABCDEFGH',
      }),
    ).rejects.toMatchObject({ code, status });
  });

  it('normalizes the typed id (trim + uppercase) before forwarding', async () => {
    const { packages, retrievePackage } = makeUseCase();

    await retrievePackage.execute({
      lockerId: '  k7q4m2 ',
      pickupCode: '23456789',
    });

    expect(packages.retrieveCalls).toEqual([
      { lockerId: 'K7Q4M2', pickupCode: '23456789' },
    ]);
  });
});
