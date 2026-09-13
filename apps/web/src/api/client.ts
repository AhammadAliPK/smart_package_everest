/**
 * Thin typed fetch client over the locker API (AD-10).
 *
 * The *types* are generated from the API's real OpenAPI document
 * (`schema.d.ts` — see apps/api/scripts/export-openapi.ts); only the fetch
 * plumbing is hand-written. Every non-2xx arrives as an `ApiError` carrying
 * the AD-7 `{"error":{"code","message"}}` envelope verbatim — the UI maps
 * codes to copy, it never recomputes outcomes.
 */

import type { paths } from './schema.js';

/** A stable handle on one API reply shape from the generated paths. */
type Reply<Path extends keyof paths, Method extends keyof paths[Path] & string, Code extends number> =
  paths[Path][Method] extends { responses: Record<Code, { content: { 'application/json': infer Body } }> }
    ? Body
    : never;

export type LockersReply = Reply<'/lockers', 'get', 200>;
export type LockerListItem = LockersReply['lockers'][number];
export type CreateLockerReply = Reply<'/lockers', 'post', 201>;
export type StorePackageReply = Reply<'/packages', 'post', 201>;
export type PickupReply = Reply<'/pickups', 'post', 200>;

/** The AD-7 error envelope, as the API shapes it. */
export interface ApiErrorEnvelope {
  readonly error: { readonly code: string; readonly message: string };
}

/** One API failure: the envelope's code+message plus the HTTP status. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

/** Base URL: same-origin in dev (Vite proxy) and configurable for deploys. */
const baseUrl: string = import.meta.env.VITE_API_BASE_URL ?? '';

async function request<Path extends keyof paths & string, Method extends keyof paths[Path] & string, Body>(
  method: Method,
  path: Path,
  body?: Body,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: method.toUpperCase(),
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // Network-level failure — surfaced as the calm INTERNAL_ERROR shape.
    throw new ApiError('INTERNAL_ERROR', 0, 'Something went wrong on our side.');
  }

  if (!response.ok) {
    let code = 'INTERNAL_ERROR';
    let message = 'Something went wrong on our side.';
    try {
      const envelope = (await response.json()) as Partial<ApiErrorEnvelope>;
      if (envelope.error && typeof envelope.error.code === 'string') {
        code = envelope.error.code;
        message = envelope.error.message ?? message;
      }
    } catch {
      // Non-JSON failure body — keep the calm defaults.
    }
    throw new ApiError(code, response.status, message);
  }

  return response.json();
}

export const api = {
  listLockers: () => request('get', '/lockers') as Promise<LockersReply>,
  createLocker: (size: LockerSizeValue) =>
    request('post', '/lockers', { size }) as Promise<CreateLockerReply>,
  storePackage: (payload: { size: LockerSizeValue; customerRef?: string }) =>
    request('post', '/packages', payload) as Promise<StorePackageReply>,
  retrievePackage: (payload: { lockerId: string; pickupCode: string }) =>
    request('post', '/pickups', payload) as Promise<PickupReply>,
};

/** The declared sizes, as the API's schema spells them. */
export type LockerSizeValue = LockerListItem['size'];
