import type { LockerSize } from '@locker/domain';

/** What the agent declares when storing a package (FR3). */
export interface PackageAllocationRequest {
  readonly size: LockerSize;
  readonly customerRef?: string;
}

/** The facts a successful allocation persisted. */
export interface PackageAllocation {
  /** The cuid of the locker that now holds the package (AD-9). */
  readonly lockerId: string;
  /** The code the customer will use for retrieval (AD-6). */
  readonly pickupCode: string;
  /** Exact storage instant, consumed later by pricing (AD-5). */
  readonly storedAt: Date;
}

/** The facts a successful retrieval persisted. */
export interface PackageRetrieval {
  /** The locker the package came out of (AD-9). */
  readonly lockerId: string;
  /** Exact storage instant, returned so the use case can price the stay (AD-5). */
  readonly storedAt: Date;
  /** The instant the retrieval transaction committed. */
  readonly retrievedAt: Date;
}

/**
 * Persistence port for packages.
 *
 * The allocation itself is one database transaction inside the adapter
 * (AD-3): `nextPickupCode` is a zero-arg factory the adapter may call more
 * than once — once per bounded attempt — so a code collision with an existing
 * `STORED` package regenerates instead of pre-checking (AD-6).
 *
 * `retrieve` is likewise one transaction (AD-4, AD-6): it resolves the
 * package via a single join of locker + code + STORED status, CAS-frees the
 * locker and flips the package to RETRIEVED — or raises
 * `LockerNotFoundError` / `InvalidPickupCodeError` / `LockerEmptyError`
 * having written nothing.
 */
export interface PackageRepository {
  allocate(
    request: PackageAllocationRequest,
    nextPickupCode: () => string,
  ): Promise<PackageAllocation>;
  retrieve(lockerId: string, pickupCode: string): Promise<PackageRetrieval>;
}
