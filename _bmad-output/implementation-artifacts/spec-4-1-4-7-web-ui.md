---
title: 'Stories 4.1–4.7: The web UI — chooser, agent console, customer retrieval on @locker/ui'
type: 'feature'
created: '2026-09-13'
status: 'done'
route: 'direct'
review_loop_iteration: 0
baseline_commit: 'c1fd5a9'
context:
  - '_bmad-output/implementation-artifacts/BUILD-HANDOFF.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-smart_package_everest-2026-09-13/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-smart_package_everest-2026-09-13/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Levels 1–3 exist only as a REST API; there is no UI (FR16–FR20, PRD §6).

**Approach:** One batch, implemented directly by the orchestrator, per-story test-first commits. **4.1** React 19 + Vite 8 + Tailwind 4 SPA in `apps/web`, `@locker/ui` becomes the presentation-only shadcn-style library carrying the Everest tokens (dark default + light toggle, DM Serif Display / Inter / `label-caps` / `code`, brand motifs), OpenAPI-generated API types + thin fetch client, route shell `/`, `/agent`, `/retrieve` with focus-on-navigate. **4.2** chooser landing with two whole-card-click RoleCards. **4.3** agent console LockerGrid — cream free tiles, sunken occupied, 10s poll pausing on hidden tab, manual refresh, `aria-live` count summary, skeleton cold load. **4.4** create-locker dialog + empty-station state. **4.5** StorePackageForm → ResultCard climax (oversized `code` type, one-tap copy, focus+announce, form clears for repeat rhythm; free-tile prefill; calm `NO_SUITABLE_LOCKER` banner). **4.6** `/retrieve` phone-first: CodeInput `XXXX-XXXX` (auto-advance, auto-uppercase, paste-tolerant, rejects 0/O/1/I with inline hint), error-preserve, success → "Locker {id} is open." + ChargeSummary ledger verbatim from API. **4.7** hardening: full AD-7 state matrix audit-test, a11y floor checks (contrast ratios computed from the shipped tokens, aria-live/aria-describedby, focus-on-route, ≥44px targets), responsive + reduced-motion CSS, banned-list compliance.

## Boundaries & Constraints

**Always:** DESIGN.md is the visual law (token hexes verbatim: dark bg `#0D0D0B`, card `#141414`, border `#2A2A2A`, fg `#F5F2EC`, muted `#A9A9A1`, faint `#8B8B84` decorative-only; light bg `#F5F2EC`, card `#FBF9F3`, border `#E5DFD2`, fg `#1A1915`; brand layer constant: brand `#F5A100`, on-brand `#1A1508`, butter `#F5EFB8`, cream `#E8D9A8`, cream-edge `#C9B57E`, gold `#E0C9A6` dark-only, glow `#FFD84D` ≤1/surface, ring `#F5A100`); EXPERIENCE.md is the behavior law — exact microcopy strings from its Voice/State tables ("Locker {id} is open. Take your package.", "That code doesn't match this locker.", "No free locker fits a {size} package right now.", "This locker is already empty — the package may have been picked up.", "No locker with that ID at this station.", "Something went wrong on our side."). Dark default, toggle persisted to localStorage, class applied before first paint (inline script, no flash). One primary orange button per view; ink-on-orange only. AD-10 mechanically: API types generated from the API's real OpenAPI document (no-server export via `buildApp` + `app.inject('/docs/json')` → `openapi-typescript` → committed `schema.d.ts`); `apps/web` computes no domain outcomes — every charge/assignment/error renders from API responses verbatim; ChargeSummary never recomputes. Boundary lint extended: `packages/ui/src/**` may not import `@locker/web`, `apps/*`, `fastify`, `@prisma/*`, `@sinclair/typebox`; `apps/web/src/**` may not import `@locker/domain` (web has no domain knowledge). Polling: 10s while visible, pause on `visibilitychange` hidden, failed poll = silent skip + stale "last updated {time}" label, manual refresh always present. Testing: Vitest 5 + @testing-library/react + jsdom in `apps/web`, mocked client at the fetch boundary; fake timers for polling; component tests per story AC (navigation, whole-card target, poll cadence/pause/announcement, dialog open→create→refresh + Esc + error-preserve, prefill/pending-lock/ResultCard focus+copy/error-preserve/repeat, CodeInput mechanics, ChargeSummary-from-response, state-matrix audit). Stack pins honored: React 19.3.0, Vite 8.3.0, Tailwind 4.3.3, TypeScript 7.0.2, pnpm via `npx pnpm@12.4.1`; fonts bundled via @fontsource (no runtime network). Dev wiring: Vite dev proxy maps `/health`, `/lockers`, `/packages`, `/pickups`, `/docs` → `http://localhost:3000`; prod base URL from `VITE_API_BASE_URL` (default same-origin). Per-story test-first commits by Claude.

