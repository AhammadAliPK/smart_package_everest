import Fastify, { type FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

import type { LockerRepository } from '../../application/ports/locker-repository.js';
import type { Env } from '../../config/env.js';
import type { PrismaClient } from '../db/generated/prisma/client.js';
import { createPrismaClient } from '../db/prisma.js';
import { PrismaLockerRepository } from '../db/locker-repository.js';
import { registerErrorMapper } from './error-mapper.js';
import { registerOpenApi } from './plugins/openapi.js';
import { healthRoutes } from './routes/health.js';
import { lockerRoutes } from './routes/lockers.js';

/** Options for {@link buildApp}. */
export interface BuildAppOptions {
  /**
   * Fastify's built-in JSON request logger (spine convention). Tests disable it
   * to keep `inject()` output clean; defaults to enabled for real boots.
   */
  readonly logger?: boolean;
  /**
   * Composition-root overrides. Tests inject an in-memory repository (and no
   * Prisma client at all); production leaves both unset so the app builds the
   * Prisma adapter from the validated `DATABASE_URL`.
   */
  readonly lockerRepository?: LockerRepository;
  readonly prisma?: PrismaClient;
}

/**
 * Fastify application factory (hexagonal HTTP adapter).
 *
 * Builds and wires the app but never binds a socket — `src/index.ts` is the
 * only caller of `listen()`. This is what lets the Vitest suites exercise the
 * full route stack through `app.inject()` with no ports and no races.
 */
export async function buildApp(
  env: Env,
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? true,
  }).withTypeProvider<TypeBoxTypeProvider>();

  const prisma = options.prisma ?? createPrismaClient(env.databaseUrl);
  const lockerRepository =
    options.lockerRepository ?? new PrismaLockerRepository(prisma);

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });

  app.log.debug({ storageFeeBase: env.storageFeeBase }, 'building http app');

  // Cross-cutting first, so every route is covered: AD-7 error envelope and
  // OpenAPI collection (swagger must be registered before the routes it documents).
  registerErrorMapper(app);
  await registerOpenApi(app);

  await app.register(healthRoutes);
  await app.register(lockerRoutes, { lockerRepository });

  return app;
}
