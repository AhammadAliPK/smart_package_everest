import { describe, expect, it } from 'vitest';

import {
  SIZE_RANK,
  pickSmallestFitting,
  type FreeLocker,
} from '../src/allocation.js';

function locker(id: string, size: FreeLocker['size']): FreeLocker {
  return { lockerId: id, size };
}

describe('SIZE_RANK', () => {
  it('ranks SMALL < MEDIUM < LARGE as 1 < 2 < 3', () => {
    expect(SIZE_RANK).toEqual({ SMALL: 1, MEDIUM: 2, LARGE: 3 });
  });
});

describe('pickSmallestFitting', () => {
  it('picks the smallest locker that fits', () => {
    const free = [locker('a', 'MEDIUM'), locker('b', 'SMALL')];

    expect(pickSmallestFitting(free, 'SMALL')?.lockerId).toBe('b');
  });

  it('prefers the exact size over a larger one', () => {
    const free = [locker('a', 'MEDIUM'), locker('b', 'SMALL'), locker('c', 'LARGE')];

    expect(pickSmallestFitting(free, 'MEDIUM')?.lockerId).toBe('a');
    expect(pickSmallestFitting(free, 'LARGE')?.lockerId).toBe('c');
  });

  it('breaks rank ties by lowest locker id', () => {
    const free = [locker('czzz', 'SMALL'), locker('c111', 'SMALL'), locker('caaa', 'SMALL')];

    expect(pickSmallestFitting(free, 'SMALL')?.lockerId).toBe('c111');
  });

  it('stores a smaller package in a larger locker when nothing smaller is free', () => {
    const free = [locker('a', 'LARGE')];

    expect(pickSmallestFitting(free, 'SMALL')?.lockerId).toBe('a');
  });

  it('per-size exhaustion: skips too-small lockers and settles for the next size up', () => {
    const free = [locker('a', 'MEDIUM'), locker('b', 'LARGE')];

    expect(pickSmallestFitting(free, 'SMALL')?.lockerId).toBe('a');
  });

  it('returns null when nothing fits', () => {
    const free = [locker('a', 'SMALL'), locker('b', 'MEDIUM')];

    expect(pickSmallestFitting(free, 'LARGE')).toBeNull();
  });

  it('returns null for an empty station', () => {
    expect(pickSmallestFitting([], 'SMALL')).toBeNull();
  });

  it('never picks an oversized-only set for a large package', () => {
    const free = [locker('a', 'SMALL')];

    expect(pickSmallestFitting(free, 'LARGE')).toBeNull();
  });
});