**Never:** no auth; no client-side charge/allocation computation; no toast spam (inline "Copied" swaps, silent poll skips); no drop shadows in dark theme (tonal depth + hairline borders only); no destructive-red for capacity errors; no modal stacks >1; no celebratory animations; no drag interactions; no serif body text; no proportional fonts for ID/code strings; no per-surface theme mixing; `packages/ui` never fetches or holds business logic; no new API routes or API behavior changes (UI consumes the existing contract only); no dev servers/watchers started by the agent (user runs them).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected |
|----------|--------------|----------|
| Chooser | `/` | Two RoleCards — "Store packages" → `/agent`, "Pick up a package" → `/retrieve`; whole card clicks; hover/focus border → brand |
| Grid cold load | `/agent`, fetch pending | Skeleton tiles matching final layout, never bare spinner |
| Grid live | lockers present | Free = cream lit door (brightest on screen), occupied = sunken card tones, non-interactive; size label always; `aria-live` polite "N free of M" summary |
| Grid poll | 10s passes / tab hidden / poll fails | re-poll silent; pause when hidden; failure = silent skip + stale-labeled "last updated {time}" |
| Empty station | zero lockers | display-sm "This station has no lockers yet." + one primary "Create the first locker" |
| Create locker | dialog submit / Esc / API error | success closes dialog + grid refreshes with new tile; Esc closes; error stays in-dialog, size preserved |
| Store flow | Enter/button submit; pending | in-place button spinner, inputs locked; success → ResultCard + tile flips + form cleared |
| Store prefill | free tile click | form size prefills (convenience); occupied tile does nothing |
| ResultCard | success | locker ID + code oversized `code` type (butter-on-dark / ink-on-light), focus moves there + SR announcement, one-tap copy with inline "Copied", persists until next store |
| `NO_SUITABLE_LOCKER` | store 409 | calm banner above submit "No free locker fits a {size} package right now."; input preserved |
| CodeInput | typing/paste/backspace | auto-advance, auto-uppercase, 8-char paste fills all, backspace navigates back, `0/O/1/I` rejected with gentle inline hint |
| Retrieve errors | 404/404/409/400/500 | EXPERIENCE.md copy verbatim; failing field flagged; **all input preserved**; banner above submit; INTERNAL_ERROR adds retry |
| Retrieve success | 200 | "Locker {id} is open. Take your package." + ChargeSummary ledger (only used tiers, hairline separators, emphasized total, numbers verbatim) + "Retrieve another package" resets to a fresh form |
| Theme | toggle + reload | persists (localStorage), applied pre-paint, dark default |
| Route change | any navigation | focus moves to page title, announced |
| Theme/responsive/reduced-motion | per UX-DR18–20 | AA contrast (audited by test), ≥44px targets, 2px-offset orange focus ring, ≥1024 asymmetric two-column → md stacks → <768 single column, `/retrieve` phone-first; `prefers-reduced-motion` → opacity-only |

## Tasks

- [x] 4.1: scaffold `apps/web` (Vite + React 19 + Tailwind 4 + react-router, jsdom test rig) and grow `@locker/ui` (source-exported, tsc --noEmit build); tokens/theme CSS (dark+light, pre-paint inline script, toggle in header, persisted); BrandBadge + BrandDash + Button(primary) + base primitives (Input, Select, Dialog, Skeleton, Separator, ErrorBanner); OpenAPI export script + typegen + thin fetch client; route shell with title focus; boundary-lint zones (ui bans web/server imports; web bans @locker/domain); component tests: theme persistence, motifs render, routes focus titles
- [x] 4.2: ChooserLanding + RoleCard (whole-card click, hover/focus border → brand); tests: navigation from both cards, whole-card target
- [x] 4.3: useLockers polling hook (10s, pause-on-hidden, silent-fail + stale label, manual refresh) + LockerGrid + LockerCard + skeleton + live-region count; tests with mocked client + fake timers
- [x] 4.4: EmptyState + CreateLockerControl dialog (Esc, error-preserve, refresh-on-success); tests for open→create→refresh, Esc, error path
- [x] 4.5: StorePackageForm (Enter submit, pending lock, free-tile prefill) + ResultCard (focus, announce, one-tap copy, persists) + calm NO_SUITABLE_LOCKER banner; tests for the full rhythm incl. repeat-store and error-preserve
- [x] 4.6: RetrievePackageForm + CodeInput (8 cells, all mechanics) + confirmation + ChargeSummary verbatim + error-preserve for all five codes; tests for CodeInput mechanics, error matrix, ledger-from-response
- [x] 4.7: hardening — state-matrix audit test (every AD-7 code → exact EXPERIENCE.md copy incl. poll-failure + empty station), contrast-ratio test computed from shipped token hexes, focus/aria/live/44px assertions, responsive + reduced-motion CSS, banned-list pass
- [x] Full pipeline green ×3 consecutive; manual smoke instructions handed to the user (postgres + api + web); per-story commits

