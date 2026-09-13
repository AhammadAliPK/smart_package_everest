import { describe, expect, it } from 'vitest';

import {
  pickSmallestFitting,
  PICKUP_CODE_ALPHABET,
  type FreeLocker,
} from '@locker/domain';

import type { Locker, LockerRepository } from '../src/application/ports/locker-repository.js';
import type {
  PackageAllocation,
  PackageAllocationRequest,
  PackageRetrieval,
  PackageRepository,
} from '../src/application/ports/package-repository.js';
import { StorePackage } from '../src/application/use-cases/store-package.js';

/**
 * In-memory locker port for seeding the station.
 */
class InMemoryLockerRepository implements LockerRepository {
  readonly lockers: Locker[] = [];
  private nextId = 0;

  async create(size: Locker['size']): Promise<Locker> {
    const locker: Locker = {
      lockerId: `c${(this.nextId++).toString(36).padStart(24, '0')}`,
      size,
      occupied: false,
    };
    this.lockers.push(locker);
    return locker;
  }

  async list(): Promise<Locker[]> {
    return this.lockers;
  }
}

/**
 * In-memory package port that mirrors the store transaction's rule with the
 * pure domain function: smallest fitting free locker wins, nothing free
 * raises `NoSuitableLockerError`. This is the unit-tested path the SQL
 * re-expresses for real concurrency (AD-3).
 */
class InMemoryPackageRepository implements PackageRepository {
  readonly allocations: (PackageAllocation & { request: PackageAllocationRequest })[] = [];
  /** Codes already handed out, to prove the generator is asked again on collision. */
  private issued = new Set<string>();

  constructor(
    private readonly lockers: LockerRepository,
    private readonly failWith?: Error,
  ) {}

  async allocate(
    request: PackageAllocationRequest,
    nextPickupCode: () => string,
  ): Promise<PackageAllocation> {
    if (this.failWith) {
      throw this.failWith;
    }

    const free = (await this.lockers.list()).filter(
      (locker) => !locker.occupied,
    );
    const chosen: FreeLocker | null = pickSmallestFitting(
      free.map((locker) => ({ lockerId: locker.lockerId, size: locker.size })),
      request.size,
    );
    if (!chosen) {
      throw Object.assign(new Error('No locker is available'), {
        name: 'NoSuitableLockerError',
        code: 'NO_SUITABLE_LOCKER',
        status: 409,
      });
    }

    let pickupCode = nextPickupCode();
    let regeneration = 0;
    while (this.issued.has(pickupCode)) {
      pickupCode = nextPickupCode();
      regeneration += 1;
      if (regeneration > 10) {
        throw new Error('pickup-code generator keeps colliding');
      }
    }
    this.issued.add(pickupCode);

    const target = this.lockers.lockers.find(
      (locker) => locker.lockerId === chosen.lockerId,
    )!;
    // CAS in spirit: flip only the locker we picked.
    target.occupied = true;

    const allocation: PackageAllocation = {
      lockerId: target.lockerId,
      pickupCode,
      storedAt: new Date('2026-09-13T12:00:00.000Z'),
    };
    this.allocations.push({ ...allocation, request });
    return allocation;
  }

  async retrieve(
    _lockerId: string,
    _pickupCode: string,
  ): Promise<PackageRetrieval> {
    throw new Error('retrieve is not part of this suite');
  }
}

function makeUseCase(sizes: Locker['size'][], codes: number[] = []) {
  const lockers = new InMemoryLockerRepository();
  for (const size of sizes) {
    void lockers.create(size);
  }

  let cursor = 0;
  const random = (max: number) => {
    // Past the scripted values each draw advances, so generated codes differ
    // (a constant source would hand out the same code forever).
    const value = codes[cursor] ?? cursor + 1;
    cursor += 1;
    return value % max;
  };
  const packages = new InMemoryPackageRepository(lockers);
  return {
    lockers,
    packages,
    storePackage: new StorePackage(packages, random),
  };
}

