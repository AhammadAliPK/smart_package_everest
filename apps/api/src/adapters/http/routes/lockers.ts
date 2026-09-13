import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { CreateLocker } from '../../../application/use-cases/create-locker.js';
import { ListLockers } from '../../../application/use-cases/list-lockers.js';
import type { LockerRepository } from '../../../application/ports/locker-repository.js';
import {
  createLockerReplySchema,
  createLockerRequestSchema,
  listLockersReplySchema,
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
    const listLockers = new ListLockers(lockerRepository);

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

    app.get(
      '/lockers',
      {
        schema: {
          response: { 200: listLockersReplySchema },
        },
      },
      async (_request, reply) => {
        const lockers = await listLockers.execute();

        // AD-1: list items carry the cuid as `id` — the one place the field is
        // not named `lockerId` — and serialize to exactly three fields.
        return reply.code(200).send({
          lockers: lockers.map((locker) => ({
            id: locker.lockerId,
            size: locker.size,
            occupied: locker.occupied,
          })),
        });
      },
    );
  };
