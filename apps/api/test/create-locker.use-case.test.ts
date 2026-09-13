import { describe, expect, it } from 'vitest';

import {
  LOCKER_ID_LENGTH,
  PICKUP_CODE_ALPHABET,
} from '@locker/domain';

import { InvalidLockerSizeError } from '../src/application/errors.js';
import type { Locker, LockerRepository } from '../src/application/ports/locker-repository.js';
import { CreateLocker } from '../src/application/use-cases/create-locker.js';

/** The AD-9 v1.1 identifier: 6 chars over the unambiguous alphabet. */
const LOCKER_ID_PATTERN = new RegExp(
  `^[${PICKUP_CODE_ALPHABET}]{${LOCKER_ID_LENGTH}}$`,
);

/**
 * In-memory implementation of the persistence port — the use case is proven
 * against the interface it depends on, with no Prisma and no database.
 */
class InMemoryLockerRepository implements LockerRepository {
  readonly lockers: Locker[] = [];

  async create(
    size: Locker['size'],
    nextLockerId: () => string,
  ): Promise<Locker> {
    const locker: Locker = {
      lockerId: nextLockerId(),
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

function makeUseCase() {
  const repository = new InMemoryLockerRepository();
  // Deterministic index stream: each create draws six ascending alphabet
  // indices, so ids are shaped and distinct without real randomness.
  let draw = 0;
  const createLocker = new CreateLocker(repository, (max) => {
    const value = draw;
    draw += 1;
    return value % max;
  });
  return { repository, createLocker };
}

describe('CreateLocker use case', () => {
  it('creates an unoccupied locker of the chosen size with a public id', async () => {
    const { repository, createLocker } = makeUseCase();

    const result = await createLocker.execute('MEDIUM');

    expect(result).toEqual({
      lockerId: 'ABCDEF',
      size: 'MEDIUM',
      occupied: false,
    });
    expect(repository.lockers).toHaveLength(1);
    expect(repository.lockers[0]).toMatchObject({
      size: 'MEDIUM',
      occupied: false,
    });
    expect(result.lockerId).toBe(repository.lockers[0]?.lockerId);
  });

  it('draws the id from the injected random source', async () => {
    const { createLocker } = makeUseCase();

    const result = await createLocker.execute('SMALL');

    expect(result.lockerId).toMatch(LOCKER_ID_PATTERN);
  });

  it('creates a distinct locker per call', async () => {
    const { repository, createLocker } = makeUseCase();

    const first = await createLocker.execute('SMALL');
    const second = await createLocker.execute('LARGE');

    expect(first.lockerId).not.toBe(second.lockerId);
    expect(repository.lockers.map((locker) => locker.size)).toEqual([
      'SMALL',
      'LARGE',
    ]);
  });

  it.each(['HUGE', 'small', 'MEDIUM ', '', undefined, null, 42, ['MEDIUM']])(
    'rejects size %p with VALIDATION_ERROR and creates nothing',
    async (size) => {
      const { repository, createLocker } = makeUseCase();

      await expect(createLocker.execute(size)).rejects.toMatchObject({
        name: 'InvalidLockerSizeError',
        code: 'VALIDATION_ERROR',
        status: 400,
      });
      expect(repository.lockers).toHaveLength(0);
    },
  );

  it('names the allowed sizes in the error message', async () => {
    const { createLocker } = makeUseCase();

    await expect(createLocker.execute('HUGE')).rejects.toThrow(
      /SMALL, MEDIUM, LARGE/,
    );
  });
});
