/**
 * Pickup code contract (FR4, AD-6): 8 characters from an unambiguous
 * uppercase alphabet — `0/O` and `1/I` are excluded so a customer can never
 * misread a code. Generation is pure over an injectable byte source, so the
 * randomness lives in the adapter (crypto) while this rule stays testable.
 */

/** Uppercase alphanumeric minus `0`, `O`, `1`, `I`. */
export const PICKUP_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
Object.freeze(PICKUP_CODE_ALPHABET);

/** Codes are 8 characters long. */
export const PICKUP_CODE_LENGTH = 8;

/**
 * A uniform random integer in `[0, max)`. Injected so the domain needs no
 * crypto dependency; the application layer supplies `crypto.randomInt`.
 */
export type RandomSource = (max: number) => number;

/** Generate one pickup code by drawing `PICKUP_CODE_LENGTH` alphabet indices. */
export function generatePickupCode(random: RandomSource): string {
  let code = '';
  for (let index = 0; index < PICKUP_CODE_LENGTH; index += 1) {
    code += PICKUP_CODE_ALPHABET[random(PICKUP_CODE_ALPHABET.length)];
  }
  return code;
}
