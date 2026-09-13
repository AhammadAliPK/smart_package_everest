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
