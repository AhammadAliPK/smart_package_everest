import type { FastifyInstance } from 'fastify';

/**
 * `GET /health` — liveness probe.
 *
 * Frozen contract for this story: `200 {"status":"ok"}`. Declared as an HTTP
 * response schema (contract-first, AD-1) so Fastify validates/serializes the
 * payload and future OpenAPI generation picks it up.
 */
export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/health',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['status'],
            properties: {
              status: { type: 'string', enum: ['ok'] },
            },
          },
        },
      },
    },
    async () => ({ status: 'ok' }),
  );
}
