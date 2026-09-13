import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../src/adapters/http/app.js';
import type { Env } from '../src/config/env.js';

/** Env is passed straight in: the health suite never touches process.env. */
const env: Env = {
  databaseUrl: 'postgres://unused:unused@localhost:5432/unused',
  port: 3000,
  storageFeeBase: 10,
};

describe('GET /health', () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  beforeAll(async () => {
    app = await buildApp(env, { logger: false });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('responds 200 with exactly {"status":"ok"}', async () => {
    const response = await app!.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.body).toBe('{"status":"ok"}');
  });

  it('declares the contract in its response schema (contract-first, AD-1)', async () => {
    const response = await app!.inject({
      method: 'GET',
      url: '/health',
      headers: { accept: 'application/json' },
    });

    expect(response.json()).toEqual({ status: 'ok' });
    expect(Object.keys(response.json() as object)).toEqual(['status']);
  });
});
