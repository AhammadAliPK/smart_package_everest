import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import type { PackageRepository } from '../../../application/ports/package-repository.js';
import { RetrievePackage } from '../../../application/use-cases/retrieve-package.js';
import {
  createPickupRequestSchema,
  pickupReplySchema,
} from '../schemas/pickup-schema.js';

/** Dependencies the routes need — injected by `buildApp`. */
export interface PickupRoutesOptions {
  readonly packageRepository: PackageRepository;
  /** `STORAGE_FEE_BASE` from the validated env (AD-5, default 10). */
  readonly storageFeeBase: number;
}

/**
 * Pickup endpoint (FR7–FR9).
 *
 * Parse/validate/delegate only: the locker id and 8-character code are
 * schema-validated (400 via the AD-7 error mapper) and the retrieval
 * transaction — resolve, CAS-free, RETRIEVED — lives entirely in the use
 * case/repository pair, which answers the three calm outcome errors through
 * the same mapper. The reply serialises `retrievedAt` to ISO-8601 UTC.
 */
export const pickupRoutes: FastifyPluginAsyncTypebox<PickupRoutesOptions> =
  async (app, { packageRepository, storageFeeBase }) => {
    const retrievePackage = new RetrievePackage(packageRepository, storageFeeBase);

    app.post(
      '/pickups',
      {
        schema: {
          body: createPickupRequestSchema,
          response: { 200: pickupReplySchema },
        },
      },
      async (request, reply) => {
        const retrieved = await retrievePackage.execute(request.body);

        return reply.code(200).send({
          lockerId: retrieved.lockerId,
          retrievedAt: retrieved.retrievedAt.toISOString(),
          storageCharge: retrieved.storageCharge,
          daysCharged: retrieved.daysCharged,
          breakdown: [...retrieved.breakdown],
        });
      },
    );
  };
