import Fastify, { type FastifyInstance } from 'fastify';

import type { Env } from '../../config/env.js';
import { healthRoutes } from './routes/health.js';

/** Options for {@link buildApp}. */
export interface BuildAppOptions {
  /**
   * Fastify's built-in JSON request logger (spine convention). Tests disable it
   * to keep `inject()` output clean; defaults to enabled for real boots.
   */
  readonly logger?: boolean;
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
  });

  app.log.debug({ storageFeeBase: env.storageFeeBase }, 'building http app');

  await app.register(healthRoutes);

  return app;
}
