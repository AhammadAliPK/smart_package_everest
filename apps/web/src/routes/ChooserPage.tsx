import { BrandDash, Eyebrow } from '@locker/ui';

import { usePageTitleFocus } from './usePageFocus.js';

/** `/` — placeholder until Story 4.2 hangs the two RoleCards here. */
export function ChooserPage() {
  const titleRef = usePageTitleFocus<HTMLHeadingElement>();

  return (
    <section className="mx-auto w-full max-w-[1100px] px-[margin-mobile] py-section md:px-[margin-desktop]">
      <Eyebrow>Everest Lockers</Eyebrow>
      <h1 ref={titleRef} tabIndex={-1} className="page-title mt-2 font-display text-display uppercase text-foreground">
        Choose your door
      </h1>
      <BrandDash className="mt-4" />
      <p className="mt-6 max-w-md font-sans text-base text-muted-foreground">
        The two RoleCards arrive with Story 4.2.
      </p>
    </section>
  );
}
