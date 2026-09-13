import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, api } from './api/client.js';

/** The client is the SPA's single interpretation point of AD-7 envelopes. */

/** Await a call that must fail, as the ApiError it should fail as. */
async function expectApiError(call: Promise<unknown>): Promise<ApiError> {
  try {
    await call;
    throw new Error('expected the call to fail');
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return error;
  }
}

describe('api client failure mapping', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('a network-level failure becomes the calm INTERNAL_ERROR shape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    );

    const error = await expectApiError(api.listLockers());

    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.status).toBe(0);
    expect(error.message).toBe('Something went wrong on our side.');
  });

  it('an AD-7 envelope is passed through verbatim', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'NO_SUITABLE_LOCKER',
              message: 'No free locker fits a SMALL package right now.',
            },
          }),
          { status: 409, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    const error = await expectApiError(api.storePackage({ size: 'SMALL' }));

    expect(error.code).toBe('NO_SUITABLE_LOCKER');
    expect(error.status).toBe(409);
    expect(error.message).toBe('No free locker fits a SMALL package right now.');
  });

  it('a non-JSON failure body degrades to the calm defaults', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<html>gateway lost it</html>', {
          status: 502,
          headers: { 'content-type': 'text/html' },
        }),
      ),
    );

    const error = await expectApiError(
      api.retrievePackage({ lockerId: 'x', pickupCode: 'AAAAAAAA' }),
    );

    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.message).toBe('Something went wrong on our side.');
  });
});
