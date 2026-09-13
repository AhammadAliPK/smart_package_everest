import { LOCKER_SIZES, type LockerSize } from '@locker/domain';

/**
 * Application-level error carrying its AD-7 code and HTTP status.
 *
 * Use cases never know about HTTP shapes — they raise these, and the HTTP
 * adapter's error mapper turns any `AppError` into
 * `{"error":{"code","message"}}`. Every non-2xx in the API flows through that
 * one mapping, so codes stay stable (AD-7).
 */
export class AppError extends Error {
  /** Stable upper-snake code from the AD-7 contract. */
  readonly code: string;
  /** HTTP status the adapter should answer with. */
  readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
  }
}

/** A declared size is not one of the enum values (FR1, 400). */
export class InvalidLockerSizeError extends AppError {
  constructor(received: unknown) {
    super(
      'VALIDATION_ERROR',
      400,
      `size must be one of ${LOCKER_SIZES.join(', ')}${
        typeof received === 'string' ? `, got "${received}"` : ''
      }`,
    );
  }
}

/** `customerRef` was supplied but is not a string (FR3, 400). */
export class InvalidCustomerRefError extends AppError {
  constructor() {
    super('VALIDATION_ERROR', 400, 'customerRef must be a string when present');
  }
}

/** Every locker that fits the package is occupied (FR6, AD-7: 409, no side effects). */
export class NoSuitableLockerError extends AppError {
  constructor(size: LockerSize) {
    super(
      'NO_SUITABLE_LOCKER',
      409,
      `No locker is available for a ${size} package right now`,
    );
  }
}

/** The retrieval request failed shape validation (FR8, AD-7: 400). */
export class InvalidRetrievalRequestError extends AppError {
  constructor(reason: string) {
    super('VALIDATION_ERROR', 400, reason);
  }
}

/** The locker id names no locker in the station (FR8, AD-7: 404). */
export class LockerNotFoundError extends AppError {
  constructor(lockerId: string) {
    super('LOCKER_NOT_FOUND', 404, `There is no locker “${lockerId}” at this station`);
  }
}

/** The code does not match the package in that locker (FR8, AD-7: 404, zero writes). */
export class InvalidPickupCodeError extends AppError {
  constructor(lockerId: string) {
    super(
      'INVALID_PICKUP_CODE',
      404,
      `That code does not match the package in locker “${lockerId}”`,
    );
  }
}

/** The locker holds nothing — never stored or already retrieved (FR8, AD-7: 409). */
export class LockerEmptyError extends AppError {
  constructor(lockerId: string) {
    super('LOCKER_EMPTY', 409, `Locker “${lockerId}” is empty`);
  }
}
