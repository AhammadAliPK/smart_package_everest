import { randomInt } from 'node:crypto';

import type { RandomSource } from '@locker/domain';

/**
 * The crypto-backed `RandomSource` the domain's pickup-code generator draws
 * from (AD-6). Injected rather than imported by the domain so the rule stays
 * pure; tests pass a deterministic source instead.
 */
export const cryptoRandomInt: RandomSource = (max) => randomInt(0, max);
