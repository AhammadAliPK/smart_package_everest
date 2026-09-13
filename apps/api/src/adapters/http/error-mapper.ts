import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { AppError } from '../../application/errors.js';

/** The AD-7 response body: `{"error":{"code","message"}}` — every non-2xx. */
export interface ErrorEnvelope {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}

/** Fastify attaches the failed Ajv validation to its schema errors. */
function isValidationError(error: unknown): error is FastifyError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'validation' in error &&
    Array.isArray((error as FastifyError).validation)
  );
}

/**
 * Map any thrown error onto its AD-7 code, status and human message.
 *
 * One mapping for the whole API, so the code set stays stable (AD-7):
 *   - application `AppError`s carry their own code + status;
 *   - request-body/query validation (Fastify's Ajv) is `VALIDATION_ERROR` 400;
 *   - everything else is `INTERNAL_ERROR` 500 with a message that leaks
 *     nothing (the detail is logged instead).
 *
 * Unknown routes are deliberately left to Fastify's default 404 handler: the
 * frozen code set has no code for "no such route", and inventing one would
 * widen the contract this story is supposed to keep narrow.
 */
export function toErrorEnvelope(
  error: unknown,
  log: FastifyRequest['log'] | undefined,
): { status: number; body: ErrorEnvelope } {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: { error: { code: error.code, message: error.message } },
    };
  }

  if (isValidationError(error)) {
    return {
      status: 400,
      body: {
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
        },
      },
    };
  }

  log?.error({ err: error }, 'unhandled error');
  return {
    status: 500,
    body: {
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    },
  };
}

/** Register the AD-7 error handler on the app (called once, in `buildApp`). */
export function registerErrorMapper(app: FastifyInstance): void {
  app.setErrorHandler(
    (error: unknown, request: FastifyRequest, reply: FastifyReply) => {
      const { status, body } = toErrorEnvelope(error, request.log);
      void reply.status(status).send(body);
    },
  );
}
