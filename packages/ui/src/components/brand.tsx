/**
 * Brand motifs (DESIGN.md components: brand-badge, brand-dash, eyebrow).
 *
 * The "E." orange square, the thick rounded dash, and the label-caps eyebrow —
 * the deck's identity, as presentational parts. The badge is the one place
 * white-on-orange is allowed (logo mark only).
 */

import { cn } from '../lib/cn.js';

/** The "E." orange square — decorative logo mark; white letter is deliberate. */
export function BrandBadge({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center',
        'rounded-sm bg-brand font-sans text-base font-bold text-white',
        className,
      )}
    >
      E.
    </span>
  );
}

/** The thick rounded 4×40 brand dash that lives under titles. */
export function BrandDash({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('block h-1 w-10 rounded-full bg-brand', className)}
    />
  );
}

/** UPPERCASE muted eyebrow label ("DELIVERY AGENT", "STATION VIEW"). */
export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'text-label-caps font-medium uppercase tracking-caps text-muted-foreground',
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Logo lockup: badge left, "Everest" / "engineering" stacked right. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <BrandBadge />
      <span className="flex flex-col leading-tight">
        <span className="font-sans text-sm font-bold text-foreground">Everest</span>
        <span className="font-sans text-xs font-normal text-muted-foreground">
          engineering
        </span>
      </span>
    </span>
  );
}
