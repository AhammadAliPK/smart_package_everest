import { describe, expect, it } from 'vitest';

import { InvalidLockerSizeError } from '../src/application/errors.js';
import type { Locker, LockerRepository } from '../src/application/ports/locker-repository.js';
import { CreateLocker } from '../src/application/use-cases/create-locker.js';

/**
 * In-memory implementation of the persistence port — the use case is proven
 * against the interface it depends on, with no Prisma and no database.
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

function makeUseCase() {
  const repository = new InMemoryLockerRepository();
  return { repository, createLocker: new CreateLocker(repository) };
}

describe('CreateLocker use case', () => {
  it('creates an unoccupied locker of the chosen size', async () => {
    const { repository, createLocker } = makeUseCase();

    const result = await createLocker.execute('MEDIUM');

    expect(result).toEqual({
      lockerId: expect.any(String) as unknown as string,
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
