import { BrandDash, Eyebrow } from '@locker/ui';

import { usePageTitleFocus } from './usePageFocus.js';

/** `/agent` — placeholder until Story 4.3 hangs the station grid here. */
export function AgentPage() {
  const titleRef = usePageTitleFocus<HTMLHeadingElement>();

  return (
    <section className="mx-auto w-full max-w-[1100px] px-[margin-mobile] py-section md:px-[margin-desktop]">
      <Eyebrow>Delivery agent</Eyebrow>
      <h1 ref={titleRef} tabIndex={-1} className="page-title mt-2 font-display text-display uppercase text-foreground">
        Station view
      </h1>
      <BrandDash className="mt-4" />
      <p className="mt-6 max-w-md font-sans text-base text-muted-foreground">
        The live locker grid arrives with Story 4.3.
      </p>
    </section>
  );
}
