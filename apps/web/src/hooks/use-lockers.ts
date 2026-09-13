/**
 * useLockers — live station availability (EXPERIENCE.md LockerGrid).
 *
 * Polls GET /lockers every 10s while the tab is visible and pauses while it
 * is hidden (catching up on return). A failed poll is silent: the tiles stay,
 * the "last updated" label goes stale, and the next poll retries — no toast
 * spam. The SPA never derives availability itself; every state here mirrors
 * an API response (AD-10).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { api, type LockerListItem, type LockersReply } from '../api/client.js';

export interface UseLockersResult {
  /** `null` until the first successful load (cold load → skeletons). */
  lockers: LockerListItem[] | null;
  /** True when the most recent fetch failed (initial failure or stale poll). */
  failed: boolean;
  /** A poll failed but earlier data is still on screen. */
  stale: boolean;
  updatedAt: Date | null;
  refresh: () => Promise<void>;
}

export interface UseLockersOptions {
  /** Injectable for tests; defaults to the real API call. */
  fetcher?: () => Promise<LockersReply>;
  intervalMs?: number;
}

function isDocumentVisible(): boolean {
  return document.visibilityState === 'visible';
}

export function useLockers({
  fetcher = api.listLockers,
  intervalMs = 10_000,
}: UseLockersOptions = {}): UseLockersResult {
  const [lockers, setLockers] = useState<LockerListItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refresh = useCallback(async () => {
    try {
      const reply = await fetcherRef.current();
      setLockers(reply.lockers);
      setUpdatedAt(new Date());
      setFailed(false);
    } catch {
      // Silent skip (EXPERIENCE.md poll failure): keep what's on screen.
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const tick = () => {
      if (isDocumentVisible()) void refresh();
    };
    const onVisibility = () => {
      // Back from a hidden tab: catch up immediately instead of waiting
      // out the remainder of the interval.
      if (isDocumentVisible()) void refresh();
    };

    const id = window.setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh, intervalMs]);

  return { lockers, failed, stale: failed && lockers !== null, updatedAt, refresh };
}
