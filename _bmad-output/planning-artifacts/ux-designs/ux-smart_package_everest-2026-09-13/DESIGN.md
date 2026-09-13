---
name: Everest Lockers
description: Visual identity for the Smart Package Locker web UI (delivery agent console + customer retrieval), derived from the Everest Engineering source deck. shadcn/ui on React + Tailwind; this DESIGN.md specifies the brand-layer delta only.
status: final
created: '2026-09-13'
updated: '2026-09-13'
sources: ['docs/prd.md', 'docs/design/source-theme.md']
colors:
  # Theme deltas. Dark is the shipped default (html gets class="dark"); light is the toggle.
  # Unlisted shadcn tokens (popover, input, muted-foreground, destructive, …) inherit defaults.
  background-light: '#F5F2EC'        # warm paper, never stark white
  background-dark: '#0D0D0B'         # the deck's matte near-black
  foreground-light: '#1A1915'
  foreground-dark: '#F5F2EC'         # warm off-white, never pure white
  card-light: '#FBF9F3'
  card-dark: '#141414'
  border-light: '#E5DFD2'
  border-dark: '#2A2A2A'
  muted-dark: '#A9A9A1'               # AA (≥4.5:1) on card for 12–14px secondary text
  faint-dark: '#8B8B84'               # decorative only — footers, disabled; never sole information
  # Brand layer — constant across themes (the deck's identity)
  brand: '#F5A100'                   # the single saturated color
  on-brand: '#1A1508'                # ink on orange (~9:1); black-on-orange is in the deck's own logo
  butter: '#F5EFB8'                  # display-text highlight on dark; tint wash on light
  cream: '#E8D9A8'                   # the lockers are cream in the deck
  cream-edge: '#C9B57E'
  gold: '#E0C9A6'                    # keyword tint in body copy (dark theme only)
  glow: '#FFD84D'                    # sparingly: live/active sliver
  ring: '#F5A100'                    # focus ring is brand orange, AA-visible on both themes
typography:
  # Body/label/caption inherit shadcn's ramp, set in Inter (configured once in the Tailwind theme).
  display:
    fontFamily: 'DM Serif Display'
    fontSize: 40px
    fontWeight: '400'
    lineHeight: '1.1'
    letterSpacing: 0.01em
  display-sm:
    fontFamily: 'DM Serif Display'
    fontSize: 24px
    fontWeight: '400'
    lineHeight: '1.2'
    letterSpacing: 0.01em
  label-caps:
    fontFamily: 'Inter'
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.2em
  code:
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace'
    fontSize: 28px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: 0.15em
rounded:
  # Slightly sharper than shadcn defaults — matte, editorial, "object" not "bubble".
  sm: 4px
  md: 6px
  lg: 8px
  full: 9999px
spacing:
  # Tailwind 4-base scale inherited. Brand additions:
  gutter: 24px
  margin-mobile: 20px
  margin-desktop: 64px
  section-gap: 64px
components:
  button-primary:
    background: '{colors.brand}'
    foreground: '{colors.on-brand}'
    radius: '{rounded.md}'
  brand-badge:
    background: '{colors.brand}'
    foreground: '#FFFFFF'
    radius: '{rounded.sm}'
    note: 'the "E." square — white letter, decorative logo use only'
  brand-dash:
    background: '{colors.brand}'
    height: 4px
    width: 40px
    radius: '{rounded.full}'
    note: 'thick rounded dash motif under titles/sections'
  eyebrow:
    color: '{colors.muted-dark}'
    typography: '{typography.label-caps}'
  locker-tile-free:
    background: '{colors.cream}'
    border: '{colors.cream-edge}'
    radius: '{rounded.lg}'
    foreground: '{colors.on-brand}'
  locker-tile-occupied:
    background: '{colors.card-dark}'
    border: '{colors.border-dark}'
    radius: '{rounded.lg}'
    foreground: '{colors.muted-dark}'
  pickup-code-display:
    color: '{colors.butter}'
    typography: '{typography.code}'
    note: 'on light theme, foreground-light instead of butter (contrast)'
  role-card:
    background: '{colors.card-dark}'
    border: '{colors.border-dark}'
    radius: '{rounded.lg}'
    hover-border: '{colors.brand}'
  focus-ring:
    outline: '{colors.ring}'
---

## Brand & Style

**Editorial dark-first, one saturated color.** The identity is lifted from the Everest Engineering source deck: matte near-black surfaces, a single brand orange that means *the product*, butter-yellow display type, and cream lockers that look like physical objects sitting on the dark. It reads **bold · editorial · confident** — a locker station that behaves like a well-designed publication, not a dashboard.

The system inherits shadcn/ui defaults wholesale; this file specifies only the brand-layer deltas — theme colors, two display faces, the locker/object vocabulary, and the deck's motifs (orange square, rounded dash, cream tiles). Customizing inherited shadcn components beyond the overrides listed here is against the brand discipline.

