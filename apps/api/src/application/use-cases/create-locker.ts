import {
  generateLockerId,
  isLockerSize,
  type LockerSize,
  type RandomSource,
} from '@locker/domain';

import { cryptoRandomInt } from '../crypto-random.js';
import { InvalidLockerSizeError } from '../errors.js';
import type { LockerRepository } from '../ports/locker-repository.js';

/** What a successful creation answers with (AD-9 field name included). */
export interface CreateLockerResult {
  readonly lockerId: string;
  readonly size: LockerSize;
  readonly occupied: boolean;
}

/**
 * `POST /lockers` — create an unoccupied locker of the chosen size (FR1).
 *
 * The size is re-validated here as a domain rule even though the HTTP adapter
 * validates it first: the use case is the last line of defence and is
 * unit-testable with no HTTP stack involved. The public locker code (AD-9
 * v1.1) is drawn from the injected source — the `StorePackage` idiom — and
 * handed to the repository per attempt so it can retry a collision. No
 * storing/allocation logic lives here.
 */
export class CreateLocker {
  constructor(
    private readonly lockers: LockerRepository,
    private readonly random: RandomSource = cryptoRandomInt,
  ) {}

  async execute(size: unknown): Promise<CreateLockerResult> {
    if (!isLockerSize(size)) {
      throw new InvalidLockerSizeError(size);
    }

    const locker = await this.lockers.create(
      size,
      () => generateLockerId(this.random),
    );

    return {
      lockerId: locker.lockerId,
      size: locker.size,
      occupied: locker.occupied,
    };
  }
}
