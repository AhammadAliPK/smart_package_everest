import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../src/adapters/http/app.js';
import type { Env } from '../src/config/env.js';

/**
 * CORS is deploy-only (story 5.1): the Render web UI calls the API from a
 * different origin, while local development reaches the API through the Vite
 * proxy and stays same-origin. `CORS_ORIGIN` unset therefore means the plugin
 * is never registered — these suites prove both worlds, per app instance,
 * with no database (no route here touches one).
 */

const DEPLOY_ORIGIN = 'https://everest-web.onrender.com';

function envWith(corsOrigin?: string[]): Env {
  return {
    databaseUrl: 'postgres://unused:unused@localhost:5432/unused',
    port: 3000,
    storageFeeBase: 10,
    corsOrigin,
  } satisfies Env;
}

describe('CORS with CORS_ORIGIN set', () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  beforeAll(async () => {
    app = await buildApp(envWith([DEPLOY_ORIGIN]), { logger: false });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('echoes an allowed origin back as access-control-allow-origin', async () => {
    const response = await app!.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: DEPLOY_ORIGIN },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(
      DEPLOY_ORIGIN,
    );
  });

  it('answers a GET/POST preflight for an allowed origin', async () => {
    const response = await app!.inject({
      method: 'OPTIONS',
      url: '/pickups',
      headers: {
        origin: DEPLOY_ORIGIN,
        'access-control-request-method': 'POST',
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(
      DEPLOY_ORIGIN,
    );
    expect(response.headers['access-control-allow-methods']).toContain('GET');
    expect(response.headers['access-control-allow-methods']).toContain('POST');
  });

  it('sends no access-control-allow-origin to an unlisted origin', async () => {
    const response = await app!.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://evil.example' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('CORS with CORS_ORIGIN unset (local dev unchanged)', () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  beforeAll(async () => {
    app = await buildApp(envWith(), { logger: false });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('adds no CORS headers to any route', async () => {
    for (const url of ['/health', '/lockers', '/no-such-route']) {
      const response = await app!.inject({
        method: 'GET',
        url,
        headers: { origin: DEPLOY_ORIGIN },
      });

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
      expect(response.headers['access-control-allow-methods']).toBeUndefined();
    }
  });

  it('never registers the plugin — OPTIONS is not a route at all', async () => {
    const response = await app!.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: {
        origin: DEPLOY_ORIGIN,
        'access-control-request-method': 'GET',
      },
    });

    expect(response.statusCode).toBe(404);
  });
});