## Spec Change Log

## Implementation Notes

- Commits (test-first per story): `36bdb3c` 4.1 · `7c82abd` 4.2 · `a98cb70` 4.3 · `d8d00fc` 4.4 · `456d9d0` 4.5 · `6a7e950` 4.6 · story 4.7 is the commit immediately preceding this docs commit. (Process change mid-batch: from 4.4 on the user committed each story themselves from a handed plan.)
- **TypeScript 7 vs openapi-typescript (resolved in-product):** TS 7.0.2 is the native port and ships no JS compiler API; `openapi-typescript` 7.13.0 (peer `^5.x`) needs `ts.factory` and crashed. pnpm 12 ignores the `pnpm.overrides` field in package.json, and a workspace override can't beat a workspace's own devDep for peer resolution — so `apps/web` alone pins `typescript: 5.9.3` (devDep of the typegen step only). domain/api/ui stay on 7.0.2. Recorded trade-off, not silently absorbed.
- **Light-theme focus ring (WCAG 2.4.11):** the deck's brand `#F5A100` ring measures ~1.9:1 against light paper — under the 3:1 focus-indicator floor. Light theme now uses `--ring: #9C6400` (darkened brand hue); dark keeps `#F5A100`. Both are enforced by `design-audit.test.ts`, which computes contrast from the tokens actually in `styles.css` (a token edit that breaks the floor fails CI).
- **Banned-char duplication (deliberate):** `CodeInput` re-declares the 0/O/1/I display rule because `apps/web` may not import `@locker/domain` (AD-2) and the codepage is domain knowledge; the API stays the single source of truth for rejection.
- **React 19.3:** `FormEvent`/`FormEventHandler` are deprecated ("doesn't actually exist") — handlers use `SyntheticEvent<HTMLFormElement>`. `router.navigate` resolves before the render flush, so nav assertions use `findBy*`.
- **Test-rig quirks pinned for the next session:** Radix under jsdom needs `scrollIntoView`/`hasPointerCapture`/`releasePointerCapture` no-ops (test setup); `userEvent.setup()` replaces `navigator.clipboard` with its own stub, so the test stub is installed after setup via `Object.defineProperty`; `user.paste` has no ClipboardEvent plumbing → `fireEvent.paste(el, {clipboardData: {getData}})`; `import.meta.url` isn't file-scheme under jsdom → file reads use `process.cwd()`.
- ESLint parses the React JSX with babel plugins (`@babel/plugin-syntax-typescript` `isTSX` + `@babel/plugin-syntax-jsx` 8.0.1) — the typescript-eslint parser used elsewhere doesn't handle TSX config in this setup.
- Tests: 218 total (domain 37, api 103, web 78 across 11 files). Full `turbo run build test lint` ×3 consecutive green (11 build, 5 test, 5 lint tasks).
- Deferred to `deferred-work.md`: nothing new from this batch.

## Verification

- [x] `npx pnpm@12.4.1 turbo run build test lint` ×3 consecutive — green (now including `apps/web` + real `packages/ui`)
- [ ] Manual smoke (user-run): `locker-postgres` compose DB up → `npx pnpm@12.4.1 --filter @locker/api dev` and `npx pnpm@12.4.1 --filter @locker/web dev`; exercise chooser → create lockers → grid → store → ResultCard → retrieve → ChargeSummary → each calm error, dark/light toggle, phone-width `/retrieve` — instructions handed to the user at batch close; tick after their pass
- [x] `apps/web` type-checks against generated `schema.d.ts` only — zero hand-copied response types (AD-10)
</frozen-after-approval>