describe('StorePackage use case', () => {
  it('stores into the smallest fitting locker and returns lockerId + pickupCode', async () => {
    const { lockers, storePackage } = makeUseCase(['MEDIUM', 'SMALL']);

    const result = await storePackage.execute({
      size: 'SMALL',
      customerRef: 'Meera R.',
    });

    const chosen = lockers.lockers.find((l) => l.lockerId === result.lockerId);
    expect(chosen).toMatchObject({ size: 'SMALL', occupied: true });
    expect(result.pickupCode).toMatch(
      new RegExp(`^[${PICKUP_CODE_ALPHABET}]{8}$`),
    );
    expect(Object.keys(result).sort()).toEqual(['lockerId', 'pickupCode']);
  });

  it('falls back to a larger locker when the exact size is exhausted', async () => {
    const { lockers, storePackage } = makeUseCase(['LARGE', 'SMALL']);

    await storePackage.execute({ size: 'SMALL' });
    const second = await storePackage.execute({ size: 'SMALL' });

    expect(
      lockers.lockers.find((l) => l.lockerId === second.lockerId)?.size,
    ).toBe('LARGE');
  });

  it('refuses with NO_SUITABLE_LOCKER when nothing fits', async () => {
    const { storePackage } = makeUseCase(['SMALL']);

    await expect(storePackage.execute({ size: 'LARGE' })).rejects.toMatchObject({
      name: 'NoSuitableLockerError',
      code: 'NO_SUITABLE_LOCKER',
      status: 409,
    });
  });

  it('regenerates the pickup code when a collision with an issued code occurs', async () => {
    // Scripted draws: 8× alphabet index 0 → 'AAAAAAAA', then 8× index 0 again
    // (a second 'AAAAAAAA' — the collision), then 8× index 7 → 'HHHHHHHH',
    // the regenerated code the second store actually returns.
    const scripted = [...Array(16).fill(0), ...Array(8).fill(7)];
    const { storePackage } = makeUseCase(['SMALL', 'SMALL'], scripted);

    const first = await storePackage.execute({ size: 'SMALL' });
    const second = await storePackage.execute({ size: 'SMALL' });

    expect(first.pickupCode).toBe('AAAAAAAA');
    expect(second.pickupCode).toBe('HHHHHHHH');
    expect(second.pickupCode).toMatch(
      new RegExp(`^[${PICKUP_CODE_ALPHABET}]{8}$`),
    );
  });

  it.each(['HUGE', 'small', '', undefined, null, 42])(
    'rejects size %p with VALIDATION_ERROR before touching storage',
    async (size) => {
      const { packages, storePackage } = makeUseCase(['SMALL']);

      await expect(
        storePackage.execute({ size: size as unknown }),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 });
      expect(packages.allocations).toHaveLength(0);
    },
  );

  it.each([42, null, ['Meera'], { name: 'Meera' }])(
    'rejects customerRef %p with VALIDATION_ERROR',
    async (customerRef) => {
      const { packages, storePackage } = makeUseCase(['SMALL']);

      await expect(
        storePackage.execute({ size: 'SMALL', customerRef }),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 });
      expect(packages.allocations).toHaveLength(0);
    },
  );

  it('accepts a missing customerRef and an empty one', async () => {
    const { storePackage } = makeUseCase(['SMALL', 'SMALL']);

    await expect(storePackage.execute({ size: 'SMALL' })).resolves.toMatchObject({
      pickupCode: expect.any(String) as unknown as string,
    });
    await expect(
      storePackage.execute({ size: 'SMALL', customerRef: '' }),
    ).resolves.toMatchObject({
      pickupCode: expect.any(String) as unknown as string,
    });
  });

  it('surfaces repository failures untouched (e.g. INTERNAL_ERROR after retries)', async () => {
    const lockers = new InMemoryLockerRepository();
    void lockers.create('SMALL');
    const packages = new InMemoryPackageRepository(
      lockers,
      Object.assign(new Error('exhausted retries'), {
        name: 'InternalStoreError',
        code: 'INTERNAL_ERROR',
        status: 500,
      }),
    );
    const storePackage = new StorePackage(packages, () => 0);

    await expect(storePackage.execute({ size: 'SMALL' })).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      status: 500,
    });
  });
});
