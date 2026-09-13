---
name: Everest Lockers
description: Experience contract for the Smart Package Locker web UI — information architecture, behavior, states, interactions, accessibility, and journeys for the chooser, delivery agent console, and customer retrieval view. Visual identity lives in DESIGN.md.
status: final
created: '2026-09-13'
updated: '2026-09-13'
sources: ['docs/prd.md', 'docs/design/source-theme.md']
---

# Everest Lockers — Experience Spine

## Foundation

Responsive web SPA (React 19 + Vite, Tailwind CSS, shadcn/ui primitives from `@locker/ui`). Three surfaces: chooser landing, agent console, customer retrieval. Dark theme is the default; light is a toggle (persisted). No auth — roles are a navigation concern, not an identity concern. `DESIGN.md` is the visual identity reference; this spine is behavior. Per architecture AD-10: the SPA computes no domain outcomes — every charge, assignment, and error comes from the API response; API types are generated from OpenAPI, never hand-copied.

## Information Architecture

| Surface | Route | Reached from | Purpose |
| --- | --- | --- | --- |
| Chooser landing | `/` | app open | Two role cards — pick agent or customer |
| Agent console | `/agent` | chooser card, direct URL, bookmark | Station view + store package + create locker |
| Customer retrieval | `/retrieve` | chooser card, QR code on physical station | Retrieve package, see charge |

Dialogs stack at most one level (create-locker dialog over the console; never dialog-on-dialog). The chooser is the only branching surface; every other surface is a dead-end workflow (form → result → repeat or done).

→ Composition reference: `mockups/design-language.html`. Spines win on conflict.

## Voice and Tone

Microcopy. Brand posture lives in `DESIGN.md.Brand & Style`.

| Do | Don't |
| --- | --- |
| "Locker 12 is open. Take your package." | "Operation completed successfully ✓" |
| "That code doesn't match this locker." | "INVALID PICKUP CODE (404)" |
| "No free locker fits a LARGE package right now." | "ERROR: allocation failed!!" |
| "This locker is already empty — the package may have been picked up." | "Locker state exception" |
| "Something went wrong on our side." + retry | Raw error dumps, stack traces, code jargon |
| Blame-free, calm, physical-world vocabulary (lockers, doors, packages) | System vocabulary (records, entities, operations) |

## Component Patterns

Behavioral. Visual specs live in `DESIGN.md.Components`.

| Component | Use | Behavioral rules |
| --- | --- | --- |
| RoleCard ×2 | `/` | Whole card is the click target; navigates on release; hover border → `{colors.brand}`. Never a nested button. |
| LockerGrid | `/agent` | Auto-refreshes via polling every 10s while visible; pauses when tab hidden; manual refresh affordance always present. Updates immediately after any local store success. Shows size + occupied state per tile; free tiles use `{colors.cream}`. |
| LockerCard | LockerGrid cell | Free tile click prefills the store form's size (convenience, never required). Occupied tiles are not interactive. |
| StorePackageForm | `/agent` | Size select (SMALL/MEDIUM/LARGE) + optional customerRef; Enter submits; on success yields ResultCard and clears for the next package (agent rhythm: repeat ×20). |
| ResultCard | `/agent` after store | Locker ID + pickup code in `typography.code`, oversized; one-tap copy each; focus moves here on render (screen reader announces). Persists until next store or navigation. |
| CreateLockerControl | `/agent` | Size picker + submit, in a dialog; station grid refreshes on success. |
| RetrievePackageForm | `/retrieve` | Locker ID input + CodeInput; Enter submits; on error, all input preserved and the failing field flagged; on success, confirmation + ChargeSummary replaces the form. |
| CodeInput | `/retrieve` | 8 cells `XXXX-XXXX`; auto-advance, auto-uppercase, paste-tolerant (a pasted 8-char string fills all cells); alphabet excludes `0/O/1/I` — inputs reject those characters with a gentle inline hint. |
| ChargeSummary | `/retrieve` confirmation | Ledger rows: days 1–5 × X, days 6–10 × 2X, day 11+ × 3X (only tiers actually used shown), then total. Numbers come from the API response verbatim — never recomputed. |
| EmptyState | `/agent` no lockers | `display-sm` headline "This station has no lockers yet." + single primary action "Create the first locker". |
| ErrorBanner | forms | Replaces nothing the user typed; appears above the submit button; message text per State Patterns. |

## State Patterns

| State | Surface | Treatment |
| --- | --- | --- |
| Cold load | Grid, forms | Skeleton tiles/fields matching final layout; never spinner-only. |
| Submit pending | Both forms | Button shows in-place spinner + disables; inputs lock. |
| Store success | `/agent` | ResultCard (locker + code); grid tile flips to occupied. |
| Retrieve success | `/retrieve` | "Locker {id} is open." + ChargeSummary; option to retrieve another. |
| `NO_SUITABLE_LOCKER` (409) | StorePackageForm | Calm banner: "No free locker fits a {size} package right now." No form reset. |
| `INVALID_PICKUP_CODE` (404) | RetrievePackageForm | "That code doesn't match this locker." Code preserved, one tap to retry. |
| `LOCKER_NOT_FOUND` (404) | RetrievePackageForm | "No locker with that ID at this station." Locker ID field flagged. |
| `LOCKER_EMPTY` (409) | RetrievePackageForm | "This locker is already empty — the package may have been picked up." |
| `VALIDATION_ERROR` (400) | Both forms | Inline field messages; no banner. |
| `INTERNAL_ERROR` (500) | Any | "Something went wrong on our side." + retry action. Never raw detail. |
| Poll failure | LockerGrid | Silent skip; subtle "last updated {time}" goes stale-labeled; next poll retries. No toast spam. |
| Empty station | `/agent` | EmptyState (above). |

