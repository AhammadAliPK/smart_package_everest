import { BrandDash, Eyebrow } from '@locker/ui';

import { usePageTitleFocus } from './usePageFocus.js';

/** `/retrieve` — placeholder until Story 4.6 hangs the retrieval form here. */
export function RetrievePage() {
  const titleRef = usePageTitleFocus<HTMLHeadingElement>();

  return (
    <section className="mx-auto w-full max-w-[1100px] px-[margin-mobile] py-section md:px-[margin-desktop]">
      <Eyebrow>Customer pickup</Eyebrow>
      <h1 ref={titleRef} tabIndex={-1} className="page-title mt-2 font-display text-display uppercase text-foreground">
        Pick up a package
      </h1>
      <BrandDash className="mt-4" />
      <p className="mt-6 max-w-md font-sans text-base text-muted-foreground">
        The retrieval form arrives with Story 4.6.
      </p>
    </section>
  );
}
