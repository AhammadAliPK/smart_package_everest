import { describe, expect, it } from 'vitest';

import {
  PICKUP_CODE_ALPHABET,
  type RandomSource,
} from '../src/pickup-code.js';
import {
  LOCKER_ID_LENGTH,
  generateLockerId,
} from '../src/locker-id.js';

/** Deterministic stand-in for the crypto byte source the adapter injects. */
function sequenceRandom(values: number[]): RandomSource {
  let cursor = 0;
  return (max: number) => {
    const value = values[cursor] ?? 0;
    cursor += 1;
    return value % max;
  };
}

describe('generateLockerId', () => {
  it('is exactly 6 characters', () => {
    const id = generateLockerId(() => 0);

    expect(id).toHaveLength(LOCKER_ID_LENGTH);
    expect(id).toBe('AAAAAA');
  });

  it('draws only from the restricted alphabet', () => {
    for (let seed = 0; seed < 25; seed += 1) {
      const id = generateLockerId((max) => (seed * 7 + max) % max);
      expect(id).toMatch(new RegExp(`^[${PICKUP_CODE_ALPHABET}]{6}$`));
    }
  });

  it('follows the injected random source index by index', () => {
    const alphabet = PICKUP_CODE_ALPHABET;
    const id = generateLockerId(sequenceRandom([5, 30, 0, 30, 2, 9]));

    expect(id).toBe(
      alphabet[5]! +
        alphabet[30 % alphabet.length]! +
        alphabet[0]! +
        alphabet[30 % alphabet.length]! +
        alphabet[2]! +
        alphabet[9]!,
    );
  });

  it('produces distinct ids for distinct random streams', () => {
    const first = generateLockerId(() => 3);
    const second = generateLockerId(() => 4);

    expect(first).not.toBe(second);
  });
});
