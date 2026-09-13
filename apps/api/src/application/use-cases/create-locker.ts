import { isLockerSize, type LockerSize } from '@locker/domain';

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
 * unit-testable with no HTTP stack involved. No storing/allocation logic
 * lives here — that arrives with Stories 1.4 / 1.5.
 */
export class CreateLocker {
  constructor(private readonly lockers: LockerRepository) {}

  async execute(size: unknown): Promise<CreateLockerResult> {
    if (!isLockerSize(size)) {
      throw new InvalidLockerSizeError(size);
    }

    const locker = await this.lockers.create(size);

    return {
      lockerId: locker.lockerId,
      size: locker.size,
      occupied: locker.occupied,
    };
  }
}
