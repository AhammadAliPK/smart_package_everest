import {
  PICKUP_CODE_LENGTH,
  StoragePricingPolicy,
  type ChargeBreakdownRow,
} from '@locker/domain';

import { InvalidRetrievalRequestError } from '../errors.js';
import type { PackageRepository } from '../ports/package-repository.js';

/** What the HTTP layer hands the use case — unvalidated, as received. */
export interface RetrievePackageCommand {
  readonly lockerId?: unknown;
  readonly pickupCode?: unknown;
}

/** The frozen FR9/AD-5 reply of a successful retrieval. */
export interface RetrievePackageResult {
  readonly lockerId: string;
  readonly retrievedAt: Date;
  readonly storageCharge: number;
  readonly daysCharged: number;
  readonly breakdown: readonly ChargeBreakdownRow[];
}

/**
 * `POST /pickups` — retrieve a package with its locker id and pickup code
 * (FR7).
 *
 * Validates the request shape, delegates the state change to the retrieval
 * transaction (which either frees the locker and flips the package to
 * RETRIEVED atomically, or raises one of the three calm outcome errors
 * having written nothing), then prices the stay with the pure policy and
 * the injected base fee (FR9, AD-5).
 */
export class RetrievePackage {
  constructor(
    private readonly packages: PackageRepository,
    private readonly storageFeeBase: number,
  ) {}

  async execute(command: RetrievePackageCommand): Promise<RetrievePackageResult> {
    const { lockerId, pickupCode } = command;

    if (typeof lockerId !== 'string' || lockerId.trim() === '') {
      throw new InvalidRetrievalRequestError('lockerId must be a non-empty string');
    }
    if (
      typeof pickupCode !== 'string' ||
      pickupCode.length !== PICKUP_CODE_LENGTH
    ) {
      throw new InvalidRetrievalRequestError(
        `pickupCode must be a string of exactly ${PICKUP_CODE_LENGTH} characters`,
      );
    }

    const retrieval = await this.packages.retrieve(lockerId, pickupCode);
    const charge = StoragePricingPolicy.charge(
      retrieval.storedAt,
      retrieval.retrievedAt,
      this.storageFeeBase,
    );

    return {
      lockerId: retrieval.lockerId,
      retrievedAt: retrieval.retrievedAt,
      storageCharge: charge.storageCharge,
      daysCharged: charge.daysCharged,
      breakdown: charge.breakdown,
    };
  }
}
