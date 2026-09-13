/**
 * @locker/domain — pure domain model of the locker system.
 *
 * Hexagonal inward-most layer (AD-2): pure TypeScript, zero runtime
 * dependencies. `Locker` / `StoredPackage` entities, the smallest-fitting
 * allocation rule, `StoragePricingPolicy` and pickup-code generation arrive
 * with the stories that need them (1.4 / 2.x). Nothing here may import
 * `fastify`, `@prisma/*` or `@sinclair/typebox` — enforced by the
 * `no-restricted-imports` zone in the root `eslint.config.js`.
 */

/** Package identity marker; exists only so this workspace compiles and ships a real entry point. */
export const DOMAIN_PACKAGE_NAME = '@locker/domain' as const;

export {
  SIZE_RANK,
  pickSmallestFitting,
  type FreeLocker,
} from './allocation.js';
export {
  PICKUP_CODE_ALPHABET,
  PICKUP_CODE_LENGTH,
  generatePickupCode,
  type RandomSource,
} from './pickup-code.js';
export { LOCKER_SIZES, isLockerSize, type LockerSize } from './locker-size.js';
