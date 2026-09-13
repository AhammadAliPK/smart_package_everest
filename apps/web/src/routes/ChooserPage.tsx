import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router';

import { BrandDash, Eyebrow, RoleCard } from '@locker/ui';

import { usePageTitleFocus } from './usePageFocus.js';

/**
 * `/` — the chooser. The only branching surface in the app (EXPERIENCE.md):
 * two RoleCards, whole-card click targets, everything past this is a
 * dead-end workflow. Two wide doors share the content column from `lg` up
 * (DESIGN.md "large rounded-lg cards"; the negative space lives in the
 * section margins, not in a half-empty row).
 */
export function ChooserPage() {
  const titleRef = usePageTitleFocus<HTMLHeadingElement>();
  const navigate = useNavigate();

  /** RoleCard is a plain anchor; intercept for SPA navigation. */
  const goTo = (to: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    navigate(to);
  };

  return (
    <section className="mx-auto w-full max-w-[1100px] px-margin-mobile py-section md:px-margin-desktop">
      <Eyebrow>Everest Lockers</Eyebrow>
      <h1
        ref={titleRef}
        tabIndex={-1}
        className="page-title mt-2 font-display text-display uppercase text-foreground"
      >
        Choose your door
      </h1>
      <BrandDash className="mt-4" />

      <div className="mt-10 flex flex-col gap-[18px] lg:flex-row">
        <RoleCard
          href="/agent"
          onClick={goTo('/agent')}
          eyebrow="Delivery agent"
          title="Store packages"
          description="See the station, drop packages in, get pickup codes."
          className="w-full lg:flex-1"
        />
        <RoleCard
          href="/retrieve"
          onClick={goTo('/retrieve')}
          eyebrow="Customer"
          title="Pick up a package"
          description="Enter your locker ID and pickup code."
          className="w-full lg:flex-1"
        />
      </div>
    </section>
  );
}
