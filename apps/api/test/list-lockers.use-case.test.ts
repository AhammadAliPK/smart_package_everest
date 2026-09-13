import { describe, expect, it } from 'vitest';

import type { Locker, LockerRepository } from '../src/application/ports/locker-repository.js';
import { ListLockers } from '../src/application/use-cases/list-lockers.js';

/**
 * In-memory port double, seeded out of id order — proves the use case itself
 * normalises the frozen AD-1 ordering no matter what the adapter returns.
 */
class InMemoryLockerRepository implements LockerRepository {
  constructor(private readonly seed: Locker[]) {}

  async create(size: Locker['size']): Promise<Locker> {
    const locker: Locker = { lockerId: 'cnew', size, occupied: false };
    this.seed.push(locker);
    return locker;
  }

  async list(): Promise<Locker[]> {
    return this.seed;
  }
}

function locker(id: string, size: Locker['size'], occupied = false): Locker {
  return { lockerId: id, size, occupied };
}

describe('ListLockers use case', () => {
  it('returns every locker ordered by id, occupied included', async () => {
    const repository = new InMemoryLockerRepository([
      locker('czzz', 'LARGE'),
      locker('c111', 'SMALL', true),
      locker('caaa', 'MEDIUM'),
    ]);

    const result = await new ListLockers(repository).execute();

    expect(result.map((locker) => locker.lockerId)).toEqual([
      'c111',
      'caaa',
      'czzz',
    ]);
    expect(result[0]).toEqual({ lockerId: 'c111', size: 'SMALL', occupied: true });
  });

  it('returns an empty list for an empty station (never an error)', async () => {
    const repository = new InMemoryLockerRepository([]);

    const result = await new ListLockers(repository).execute();

    expect(result).toEqual([]);
  });

  it('does not mutate the repository list it was handed', async () => {
    const seed = [locker('czzz', 'LARGE'), locker('caaa', 'SMALL')];
    const repository = new InMemoryLockerRepository(seed);

    await new ListLockers(repository).execute();

    expect(seed.map((locker) => locker.lockerId)).toEqual(['czzz', 'caaa']);
  });
});
