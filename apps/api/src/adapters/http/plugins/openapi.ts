import type { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

/**
 * OpenAPI (AD-1): every route's TypeBox schemas are collected into one
 * OpenAPI document, and `@fastify/swagger-ui` serves it interactively at
 * `/docs`. The raw document stays available at `/docs/json` — Story 4's web
 * client is generated from it (AD-10), never hand-copied.
 */
export async function registerOpenApi(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Smart Package Locker API',
        description:
          'Locker station REST API — lockers, storage and pickup (AD-1..AD-9).',
        version: '0.1.0',
      },
      tags: [{ name: 'lockers', description: 'Locker station inventory' }],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });
}
