import {
  generatePickupCode,
  isLockerSize,
  type LockerSize,
} from '@locker/domain';

import { cryptoRandomInt } from '../crypto-random.js';
import {
  InvalidCustomerRefError,
  InvalidLockerSizeError,
} from '../errors.js';
import type { PackageRepository } from '../ports/package-repository.js';

/** What the HTTP layer hands the use case — unvalidated, as received. */
export interface StorePackageCommand {
  readonly size: unknown;
  readonly customerRef?: unknown;
}

/** The frozen AD-1/AD-9 reply fields of a successful store (FR3). */
export interface StorePackageResult {
  readonly lockerId: string;
  readonly pickupCode: string;
}

/**
 * `POST /packages` — store a package in the smallest locker that fits (FR3).
 *
 * Validates the declaration, generates the pickup code (AD-6) and hands the
 * rest to the repository, whose single transaction owns allocation, occupancy
 * and the package row (AD-3, AD-4). When nothing fits the repository raises
 * `NoSuitableLockerError` — the graceful refusal of Story 1.5 — after having
 * written nothing.
 */
export class StorePackage {
  constructor(
    private readonly packages: PackageRepository,
    private readonly random: (max: number) => number = cryptoRandomInt,
  ) {}

  async execute(command: StorePackageCommand): Promise<StorePackageResult> {
    const { size, customerRef } = command;

    if (!isLockerSize(size)) {
      throw new InvalidLockerSizeError(size);
    }
    if (customerRef !== undefined && typeof customerRef !== 'string') {
      throw new InvalidCustomerRefError();
    }

    const allocation = await this.packages.allocate(
      { size: size as LockerSize, customerRef },
      () => generatePickupCode(this.random),
    );

    return { lockerId: allocation.lockerId, pickupCode: allocation.pickupCode };
  }
}
