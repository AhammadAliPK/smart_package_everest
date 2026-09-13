import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Locker, LockerRepository } from '../src/application/ports/locker-repository.js';
import type { LockerSize } from '@locker/domain';
import { buildApp } from '../src/adapters/http/app.js';
import type { Env } from '../src/config/env.js';

/** Docs are static metadata: an in-memory port keeps this suite DB-free. */
class UnusedLockerRepository implements LockerRepository {
  async create(size: LockerSize): Promise<Locker> {
    return { lockerId: 'unused', size, occupied: false };
  }

  async list(): Promise<Locker[]> {
    return [];
  }
}

describe('GET /docs (OpenAPI, AD-1)', () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  beforeAll(async () => {
    app = await buildApp(
      { databaseUrl: 'postgres://unused:unused@localhost:5432/unused', port: 0, storageFeeBase: 10 } satisfies Env,
      { logger: false, lockerRepository: new UnusedLockerRepository() },
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  it('serves the interactive swagger-ui page', async () => {
    const response = await app!.inject({ method: 'GET', url: '/docs' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).toContain('swagger-ui');
  });

  it('exposes POST /lockers with its request and response schemas', async () => {
    const response = await app!.inject({ method: 'GET', url: '/docs/json' });

    expect(response.statusCode).toBe(200);
    const document = response.json() as {
      paths: Record<string, Record<string, { responses: Record<string, unknown> }>>;
      components?: { schemas?: Record<string, unknown> };
    };

    const post = document.paths['/lockers']?.post;
    expect(post).toBeDefined();
    expect(Object.keys(post?.responses ?? {})).toContain('201');

    const schemas = document.components?.schemas ?? {};
    const schemaText = JSON.stringify({ post, schemas });

    // The declared size enum and the AD-9 reply fields must both be visible.
    expect(schemaText).toContain('SMALL');
    expect(schemaText).toContain('MEDIUM');
    expect(schemaText).toContain('LARGE');
    expect(schemaText).toContain('lockerId');
    expect(schemaText).toContain('occupied');
  });
});
