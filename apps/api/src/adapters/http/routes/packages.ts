import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import type { PackageRepository } from '../../../application/ports/package-repository.js';
import { StorePackage } from '../../../application/use-cases/store-package.js';
import {
  createPackageReplySchema,
  createPackageRequestSchema,
} from '../schemas/package-schema.js';

/** Dependencies the routes need — injected by `buildApp`. */
export interface PackageRoutesOptions {
  readonly packageRepository: PackageRepository;
}

/**
 * Package endpoints (FR3).
 *
 * Parse/validate/delegate only: the declared size and optional customer
 * reference are schema-validated (400 via the AD-7 error mapper), and the
 * store transaction — allocation, occupancy, package row — lives entirely in
 * the use case/repository pair (AD-3, AD-4). `NO_SUITABLE_LOCKER` (409) and
 * `INTERNAL_ERROR` reach the client through the same error mapper (AD-7).
 */
export const packageRoutes: FastifyPluginAsyncTypebox<PackageRoutesOptions> =
  async (app, { packageRepository }) => {
    const storePackage = new StorePackage(packageRepository);

    app.post(
      '/packages',
      {
        schema: {
          body: createPackageRequestSchema,
          response: { 201: createPackageReplySchema },
        },
      },
      async (request, reply) => {
        const stored = await storePackage.execute(request.body);

        return reply.code(201).send({
          lockerId: stored.lockerId,
          pickupCode: stored.pickupCode,
        });
      },
    );
  };
