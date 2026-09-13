/**
 * Locker id contract (AD-9 v1.1): the identifier a human types is 6
 * characters from the same unambiguous alphabet as pickup codes — `0/O` and
 * `1/I` are excluded so a customer can never misread a locker id one-handed.
 * The cuid stays the internal surrogate key; this generated id is what
 * `lockerId` means in every payload. Generation is pure over the same
 * injectable byte source as pickup codes (AD-6 idiom), so the randomness
 * lives in the adapter while this rule stays testable.
 */

import { PICKUP_CODE_ALPHABET, type RandomSource } from './pickup-code.js';

/** Public locker ids are 6 characters long (31⁶ ≈ 887M — no counter needed). */
export const LOCKER_ID_LENGTH = 6;

/** Generate one public locker id by drawing `LOCKER_ID_LENGTH` alphabet indices. */
export function generateLockerId(random: RandomSource): string {
  let id = '';
  for (let index = 0; index < LOCKER_ID_LENGTH; index += 1) {
    id += PICKUP_CODE_ALPHABET[random(PICKUP_CODE_ALPHABET.length)];
  }
  return id;
}
