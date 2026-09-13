# Source Visual Theme — Everest Engineering

> Extracted 2026-09-13 from `docs/Smart Package Everest Coding challenge.pdf` (pages 1, 3) per user directive: *the web UI's design language must match the source document's theme*. This file is the brand basis for the UX design contract (bmad-ux) and the `@locker/ui` token set.

## Palette

| Token | Hex | Where it appears in the source |
| --- | --- | --- |
| `background` | `#0D0D0B` / `#141414` | Matte near-black page background; flat, no gradients |
| `card-fill` / `card-stroke` | `#141414` / `#2A2A2A`–`#333333` | Content cards: same near-black fill with subtle lighter stroke |
| `brand` (orange) | `#F5A100` | Logo square badge, underline dash, accents — the single saturated color |
| `highlight` (butter-yellow) | `#F5EFB8` | Slide titles |
| `cream` (locker tone) | `#E8D9A8` | Locker illustrations (fill), edges `#C9B57E` / `#B5A26E` |
| `keyword` (gold tint) | `#E0C9A6` | Bolded keywords inside body copy |
| `glow` (yellow) | `#FFD84D` | The glowing sliver between lockers — use sparingly for live/active states |
| `text-primary` | `#F5F2EC` | Warm off-white body text (never pure white) |
| `text-secondary` | `#8A8A8A` | Muted gray: headings-as-labels, footers |
| `text-faint` | `#5A5A56` | Eyebrow labels |
| `keypad-dark` | `#1A1A2E` | Keypad plates (input/control surfaces) with small blue digits |

## Typography

- **Display**: high-contrast editorial serif (Didone class — Canela/Noe Display style), regular-medium weight, ALL CAPS, very large, generous line-height — page titles only
- **Eyebrow/labels**: geometric sans (Inter class), medium, UPPERCASE, wide letter-spacing (~0.2em), muted gray
- **Body**: geometric sans, regular, sentence case, ~1.5 line-height, off-white; **keywords bolded inline**, key terms additionally gold-tinted
- **Logo lockup**: "E." white bold sans inside the orange square (slightly rounded corners, letter left-aligned); wordmark "Everest" bold + "engineering" lighter, stacked; thick rounded orange dash under "engineering"

## Motifs & composition

- Solid **orange square badge** as the brand mark
- **Thick rounded orange dash** as an underline/section accent
- **Asymmetric layouts**: heavy text block one side, single hero object the other; maximum negative space
- **Matte flat surfaces** — no gradients, no borders beyond subtle card strokes
- Flow shown as **sequential cards with thin gray connector arrows** (muted `#4A4A4A`), not bullets

## Mood

**Bold · editorial · confident** — dark-mode-first, one saturated brand color, generous space, confident display type.