## Interaction Primitives

- Enter submits the focused form; Esc closes dialogs; Tab order follows reading order.
- Copy affordances on locker ID and pickup code; clipboard write confirmed by a brief inline "Copied" swap (no toast).
- Theme toggle in header; persisted to localStorage; applies on next load without flash (class set before first paint).
- Route changes move focus to the page title and announce it.
- **Banned:** hover-only affordances on touch; modal stacks >1; destructive-red styling for capacity errors (they are calm facts); celebratory animations; drag interactions.

## Accessibility Floor

Behavioral. Visual contrast lives in `DESIGN.md` (brand overrides verified AA: on-brand ink ≈ 9:1).

- WCAG 2.2 AA across all surfaces.
- Touch targets ≥ 44×44px — Meera operates `/retrieve` one-handed.
- Form errors: `aria-live="polite"`, programmatically linked to their field (`aria-describedby`); error never destroys input.
- LockerGrid updates announce via `aria-live="polite"` region with a count summary ("14 free of 18"), not per-tile chatter.
- Focus visible everywhere: `{colors.ring}` orange ring, 2px offset.
- `prefers-reduced-motion`: transitions reduced to opacity-only or none.

## Responsive & Platform

| Breakpoint | Behavior |
| --- | --- |
| `≥ lg` (1024px+) | Agent console: asymmetric two-column — locker grid hero (wider) + store panel. Chooser: cards side by side. |
| `md` (768–1023px) | Console stacks: grid above, panel below. |
| `< md` | All surfaces single-column. `/retrieve` is designed phone-first: form is the whole screen, CodeInput cells at comfortable thumb scale. |

Responsive web only; no native shell. The customer surface is assumed opened on a phone (QR at the station); the agent surface on a tablet/laptop.

## Inspiration & Anti-patterns

- **Lifted from the source deck:** the entire brand layer — matte dark editorialism, one orange, cream lockers, square badge, rounded dash. The UI should feel like the challenge document came alive.
- **Lifted from shadcn:** the component vocabulary; the brand is *what we add*, not a from-scratch system.
- **Rejected — marketing landing page:** `/` is a working chooser, not a pitch.
- **Rejected — alarm-red capacity errors:** "no free locker" is a calm operational fact.
- **Rejected — celebration animations:** no confetti on retrieval; the open-locker confirmation is the reward.
- **Rejected — recomputing charges client-side:** every number is API-sourced (AD-10) even when it would be trivial to compute.

## Key Flows

### Flow 1 — Rahul's store run (delivery agent, 40 stops before lunch)

1. Rahul opens `/agent` between stops; the station grid is already on screen — 14 free of 18, sizes readable at a glance.
2. Package #1 is MEDIUM: he taps a free MEDIUM tile (form prefills), types a customer ref, hits Enter.
3. Submit locks the form for a beat; the grid tile flips to occupied.
4. **Climax:** the ResultCard lands — locker ID and `A7BX-K9ZM` in oversized monospace, butter-bright on dark. He photographs the screen; that photo *is* the customer's pickup slip. One-tap copy as backup.
5. Form already cleared; he stores #2 (SMALL) before the van door closes.
6. Package #3 is LARGE but the last LARGE just went occupied → calm banner: "No free locker fits a LARGE package right now." He re-routes it; no drama, no lost input.

Failure: INTERNAL_ERROR mid-store → "Something went wrong on our side." + retry; nothing typed is lost; no partial assignment visible on the grid.

### Flow 2 — Meera's pickup (customer at the station, phone in one hand, toddler on hip)

1. Meera scans the QR on the station → `/retrieve` full-screen on her phone. Two inputs and one button; nothing else.
2. She types the locker ID, then the code into the chunked `XXXX-XXXX` cells — auto-uppercase, auto-advance; the confusing keys (`0/O/1/I`) simply can't appear.
3. **Wrinkle:** she fat-fingers a cell → "That code doesn't match this locker." Her input is still there; she fixes one character, taps Retrieve again.
4. **Climax:** "Locker 12 is open. Take your package." — and beneath it the ChargeSummary ledger: 12 days stored, days 1–5 × 10, days 6–10 × 20, days 11–12 × 30, **total 210 units**. She understands exactly what she paid and why, in one glance, in under 30 seconds total.
5. Toddler intact, she takes her package; the locker is already free for the next delivery.

Failure: 12% battery dies mid-entry — she returns, reopens `/retrieve`, and the flow is a fresh 30-second run; no account, no recovery needed.
