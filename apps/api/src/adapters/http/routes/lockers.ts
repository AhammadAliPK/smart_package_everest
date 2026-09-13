import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { CreateLocker } from '../../../application/use-cases/create-locker.js';
import type { LockerRepository } from '../../../application/ports/locker-repository.js';
import {
  createLockerReplySchema,
  createLockerRequestSchema,
} from '../schemas/locker-schema.js';

/** Dependencies the routes need — injected by `buildApp`. */
export interface LockerRoutesOptions {
  readonly lockerRepository: LockerRepository;
}

/**
 * Locker endpoints (FR1).
 *
 * The handler only parses, validates (via the declared schemas) and
 * delegates — every state change belongs to the use case, persistence to the
 * repository behind it (AD-3). An invalid size never reaches the use case:
 * Fastify's Ajv rejects the body first and the error mapper answers with the
 * AD-7 envelope.
 */
export const lockerRoutes: FastifyPluginAsyncTypebox<LockerRoutesOptions> =
  async (app, { lockerRepository }) => {
    const createLocker = new CreateLocker(lockerRepository);

    app.post(
      '/lockers',
      {
        schema: {
          body: createLockerRequestSchema,
          response: { 201: createLockerReplySchema },
        },
      },
      async (request, reply) => {
        const locker = await createLocker.execute(request.body.size);

        return reply.code(201).send(locker);
      },
    );
  };
