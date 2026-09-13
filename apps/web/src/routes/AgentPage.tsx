import { useState } from 'react';

import {
  BrandDash,
  Button,
  EmptyState,
  ErrorBanner,
  Eyebrow,
  LockerTile,
  Skeleton,
} from '@locker/ui';

import type { LockerSizeValue } from '../api/client.js';
import { useLockers } from '../hooks/use-lockers.js';
import { CreateLockerDialog } from './CreateLockerDialog.js';
import { usePageTitleFocus } from './usePageFocus.js';
import { StorePanel } from './StorePanel.js';

/** Skeleton tiles match the final layout — never a spinner-only load. */
const SKELETON_TILES = 8;

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * `/agent` — the station view (EXPERIENCE.md). Live availability is the hero:
 * cream free tiles, sunken occupied ones, a count summary announced politely,
 * and a 10s poll that pauses while the tab is hidden. From `lg` up the layout
 * is asymmetric: the grid hero (wider) + the store panel. Free-tile clicks
 * prefill the store form's size — convenience, never required.
 */
export function AgentPage() {
  const titleRef = usePageTitleFocus<HTMLHeadingElement>();
  const { lockers, failed, stale, updatedAt, refresh } = useLockers();
  const [createOpen, setCreateOpen] = useState(false);

  // Free-tile prefill for the store form; `n` re-fires the effect even when
  // the same size is picked twice after a manual change.
  const [prefill, setPrefill] = useState<{ size: LockerSizeValue; n: number } | null>(
    null,
  );

  const freeCount = lockers ? lockers.filter((l) => !l.occupied).length : 0;
  const firstFree = lockers?.findIndex((l) => !l.occupied) ?? -1;

  return (
    <section className="mx-auto w-full max-w-275 px-[margin-mobile] py-section md:px-[margin-desktop]">
      <Eyebrow>Delivery agent</Eyebrow>
      <h1
        ref={titleRef}
        tabIndex={-1}
        className="page-title mt-2 font-display text-display uppercase text-foreground"
      >
        Station view
      </h1>
      <BrandDash className="mt-4" />

      <div className="mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-10">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p
              role="status"
              aria-live="polite"
              className="font-sans text-sm text-muted-foreground"
            >
              {lockers ? `${freeCount} free of ${lockers.length}` : 'Loading the station…'}
            </p>
            <div className="flex items-center gap-4">
              {updatedAt ? (
                <p className={`font-sans text-sm ${stale ? 'text-gold' : 'text-faint'}`}>
                  Last updated {formatTime(updatedAt)}
                  {stale ? ' — updating…' : ''}
                </p>
              ) : null}
              <Button variant="secondary" onClick={() => void refresh()}>
                Refresh
              </Button>
              <Button variant="secondary" onClick={() => setCreateOpen(true)}>
                Create locker
              </Button>
            </div>
          </div>

          {failed && lockers === null ? (
            <ErrorBanner className="mt-6">
              Something went wrong on our side.
            </ErrorBanner>
          ) : null}

          {lockers === null && !failed ? (
            <ul
              role="list"
              aria-busy="true"
              aria-label="Lockers loading"
              className="mt-6 grid gap-3.5 grid-cols-[repeat(auto-fill,minmax(130px,1fr))]"
            >
              {Array.from({ length: SKELETON_TILES }, (_, index) => (
                <li key={index}>
                  <Skeleton className="min-h-26" />
                </li>
              ))}
            </ul>
          ) : null}

          {lockers && lockers.length === 0 ? (
            <EmptyState
              headline="This station has no lockers yet."
              action={
                <Button variant="primary" onClick={() => setCreateOpen(true)}>
                  Create the first locker
                </Button>
              }
            />
          ) : null}

          {lockers && lockers.length > 0 ? (
            <ul
              role="list"
              aria-label="Lockers at this station"
              className="mt-6 grid gap-3.5 grid-cols-[repeat(auto-fill,minmax(130px,1fr))]"
            >
              {lockers.map((locker, index) => (
                <LockerTile
                  key={locker.id}
                  size={locker.size}
                  occupied={locker.occupied}
                  accent={index === firstFree}
                  onSelect={() =>
                    setPrefill((current) => ({
                      size: locker.size,
                      n: (current?.n ?? 0) + 1,
                    }))
                  }
                />
              ))}
            </ul>
          ) : null}
        </div>

        <StorePanel prefill={prefill} onStored={refresh} />
      </div>

      <CreateLockerDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={refresh}
      />
    </section>
  );
}
