import { describe, expect, it } from 'vitest';

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
 * The port is a scripted mock: these tests pin the use case's own duties —
 * validating the request shape, pricing the stay via the injected base fee
 * (AD-5) and passing the four outcome errors through untouched — while the
 * integration suites prove the real transaction.
 */

const STORED_AT = new Date('2026-09-07T09:15:00.000Z');
const RETRIEVED_AT = new Date('2026-09-13T09:15:00.000Z'); // exactly 6 days

class ScriptedPackageRepository implements PackageRepository {
  readonly retrieveCalls: { lockerId: string; pickupCode: string }[] = [];
  /** What the scripted transaction will return — or the error it raises. */
  result: PackageRetrieval | Error = {
    lockerId: 'clocker0000000000000000',
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

function makeUseCase(baseFee = 10) {
  const packages = new ScriptedPackageRepository();
  return {
    packages,
    retrievePackage: new RetrievePackage(packages, baseFee),
  };
}

describe('RetrievePackage use case', () => {
  it('returns the retrieval facts plus the tiered charge for the stay', async () => {
    const { retrievePackage } = makeUseCase(10);

    const result = await retrievePackage.execute({
      lockerId: 'clocker0000000000000000',
      pickupCode: 'ABCDEFGH',
    });

    expect(result).toEqual({
      lockerId: 'clocker0000000000000000',
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

  it('prices with the injected base fee (X=7 → 49 for six days)', async () => {
    const { retrievePackage } = makeUseCase(7);

    const result = await retrievePackage.execute({
      lockerId: 'clocker0000000000000000',
      pickupCode: 'ABCDEFGH',
    });

    expect(result.storageCharge).toBe(5 * 7 + 1 * 14);
    expect(result.breakdown.map((row) => row.rate)).toEqual([7, 14]);
  });

  it.each([
    ['lockerId is missing', { pickupCode: 'ABCDEFGH' }],
    ['lockerId is not a string', { lockerId: 42, pickupCode: 'ABCDEFGH' }],
    ['lockerId is an empty string', { lockerId: '', pickupCode: 'ABCDEFGH' }],
    ['pickupCode is missing', { lockerId: 'clocker0000000000000000' }],
    ['pickupCode is not a string', { lockerId: 'clocker0000000000000000', pickupCode: 42 }],
    ['pickupCode is too short', { lockerId: 'clocker0000000000000000', pickupCode: 'ABC' }],
    ['pickupCode is too long', { lockerId: 'clocker0000000000000000', pickupCode: 'ABCDEFGHJ' }],
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
        lockerId: 'clocker0000000000000000',
        pickupCode: 'ABCDEFGH',
      }),
    ).rejects.toMatchObject({ code, status });
  });

  it('forwards the exact lockerId and pickupCode to the port', async () => {
    const { packages, retrievePackage } = makeUseCase();

    await retrievePackage.execute({
      lockerId: 'cexact00000000000000000',
      pickupCode: '23456789',
    });

    expect(packages.retrieveCalls).toEqual([
      { lockerId: 'cexact00000000000000000', pickupCode: '23456789' },
    ]);
  });
});