Dark mode is the default and the reference rendering; light mode is a full inverted theme on the same brand hues (the deck's off-white becomes warm paper). Theme is a toggle, never a per-surface mix.

## Colors

Two layers: **theme deltas** (background/card/border/foreground per mode) and a **brand layer** constant across themes.

- **Brand Orange (`{colors.brand}`)** is the only saturated color. Buttons, the badge, the dash, focus rings, active states. On dark it glows against matte black; on light it carries **ink text** (`{colors.on-brand}`) — white-on-orange fails contrast and is reserved for the logo mark alone.
- **Butter (`{colors.butter}`)** is display text on dark (the deck's slide titles) and a tint-wash fill behind dark text on light. Never body text color.
- **Cream (`{colors.cream}`)** is what a *free* locker looks like — the deck's locker illustrations. Occupied lockers lose the cream and sink to card/border tones: availability is the most colorful thing on screen.
- **Gold (`{colors.gold}`)** tints bolded keywords inside body copy, dark theme only.
- **Glow (`{colors.glow}`)** appears only as a thin live/active sliver — the light between locker doors. Use at most once per surface.
- **Muted grays** carry eyebrows and secondary text. `{colors.muted-dark}` is tuned to ≥4.5:1 on card surfaces — the deck's own #8A8A8A/#5A5A56 read fine at 28–32px slide-display size but fail AA at 12–14px UI labels, so the UI lightens them. `{colors.faint-dark}` is decorative only (footers, disabled states): never carries information alone.

Avoid: gradients, a second saturated hue, colored state badges beyond shadcn's destructive, borders that compete with cream.

## Typography

Two voices, both from the deck. **DM Serif Display** is the curator — ALL-CAPS page titles ("EVEREST LOCKERS"), empty-state headlines, one per surface, `display`/`display-sm` only. **Inter** does everything else (body, labels, buttons, forms) via shadcn's ramp.

- `display` (40px / 24px small): ALL CAPS, generous line-height, optically centered or asymmetric — never stretched full-width.
- `label-caps` (eyebrows): UPPERCASE, 0.2em tracking, muted — "DELIVERY AGENT", "STATION VIEW".
- `code`: monospace for locker IDs and pickup codes — the most-communicated strings on screen render in `typography.code` with wide tracking; never in the serif, never in proportional sans.

The serif is a punctuation mark, not a default voice. Body text in serif is a defect.

## Layout & Spacing

Asymmetric editorial compositions: a heavy text/panel block one side, a single hero object (the locker grid) the other; maximum negative space. Tailwind's 4-base scale inherited; `{spacing.section-gap}` (64px) separates major sections; mobile keeps `{spacing.margin-mobile}` (20px) so content frames like a page, not an edge-bleed. Content never exceeds ~1100px; the station grid is the widest element and may be wider than text columns.

## Elevation & Depth

**Matte flat — depth is tonal, not shadowed.** Dark theme: no drop shadows at all; layers separate by fill (`background` → `card`) plus 1px `{colors.border-dark}` strokes, exactly like the deck's cards. Light theme: at most a barely-there warm shadow `rgba(26,25,21,0.06)` on hover for cards. Hover state is a border brighten toward `{colors.brand}`, never a lift.

## Shapes

Slightly rounded squares — the deck's logo geometry. `{rounded.sm}` (4px) inputs and the badge, `{rounded.md}` (6px) buttons and small chips, `{rounded.lg}` (8px) cards, dialogs, locker tiles. `{rounded.full}` only for the dash motif and status pills. No pill buttons, no circular tiles.

## Components

Inherited from shadcn unchanged: `Button` (non-primary variants), `Input`, `Select`, `Dialog`, `Toast`/`Sonner`, `Tabs`, `Separator`, `Skeleton`, `Tooltip`.

Brand-layer components:

- **Button (primary variant)** — `{colors.brand}` fill, `{colors.on-brand}` text, `{rounded.md}`. The dominant CTA on every surface; exactly one primary button visible per view.
- **Brand badge & dash** — the "E." orange square (`brand-badge`) and the thick rounded bar (`brand-dash`) under titles. Logo lockup: badge left, "Everest" bold / "engineering" lighter stacked right, dash under "engineering".
- **Locker tile** — the hero object. Free: `{colors.cream}` fill, `{colors.cream-edge}` edge, ink text, `{rounded.lg}` — a lit physical door. Occupied: `{colors.card-dark}` fill, muted text, sunken. Size label (`label-caps`) always visible; locker ID in `typography.code` when shown.
- **Pickup-code display** — result-card centerpiece: `typography.code` at display scale, `{colors.butter}` on dark / `{colors.foreground-light}` on light, copy affordance beside it. This is the string Rahul photographs; it renders larger than anything else on its surface except `display`.
- **Result card** — `card` fill, 1px border, `{rounded.lg}`; locker ID + code stacked with generous spacing; the one place the dash motif repeats in-flow.
- **Charge summary** — quiet ledger inside the confirmation: rows of days × tier rate in `body`, total in `display-sm`-weight sans; no table chrome, hairline separators only.
- **Role card** — chooser landing's two doors: large `{rounded.lg}` cards, `label-caps` eyebrow + `display-sm` title + one body line; hover border → `{colors.brand}`.
- **Code input** — chunked `XXXX-XXXX`: 8 monospace cells, auto-advance, auto-uppercase; cells are `{rounded.sm}` boxes, focused cell ringed in `{colors.ring}`.

## Do's and Don'ts

| Do | Don't |
| --- | --- |
| Dark theme is the reference rendering; check every screen in it first | Design light-first and "invert later" |
| Cream = free locker, the brightest object on screen | Use cream as a generic surface or badge color |
| One primary (orange) button per view | Orange icons, orange text links, orange everywhere |
| Ink text on orange buttons | White text on orange (fails AA; logo mark only) |
| Serif ALL-CAPS titles, one per surface | Serif body text, serif buttons, all-caps body |
| Monospace for IDs and codes | Proportional fonts for any code string |
| Matte tonal depth, hairline strokes | Drop shadows in dark theme, glows, gradients |
| Maximum negative space, asymmetric hero compositions | Fill the void with chrome, stats, or panels |
| Muted text ≥4.5:1 on card at 12–14px (AA) | Copy the deck's slide-scale grays (#8A8A8A/#5A5A56) into small UI text |
