/**
 * RoleCard (EXPERIENCE.md component patterns — chooser landing only).
 *
 * The whole card is the click target, so the root is a real anchor: the full
 * surface is interactive, keyboard Enter works natively, and there is never a
 * nested control ("Never a nested button"). Hover brightens the border toward
 * brand — matte tonal depth, never a lift (DESIGN.md: light gets a
 * barely-there warm shadow, dark gets none).
 *
 * Presentation-only (AD-10): it knows nothing about routes; the app passes
 * `href` (works without JS) and may intercept clicks for SPA navigation.
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { Eyebrow } from './brand.js';

export interface RoleCardProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  eyebrow: string;
  title: string;
  description: string;
}

export const RoleCard = React.forwardRef<HTMLAnchorElement, RoleCardProps>(
  ({ className, eyebrow, title, description, ...props }, ref) => (
    <a
      ref={ref}
      className={cn(
        'flex min-h-44 cursor-pointer flex-col rounded-lg border border-border bg-card',
        'px-[1.375rem] pt-6 pb-[1.625rem] text-left',
        'transition-[border-color,box-shadow] duration-150',
        'hover:border-brand hover:shadow-hover',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        className,
      )}
      {...props}
    >
      <Eyebrow>{eyebrow}</Eyebrow>
      <span className="mt-2.5 font-display text-[1.3125rem] leading-tight uppercase text-foreground">
        {title}
      </span>
      <p className="mt-1.5 font-sans text-sm text-muted-foreground">
        {description}
      </p>
    </a>
  ),
);
RoleCard.displayName = 'RoleCard';
