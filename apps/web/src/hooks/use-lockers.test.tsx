import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LockersReply } from '../api/client.js';
import { useLockers } from './use-lockers.js';

/** Story 4.3 polling contract: 10s while visible, pause hidden, silent fail. */
const page: LockersReply = {
  lockers: [
    { id: 'A1', size: 'SMALL', occupied: false },
    { id: 'A2', size: 'MEDIUM', occupied: true },
  ],
};

function setVisibility(visible: boolean) {
  Object.defineProperty(document, 'visibilityState', {
    value: visible ? 'visible' : 'hidden',
    configurable: true,
  });
}

describe('useLockers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility(true);
  });
  afterEach(() => vi.useRealTimers());

  it('loads once on mount and exposes the list', async () => {
    const fetcher = vi.fn().mockResolvedValue(page);
    const { result } = renderHook(() =>
      useLockers({ fetcher, intervalMs: 10_000 }),
    );

    await act(async () => {});

    expect(result.current.lockers).toEqual(page.lockers);
    expect(result.current.stale).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('polls every interval while the tab is visible', async () => {
    const fetcher = vi.fn().mockResolvedValue(page);
    renderHook(() => useLockers({ fetcher, intervalMs: 10_000 }));

    await act(async () => {});
    await act(async () => vi.advanceTimersByTime(10_000));
    await act(async () => vi.advanceTimersByTime(10_000));

    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('pauses while hidden and catches up on return', async () => {
    const fetcher = vi.fn().mockResolvedValue(page);
    renderHook(() => useLockers({ fetcher, intervalMs: 10_000 }));
    await act(async () => {});

    setVisibility(false);
    await act(async () => vi.advanceTimersByTime(30_000));
    expect(fetcher).toHaveBeenCalledTimes(1); // paused the whole time

    setVisibility(true);
    await act(async () =>
      document.dispatchEvent(new Event('visibilitychange')),
    );
    expect(fetcher).toHaveBeenCalledTimes(2); // caught up immediately
  });

  it('keeps old data and goes stale when a poll fails', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(page)
      .mockRejectedValueOnce(new Error('network down'));
    const { result } = renderHook(() =>
      useLockers({ fetcher, intervalMs: 10_000 }),
    );
    await act(async () => {});
    expect(result.current.stale).toBe(false);

    await act(async () => vi.advanceTimersByTime(10_000));

    expect(result.current.lockers).toEqual(page.lockers); // still on screen
    expect(result.current.stale).toBe(true);
  });

  it('refresh() re-fetches on demand', async () => {
    const fetcher = vi.fn().mockResolvedValue(page);
    const { result } = renderHook(() => useLockers({ fetcher }));

    await act(async () => {});
    await act(async () => result.current.refresh());

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.current.failed).toBe(false);
  });
});
