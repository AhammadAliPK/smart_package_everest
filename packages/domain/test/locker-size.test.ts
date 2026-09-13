import { describe, expect, it } from 'vitest';

import { LOCKER_SIZES, isLockerSize } from '../src/locker-size.js';

describe('LOCKER_SIZES', () => {
  it('is exactly SMALL, MEDIUM, LARGE in rank order', () => {
    expect(LOCKER_SIZES).toEqual(['SMALL', 'MEDIUM', 'LARGE']);
  });

  it('is frozen — the size vocabulary cannot be extended at runtime', () => {
    expect(Object.isFrozen(LOCKER_SIZES)).toBe(true);
  });
});

describe('isLockerSize', () => {
  it.each(['SMALL', 'MEDIUM', 'LARGE'] as const)(
    'accepts the declared size %s',
    (size) => {
      expect(isLockerSize(size)).toBe(true);
    },
  );

  it('rejects an unknown value', () => {
    expect(isLockerSize('HUGE')).toBe(false);
  });

  it('rejects the wrong case — sizes are uppercase only', () => {
    expect(isLockerSize('small')).toBe(false);
    expect(isLockerSize('Small')).toBe(false);
    expect(isLockerSize('MEDIUM ')).toBe(false);
  });

  it('rejects missing and non-string input', () => {
    expect(isLockerSize(undefined)).toBe(false);
    expect(isLockerSize(null)).toBe(false);
    expect(isLockerSize('')).toBe(false);
    expect(isLockerSize(42)).toBe(false);
    expect(isLockerSize({ size: 'SMALL' })).toBe(false);
  });
});
