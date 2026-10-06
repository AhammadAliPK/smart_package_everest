/**
 * usePricing — the storage rate card (FR9), fetched once per mount.
 *
 * Rates decorate flows (the agent's store result, the customer's pickup
 * form); they must never gate or break them, so any failure — or a reply
 * that doesn't look like a schedule — simply leaves `pricing` null and the
 * host page renders nothing. The SPA never derives rates itself (AD-10).
 */

import { useEffect, useRef, useState } from 'react';

import { api, type PricingReply } from '../api/client.js';

export interface UsePricingResult {
  /** `null` until a well-shaped reply lands; stays null on any failure. */
  readonly pricing: PricingReply | null;
}

export interface UsePricingOptions {
  /** Injectable for tests; defaults to the real API call. */
  fetcher?: () => Promise<PricingReply>;
}

/** Runtime shape check — a mocked or malformed reply renders nothing. */
function isPricingReply(value: unknown): value is PricingReply {
  if (typeof value !== 'object' || value === null) return false;
  const reply = value as Partial<PricingReply>;
  return (
    Array.isArray(reply.sizes) &&
    reply.sizes.length > 0 &&
    reply.sizes.every(
      (block) =>
        typeof block?.size === 'string' &&
        typeof block?.baseFee === 'number' &&
        Array.isArray(block?.tiers) &&
        block.tiers.every(
          (row) =>
            typeof row?.tier === 'number' &&
            typeof row?.fromDay === 'number' &&
            (typeof row?.toDay === 'number' || row?.toDay === null) &&
            typeof row?.perDay === 'number',
        ),
    )
  );
}

export function usePricing({
  fetcher = api.getPricing,
}: UsePricingOptions = {}): UsePricingResult {
  const [pricing, setPricing] = useState<PricingReply | null>(null);

  // useLockers' convention: a ref keeps a latest-fetcher without making the
  // one-shot effect re-run when callers pass an inline function.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const reply = await fetcherRef.current();
        if (alive && isPricingReply(reply)) setPricing(reply);
      } catch {
        // Rates are decoration: a failed fetch renders nothing.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { pricing };
}
