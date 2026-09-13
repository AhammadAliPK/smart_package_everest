import { describe, expect, it } from 'vitest';

import {
  PICKUP_CODE_ALPHABET,
  PICKUP_CODE_LENGTH,
  generatePickupCode,
} from '../src/pickup-code.js';

/** Deterministic stand-in for the crypto byte source the adapter injects. */
function sequenceRandom(values: number[]): (max: number) => number {
  let cursor = 0;
  return (max: number) => {
    const value = values[cursor] ?? 0;
    cursor += 1;
    return value % max;
  };
}

describe('PICKUP_CODE_ALPHABET', () => {
  it('is uppercase alphanumeric without 0, O, 1 or I', () => {
    expect(PICKUP_CODE_ALPHABET).not.toMatch(/[0O1I]/);
    expect(PICKUP_CODE_ALPHABET).toMatch(/^[A-HJ-NP-Z2-9]+$/);
  });
});

describe('generatePickupCode', () => {
  it('is exactly 8 characters', () => {
    const code = generatePickupCode(() => 0);

    expect(code).toHaveLength(PICKUP_CODE_LENGTH);
    expect(code).toBe('AAAAAAAA');
  });

  it('draws only from the restricted alphabet', () => {
    for (let seed = 0; seed < 25; seed += 1) {
      const code = generatePickupCode((max) => (seed * 7 + max) % max);
      expect(code).toMatch(new RegExp(`^[${PICKUP_CODE_ALPHABET}]{8}$`));
    }
  });

  it('follows the injected random source index by index', () => {
    const alphabet = PICKUP_CODE_ALPHABET;
    const code = generatePickupCode(sequenceRandom([5, 30, 0, 30]));

    expect(code[0]).toBe(alphabet[5]);
    expect(code[1]).toBe(alphabet[30 % alphabet.length]);
    expect(code[2]).toBe(alphabet[0]);
  });

  it('produces distinct codes for distinct random streams', () => {
    const first = generatePickupCode(() => 3);
    const second = generatePickupCode(() => 4);

    expect(first).not.toBe(second);
  });
});
