---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - docs/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-smart_package_everest-2026-09-13/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-smart_package_everest-2026-09-13/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-smart_package_everest-2026-09-13/EXPERIENCE.md
---

# Smart Package Locker Management System - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for the Smart Package Locker Management System, decomposing the requirements from the PRD, UX Design contract (DESIGN.md + EXPERIENCE.md), and Architecture spine into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Create lockers of a chosen size (SMALL, MEDIUM, LARGE) at the locker station. (PRD L1)
FR2: View the list of all lockers with their current availability status (id, size, occupied), ordered by id. (PRD L1)
FR3: A delivery agent can store a package by declaring its size; the system finds an available locker that can accommodate it. (PRD L1)
FR4: Allocation always assigns the smallest available locker that fits the package size (size rank SMALL < MEDIUM < LARGE). (PRD L1)
FR5: When no suitable locker is available for the package size, the system returns a clear "cannot be stored" outcome (`NO_SUITABLE_LOCKER`) without side effects. (PRD L1)
FR6: On successful store, the system generates a unique pickup code (8 chars, no 0/O/1/I) bound to that package+locker, and returns it together with the locker identifier. (PRD L1)
FR7: A customer can retrieve a package by providing the locker ID and the pickup code. (PRD L2)
FR8: On a valid retrieval, the package is removed from the locker, storage state ends, and the locker becomes available again for future deliveries. (PRD L2)
FR9: Invalid retrieval scenarios — wrong code, unknown locker, already-empty locker, malformed input — each produce a distinct, proper outcome and never mutate state. (PRD L2)
FR10: When a package is stored, the system records the exact time it was placed in the locker (`storedAt`). (PRD L3)
FR11: Storage charges are tiered by elapsed 24h days (a day = 24 hours from storage; partial day counts as a full day): X units/day for days 1–5, 2X for days 6–10, 3X for day 11+, where X is a fixed configurable value (default 10). (PRD L3)
FR12: On retrieval, the total storage charge is calculated and returned along with the pickup confirmation, including a days-charged breakdown. (PRD L3)
FR13: Multiple simultaneous store requests are supported; a locker is assigned to only one package at a time — two requests must never receive the same locker. (PRD L4)
FR14: When there are more concurrent requests than available lockers, only the available lockers are assigned; remaining requests receive the "no suitable locker" outcome. (PRD L4)
FR15: Locker availability remains correct and up to date under many simultaneous requests. (PRD L4)
FR16: Web UI — delivery agent console: create lockers of a chosen size. (PRD §6)
FR17: Web UI — agent console: view the locker station — every locker, its size, and live availability. (PRD §6)
FR18: Web UI — agent console: store a package (size + optional customer ref) and see the assigned locker and generated pickup code. (PRD §6)
FR19: Web UI — customer view: retrieve a package (locker ID + pickup code) and see confirmation with the storage-charge breakdown (days charged, tier rate, total) or a clear invalid-code / empty-locker error. (PRD §6)
FR20: A reusable component library (`@locker/ui`, shadcn/ui + Tailwind, product-themed) powers the UI and is presentation-only: no API calls, no business logic. (PRD §6)

### NonFunctional Requirements

NFR1: Extensibility — the system is designed for easy future extension (locker sizes, pricing, station concepts extensible; PRD §4, §8).
NFR2: Automated tests cover happy paths and all invalid scenarios, per level (PRD §8).
NFR3: Clean, maintainable domain model — SOLID, clear separation of concerns (PRD §8; hexagonal paradigm per Architecture).
NFR4: Levels 1–3 demonstrable via both the REST API and the web UI; Level 4 concurrency correctness (no double-assignment) demonstrable (PRD §8).
NFR5: Production readiness — runs locally via docker-compose and deploys cleanly (Railway target per Architecture); config from env validated at boot; health endpoint.
NFR6: Process — git repository initialized before build with a meaningful per-story commit history; TDD order visible in commits (test before implementation); evaluation criteria include commit history (HR terms).

### Additional Requirements

- **Monorepo scaffold (starter for Epic 1 Story 1):** pnpm workspaces + Turborepo per Architecture Structural Seed — `apps/api` (Fastify), `apps/web` (React/Vite SPA), `packages/domain` (`@locker/domain`, zero runtime deps), `packages/ui` (`@locker/ui`); turbo pipelines for build/test/lint/dev/db:migrate.
- **AD-1:** One Fastify service; every route declares TypeBox request/response schemas; OpenAPI at `/docs` via @fastify/swagger (+swagger-ui); frozen Level-1 list contract `{"lockers":[{id,size,occupied}]}`.
- **AD-2:** Inward-only dependencies (`adapters → application → domain`), enforced mechanically by ESLint `no-restricted-imports` / dependency-cruiser wired into `turbo lint` — violations fail the build.
- **AD-3:** Store = one Prisma interactive transaction: select smallest-fitting free lockers `ORDER BY size rank, id` `FOR UPDATE SKIP LOCKED` via `$queryRaw`, occupy, create package+code — atomic; P2034 → `INTERNAL_ERROR` with bounded 3× retry; READ COMMITTED only.
- **AD-4:** State transitions (occupancy, STORED→RETRIEVED) live only in application use cases; occupancy mutations are CAS (`UPDATE … WHERE occupiedBy = ?`) or row-locked — never blind boolean writes.
- **AD-5:** `StoragePricingPolicy` is a pure domain policy: integer units (no floats), days = ceil(elapsed/24h), tiers 1–5×X / 6–10×2X / 11+×3X, X = `STORAGE_FEE_BASE` env (default 10).
- **AD-6:** Pickup codes: 8 chars, uppercase alnum minus 0/O/1/I, unique among unretrieved packages, generated only on store, never regenerated; retrieval resolves in one query; wrong attempts burn nothing.
- **AD-7:** One error envelope `{"error":{"code","message"}}` with stable codes: `NO_SUITABLE_LOCKER`(409), `INVALID_PICKUP_CODE`(404), `LOCKER_NOT_FOUND`(404), `LOCKER_EMPTY`(409), `VALIDATION_ERROR`(400), `INTERNAL_ERROR`(500) — codes never renamed.
- **AD-8:** PostgreSQL is the only durable state (Prisma); one-package-per-locker enforced by partial unique index in the schema; schema moves only via `prisma migrate` (deployed via `migrate deploy` in the container entrypoint); no module-level mutable stores.
- **AD-9:** A locker has exactly one identifier — its cuid — carried as `lockerId` in every payload; no secondary display code in v1.
- **AD-10:** `apps/web` computes no domain outcomes (every charge/assignment displayed comes from an API response); API types generated from OpenAPI, never hand-copied; `@locker/ui` imports no API client.
- **Stack pins:** TypeScript 7.0.2, Node 24 LTS (`node:24-alpine`), Fastify 5.12.4, TypeBox 1.3.30 (+type-provider 6.1.0), @fastify/swagger 9.8.1, swagger-ui 6.1.1, Prisma 7.10.0 (do not take 8.x RC), PostgreSQL 18 (`postgres:18-alpine`), Vitest 5.0.0, Turborepo 2.10.12, pnpm 12.4.1, React 19.3.0, Vite 8.3.0, Tailwind CSS 4.3.3, shadcn CLI 4.21.0.
- **Infra/deploy:** docker-compose for local dev/test (postgres + api); `apps/api` multi-stage Dockerfile via `turbo prune` → Render (Postgres provisioned there, `DATABASE_URL` injected); `apps/web` nginx static → Render; `GET /health`.
- **Conventions:** kebab-case files, PascalCase types, singular PascalCase Prisma models, snake_case columns; cuid IDs; enums SMALL/MEDIUM/LARGE, STORED/RETRIEVED; ISO-8601 UTC timestamps; money as integer units; JSON request logging (Fastify built-in); no auth in v1.
- **Test infrastructure:** Vitest suites against the compose Postgres, isolated per suite (truncate vs transaction-rollback strategy owned by the build stories).
- **README deliverable (HR terms):** README covering approach, design decisions, assumptions, trade-offs, and future improvements, plus an AI-use disclosure section (tools used, how used, which portions AI-assisted, prompts/workflow).

### UX Design Requirements

UX-DR1: Implement `@locker/ui` theme tokens per DESIGN.md — dark default (bg #0D0D0B, card #141414, border #2A2A2A, fg #F5F2EC, muted #A9A9A1 AA-safe on card, faint #8B8B84 decorative-only) + light toggle theme (bg #F5F2EC, card #FBF9F3, border #E5DFD2, fg #1A1915); brand layer constant across themes (brand #F5A100, on-brand ink #1A1508, butter #F5EFB8, cream #E8D9A8 + edge #C9B57E, gold #E0C9A6 dark-only, glow #FFD84D ≤1 per surface, ring #F5A100); mapped onto shadcn token names.
UX-DR2: Typography system — DM Serif Display for `display` 40px / `display-sm` 24px, ALL-CAPS, at most one per surface; Inter for body/labels via shadcn ramp; `label-caps` eyebrows 12px/500/0.2em tracking; `code` monospace 28px/0.15em tracking exclusively for locker IDs and pickup codes.
UX-DR3: Theme toggle in the header, persisted to localStorage, applied before first paint (no flash); dark is default; themes never mix per-surface.
UX-DR4: Shape/spacing system — rounded sm 4px (inputs, badge), md 6px (buttons), lg 8px (cards/dialogs/locker tiles), full only for dash motif and status pills; gutter 24px, mobile margin 20px, desktop 64px, section gap 64px; content ≤ ~1100px; asymmetric editorial layout with the locker grid as hero.
UX-DR5: Brand motifs — "E." orange square badge + wordmark lockup; 4×40px rounded brand-dash under titles; matte tonal depth (no drop shadows in dark, hairline borders, hover = border brighten toward brand, never a lift); one primary (orange, ink-text) button per view; ink-on-orange only (white-on-orange reserved for the logo mark).
UX-DR6: Chooser landing `/` with two RoleCards (agent → `/agent`, customer → `/retrieve`) — whole card is the click target, hover border → brand, never a nested button; dialogs stack at most one level; no auth anywhere.
UX-DR7: LockerGrid (`/agent`) — tiles show size + occupied state; free = cream "lit door" (brightest object on screen), occupied = sunken card tones, not interactive; grid updates immediately after a local store success; updates announced via `aria-live="polite"` with a count summary ("14 free of 18"), not per-tile chatter.
UX-DR8: LockerGrid auto-refresh — polls every 10s while visible, pauses when the tab is hidden; manual refresh affordance always present; poll failure = silent skip with stale-labeled "last updated {time}", no toast spam.
UX-DR9: LockerCard prefill — clicking a free tile prefills the store form's size (convenience, never required); occupied tiles are not interactive.
UX-DR10: StorePackageForm — size select (SMALL/MEDIUM/LARGE) + optional customerRef; Enter submits; pending = in-place button spinner + inputs locked; success yields ResultCard and clears for the next package (agent repeat rhythm).
UX-DR11: ResultCard — locker ID + pickup code in `code` typography, oversized, butter-on-dark / ink-on-light; one-tap copy for each with inline "Copied" swap (no toast); focus moves to the card on render with screen-reader announcement; persists until next store or navigation.
UX-DR12: CreateLockerControl — size picker + submit inside a dialog; station grid refreshes on success; Esc closes the dialog.
UX-DR13: RetrievePackageForm — locker ID input + CodeInput; Enter submits; on error all input is preserved and the failing field is flagged; on success, confirmation + ChargeSummary replaces the form; option to retrieve another.
UX-DR14: CodeInput — 8 chunked monospace cells `XXXX-XXXX`; auto-advance, auto-uppercase, paste-tolerant (an 8-char paste fills all cells); alphabet rejects 0/O/1/I with a gentle inline hint; backspace navigates to the previous cell.
UX-DR15: ChargeSummary — ledger rows only for tiers actually used (days 1–5 × X, days 6–10 × 2X, day 11+ × 3X) with hairline separators and an emphasized total; numbers render verbatim from the API response — never recomputed client-side (AD-10).
UX-DR16: Empty state (`/agent` with no lockers) — `display-sm` headline "This station has no lockers yet." + single primary action "Create the first locker".
UX-DR17: Error states map 1:1 to AD-7 codes with calm, blame-free, physical-world microcopy (exact strings from EXPERIENCE.md Voice table, e.g. "That code doesn't match this locker."); errors never clear user input; ErrorBanner appears above the submit button; capacity errors are calm facts (never destructive-red); `INTERNAL_ERROR` → "Something went wrong on our side." + retry.
UX-DR18: Accessibility floor — WCAG 2.2 AA on all surfaces; touch targets ≥ 44×44px; form errors `aria-live="polite"` linked via `aria-describedby`; visible 2px-offset brand-orange focus ring everywhere; route changes move focus to the page title and announce it; `prefers-reduced-motion` reduces transitions to opacity-only or none.
UX-DR19: Responsive — ≥1024px: agent console asymmetric two-column (grid hero wider + store panel), chooser cards side by side; 768–1023px: console stacks; <768px: all surfaces single-column, `/retrieve` designed phone-first (form is the whole screen, thumb-scale code cells).
UX-DR20: Interaction primitives — Enter submits the focused form; Esc closes dialogs; Tab order follows reading order; copy affordances confirm inline. Banned: hover-only affordances on touch, modal stacks > 1, destructive-red capacity errors, celebratory animations, drag interactions.

### FR Coverage Map

FR1: Epic 1 - Create lockers of chosen size (SMALL/MEDIUM/LARGE)
FR2: Epic 1 - List lockers with live availability (frozen contract)
FR3: Epic 1 - Store a package by size, find a fitting locker
FR4: Epic 1 - Smallest-fitting-locker allocation (size rank order)
FR5: Epic 1 - NO_SUITABLE_LOCKER outcome when nothing fits
FR6: Epic 1 - Unique pickup code + locker ID on store success
FR7: Epic 2 - Retrieve by locker ID + pickup code
FR8: Epic 2 - Valid retrieval frees the locker (atomic)
FR9: Epic 2 - Distinct proper outcomes for all invalid scenarios
FR10: Epic 1 - Record storedAt at store time (consumed by Epic 2 pricing)
FR11: Epic 2 - Tiered 24h-day pricing X/2X/3X (ceil days)
FR12: Epic 2 - Total charge + days breakdown with confirmation
FR13: Epic 3 - Concurrent stores never double-assign a locker
FR14: Epic 3 - Oversubscription degrades gracefully per request
FR15: Epic 3 - Availability stays correct under many parallel requests
FR16: Epic 4 - Web UI: create lockers (dialog control)
FR17: Epic 4 - Web UI: station grid with live availability
FR18: Epic 4 - Web UI: store package, see locker + pickup code
FR19: Epic 4 - Web UI: retrieve package with charge breakdown
FR20: Epic 4 - @locker/ui presentation-only component library

NFR mapping: NFR1-NFR4 are per-story acceptance criteria across Epics 1-4 (extensibility, tests, clean domain, demonstrability); NFR5-NFR6 land in Epic 5 (deploy, README/AI disclosure, git discipline — git init + per-story commits begin in Epic 1 Story 1.1).
UX-DR mapping: UX-DR1-UX-DR20 all land in Epic 4 as story-scoped acceptance criteria.

## Epic List

### Epic 1: Locker station & package storage (PRD Level 1)
Delivery agents can create lockers of any size, see live availability, and store packages — always in the smallest fitting locker, receiving a pickup code. Story 1.1 scaffolds the monorepo (pnpm/Turborepo, Fastify + TypeBox, Prisma + Postgres via docker-compose, boundary lint gates) and initializes the git repo.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6
**Standalone:** complete Level-1 system; no dependency on future epics.

### Epic 2: Package retrieval & storage charges (PRD Levels 2+3)
Customers can retrieve packages with locker ID + pickup code, see the tiered storage charge itemized on the confirmation, and get calm, distinct outcomes for every invalid scenario (wrong code, unknown locker, already-empty, malformed input). Levels 2 and 3 share the retrieval code paths, so they ship as one epic with ordered stories.
**FRs covered:** FR7, FR8, FR9, FR10, FR11, FR12
**Builds on:** Epic 1 (stored packages). Standalone once E1 exists.

### Epic 3: Concurrent storage correctness (PRD Level 4)
Multiple delivery agents storing simultaneously never receive the same locker; when there are more requests than free lockers, only available lockers are assigned and the rest get a clean NO_SUITABLE_LOCKER. The locking mechanism (FOR UPDATE SKIP LOCKED transaction) is built in Epic 1; this epic delivers the concurrency proof — parallel integration suites, contention and oversubscription tests, availability invariants under load.
**FRs covered:** FR13, FR14, FR15
**Builds on:** Epic 1. Standalone.

### Epic 4: The web UI — two role screens on @locker/ui (PRD §6)
Anyone can open the app and pick a role at the chooser landing. Delivery agents get the console: live locker station grid, store-a-package flow with ResultCard, create-locker dialog. Customers get a phone-first retrieval view with chunked code input and a charge ledger. All of it in the Everest dark-first editorial theme (DESIGN.md) with the behaviors of EXPERIENCE.md, powered by the presentation-only @locker/ui library. One epic (not agent/customer split) because all stories share the packages/ui foundation, API client, and routing.
**FRs covered:** FR16, FR17, FR18, FR19, FR20 (UX-DR1–UX-DR20 as story ACs)
**Builds on:** Epics 1–2. Standalone.

### Epic 5: Run anywhere & submission readiness
An evaluator (or HR) can clone the repo, run the full stack locally via docker-compose, see it deployed on Render, and read a README covering approach, design decisions, assumptions, trade-offs, and future improvements — including the required AI-use disclosure (tools, how used, AI-assisted portions, workflow).
**NFRs covered:** NFR5, NFR6 (+ README deliverable from Additional Requirements)
**Builds on:** Epics 1–4. Standalone.

## Epic 1: Locker station & package storage (PRD Level 1)

Delivery agents can create lockers of any size, see live availability, and store packages — always in the smallest fitting locker, receiving a pickup code. Story 1.1 scaffolds the monorepo and initializes the git repo.

### Story 1.1: Monorepo scaffold with a running, health-checked API

As a developer,
I want the pnpm/Turborepo workspace scaffold with a bootable Fastify service and local Postgres,
So that every feature story lands in a structure that already builds, tests, lints, and runs.

**Requirements:** starter template + stack pins + AD-2, AD-8 wiring (Additional Requirements); NFR2, NFR6 start

**Acceptance Criteria:**

**Given** a fresh clone with Docker running
**When** `docker compose up` and `pnpm install` are executed
**Then** the API boots, `GET /health` returns `200 {"status":"ok"}`, and Postgres 18 is reachable from the service
**And** `pnpm turbo run build test lint` passes across `apps/api`, `packages/domain`, `packages/ui` (domain/ui as placeholders)

**Given** a source file in `packages/domain` (or `src/application/`) that imports `fastify`, `@prisma/*`, or `@sinclair/typebox`
**When** `turbo lint` runs
**Then** the build fails on the boundary violation (AD-2 enforcement wired, proven by a violating fixture test)
**And** the Prisma client + `db:migrate` pipeline are wired with an empty-but-versioned schema

**Given** a boot attempt with a missing or malformed env var (`DATABASE_URL`, `PORT`, `STORAGE_FEE_BASE`)
**When** the service starts
**Then** it fails fast with one clear config error naming the variable; no partial boot

**Given** the working tree at the end of this story
**When** development begins on Story 1.2
**Then** the git repository exists with this scaffold committed as its first commits (NFR6 begins: per-story, TDD-ordered commits from here on)

### Story 1.2: Create lockers of a chosen size

As a delivery agent,
I want to add lockers of a chosen size to the station,
So that the station can securely hold packages of different dimensions.

**Requirements:** FR1 · AD-1, AD-7, AD-9

**Acceptance Criteria:**

**Given** a valid size
**When** `POST /lockers` with `{"size":"MEDIUM"}`
**Then** the response is `201` with `{"lockerId": <cuid>, "size": "MEDIUM", "occupied": false}` — the field is named `lockerId` and it is the locker's only identifier (AD-9)

**Given** a size outside the enum (`"HUGE"`, lowercase `"small"`, missing)
**When** `POST /lockers`
**Then** the response is `400` with the AD-7 envelope `{"error":{"code":"VALIDATION_ERROR","message":...}}` and no locker is created

**Given** a fresh database
**When** the Locker migration is applied via `prisma migrate`
**Then** it applies cleanly and the request/response schemas appear in the OpenAPI docs at `/docs`
**And** the `CreateLocker` use case is covered by unit tests (invalid size) and the route by an integration test (status, body shape, cuid format)

### Story 1.3: View the locker station with live availability

As a delivery agent,
I want to see every locker at the station with its size and availability,
So that I know what's free before handling a package.

**Requirements:** FR2 · AD-1 (frozen list contract)

**Acceptance Criteria:**

**Given** lockers of mixed sizes and occupancy
**When** `GET /lockers`
**Then** the response is `200 {"lockers":[{"id","size","occupied"}, ...]}` — exactly these three fields, ordered by `id` (AD-1 frozen contract; `occupied` is the only availability field)

**Given** a station with no lockers yet
**When** `GET /lockers`
**Then** the response is `200 {"lockers":[]}` — an empty list, never a 404

**And** the `ListLockers` use case is covered by integration tests asserting the exact frozen response shape, and the schema is registered in the OpenAPI docs

### Story 1.4: Store a package in the smallest fitting locker with a pickup code

As a delivery agent,
I want the system to assign my package to the smallest locker that fits it and hand me a pickup code,
So that locker capacity is used efficiently and the customer can retrieve the package later.

**Requirements:** FR3, FR4, FR6, FR10 · AD-3, AD-6

**Acceptance Criteria:**

**Given** one free SMALL and one free MEDIUM locker
**When** `POST /packages` with `{"size":"SMALL","customerRef":"Meera R."}` (customerRef optional)
**Then** the package is stored in the SMALL locker and the response is `201 {"lockerId": <the SMALL locker>, "pickupCode": <code>}`

**Given** a free SMALL, a free MEDIUM, and a MEDIUM package
**When** it is stored
**Then** the MEDIUM locker is chosen — allocation is by size rank SMALL(1) < MEDIUM(2) < LARGE(3), ties broken by lowest `id` (AD-3 ordering)

**Given** only a LARGE locker is free
**When** a SMALL package is stored
**Then** it takes the LARGE locker — smallest *that fits*, never blocking on exact match

**Given** the generated pickup code
**Then** it is 8 characters, uppercase alphanumeric excluding `0/O/1/I`, unique among unretrieved packages, and bound to exactly this package and locker (AD-6)
**And** the package row records `storedAt` (the exact store time, FR10) and the locker's occupancy flips to occupied — both in one Prisma transaction (`FOR UPDATE SKIP LOCKED` via `$queryRaw`, AD-3)

**And** the allocation rule and pickup-code generator live in `@locker/domain` as pure functions with unit tests; the route is covered by integration tests

### Story 1.5: Gracefully refuse storage when no suitable locker exists

As a delivery agent,
I want a clear, side-effect-free refusal when no locker can hold my package,
So that I can re-route it immediately and trust the station's state is unchanged.

**Requirements:** FR5 · AD-7

**Acceptance Criteria:**

**Given** every locker that could fit a SMALL package is occupied
**When** `POST /packages` with `{"size":"SMALL"}`
**Then** the response is `409 {"error":{"code":"NO_SUITABLE_LOCKER","message":...}}` (AD-7 envelope)

**Given** the refused request above
**When** the lockers list is fetched afterwards
**Then** no package row was created and no locker state changed — the refusal is fully side-effect-free

**Given** all SMALL lockers are occupied but a MEDIUM locker is free
**When** a SMALL package is stored
**Then** it succeeds in the MEDIUM locker — exhaustion is per-fitting-size, not global

**And** the domain allocation's "no locker fits" outcome and the route's 409 mapping are both covered by tests

## Epic 2: Package retrieval & storage charges (PRD Levels 2+3)

Customers can retrieve packages with locker ID + pickup code, see the tiered storage charge itemized on the confirmation, and get calm, distinct outcomes for every invalid scenario.

### Story 2.1: Retrieve a package with locker ID and pickup code

As a customer,
I want to present the locker ID and my pickup code and have the package released to me,
So that I can collect my package at my convenience without meeting the delivery agent.

**Requirements:** FR7, FR8 · AD-4, AD-6

**Acceptance Criteria:**

**Given** a locker holding a stored package
**When** `POST /pickups` with `{"lockerId": <id>, "pickupCode": <matching code>}`
**Then** the response is `200 {"lockerId": <id>, "retrievedAt": <ISO-8601 UTC>}` and the package's status is `RETRIEVED` with `retrievedAt` set

**Given** the successful retrieval above
**When** the lockers list is fetched
**Then** that locker shows `occupied: false` — package removal and locker release happen atomically in one transaction (AD-4), never leaving a freed locker with a live package or vice versa

**Given** the retrieval lookup
**When** it resolves the package
**Then** it does so in exactly one query on `pickupCode = ? AND lockerId = ? AND status = 'STORED'` (AD-6); the use case is unit-tested with a mocked repository and the route is integration-tested end to end

### Story 2.2: Distinct, side-effect-free outcomes for every invalid retrieval

As a customer,
I want each mistake (wrong code, wrong locker, empty locker, malformed input) to produce a clear, distinct outcome that never wipes my input or burns my code,
So that I can immediately understand what went wrong and try again.

**Requirements:** FR9 · AD-7

**Acceptance Criteria:**

**Given** a locker holding a stored package
**When** `POST /pickups` with a wrong pickup code for that locker
**Then** the response is `404 {"error":{"code":"INVALID_PICKUP_CODE",...}}`, zero state changed, and the code is not burned — an immediate retry with the correct code succeeds

**Given** a locker ID that does not exist
**When** `POST /pickups`
**Then** the response is `404 {"error":{"code":"LOCKER_NOT_FOUND",...}}`

**Given** a locker whose package was already retrieved
**When** `POST /pickups` with the (previously valid) code
**Then** the response is `409 {"error":{"code":"LOCKER_EMPTY",...}}` — the locker exists but holds nothing

**Given** a malformed body (missing fields, pickup code not 8 chars, wrong types)
**When** `POST /pickups`
**Then** the response is `400 {"error":{"code":"VALIDATION_ERROR",...}}` via the TypeBox schema
**And** each of the four outcomes is a separate integration test; no invalid path mutates locker or package state

### Story 2.3: Tiered storage charge returned with the retrieval confirmation

As a customer,
I want the total storage charge with a per-tier breakdown when I retrieve my package,
So that I understand exactly what I'm paying and why, in one glance.

**Requirements:** FR11, FR12 · AD-5

**Acceptance Criteria:**

**Given** `StoragePricingPolicy` in `@locker/domain` (pure, integer units, AD-5)
**When** `charge(storedAt, retrievedAt)` is called
**Then** days charged = `ceil(elapsed / 24h)`; days 1–5 cost X/day, days 6–10 cost 2X/day, day 11+ costs 3X/day, X = `STORAGE_FEE_BASE` (default 10) — verified by table-driven unit tests covering: <24h→1 day; exactly 24h→1 day; 24h+1min→2 days; 5 days→5×X; 6 days→5×X+1×2X; 12 days→5×X+5×2X+2×3X = 210 at X=10; a non-default X

**Given** a valid retrieval via `POST /pickups`
**When** the response is built
**Then** it carries `storageCharge` (total), `daysCharged`, and a `breakdown` array listing only the tiers actually used (`{"tier", "days", "rate", "amount"}` per tier), computed from the recorded `storedAt`

**Given** the pricing policy
**When** any rounding question arises
**Then** results are integer units only — no floats anywhere in the charge path (AD-5)
**And** an integration test retrieves a package stored with a backdated `storedAt` and asserts the exact charge + breakdown in the response; the response schema is published in the OpenAPI docs

## Epic 3: Concurrent storage correctness (PRD Level 4)

Multiple delivery agents storing simultaneously never receive the same locker; oversubscribed requests degrade gracefully. The locking mechanism shipped in Story 1.4 (AD-3) — this epic delivers the reproducible proof.

### Story 3.1: Parallel store requests never double-assign a locker

As a delivery agent,
I want my store request to be safe even when other agents submit at the same instant,
So that two customers are never handed the same locker and the same door.

**Requirements:** FR13, FR14, FR15 · AD-3

**Acceptance Criteria:**

**Given** a station with M free fitting lockers
**When** N ≥ M store requests for that size are submitted truly concurrently (`Promise.all` against the live API; no artificial serialization)
**Then** every successful response carries a **distinct** `lockerId` — no locker appears in two responses, verified by asserting the response set has no duplicates

**Given** N concurrent requests and M < N free fitting lockers
**When** all N complete
**Then** exactly M succeed with `201` and N−M fail with `409 NO_SUITABLE_LOCKER` — no fifth outcome, no hangs, no timeouts

**Given** the storm above
**When** `GET /lockers` is fetched after all requests settle
**Then** the count of `occupied: true` lockers equals the number of successful stores exactly — availability never over- or under-reports (FR15 invariant)
**And** the parallel test harness runs against the compose Postgres with per-suite isolation and is deterministic (seeded, no sleep-based timing)

### Story 3.2: Availability stays correct under sustained mixed concurrency

As a station operator,
I want the station's availability to remain truthful under sustained simultaneous storing and retrieving,
So that capacity planning and customer pickups can be trusted all day, not just in single bursts.

**Requirements:** FR15 · AD-3 (retry), AD-8

**Acceptance Criteria:**

**Given** multiple rounds of concurrent mixed operations (stores and retrievals interleaved)
**When** each round settles
**Then** the invariants hold after every round: occupied lockers == packages in `STORED` status (no orphans either direction), no locker holds two packages, every freed locker is immediately re-assignable

**Given** a Prisma write conflict (P2034) raised during a store transaction
**When** the repository handles it
**Then** it retries up to the bounded 3 attempts (AD-3) and only surfaces `INTERNAL_ERROR` if all retries are exhausted — unit-tested with a conflict-injecting repository mock, including the succeeding-on-retry-2 case

**Given** the concurrency suites from both stories
**When** `turbo test` (or the dedicated `test:concurrency` target) runs
**Then** the full Level-4 proof — parallel no-double-assignment, oversubscription, mixed-op invariants — is reproducible with one command and passes repeatedly (run 3× consecutively without flakes)

## Epic 4: The web UI — two role screens on @locker/ui (PRD §6)

Anyone can open the app and pick a role; agents get the console, customers get phone-first retrieval — all in the Everest dark-first editorial theme, powered by the presentation-only `@locker/ui` library.

### Story 4.1: UI foundation — @locker/ui tokens, theme system, and app shell

As a developer,
I want the React SPA scaffold with the themed `@locker/ui` library and the OpenAPI-generated API client,
So that every screen story composes verified tokens and typed API access instead of hand-rolling them.

**Requirements:** FR20 · AD-10 · UX-DR1, UX-DR2, UX-DR3, UX-DR4, UX-DR5

**Acceptance Criteria:**

**Given** the scaffolded `apps/web` (React 19 + Vite + Tailwind 4) and `packages/ui`
**When** the app renders
**Then** DESIGN.md tokens are mapped onto shadcn theme variables — dark default (bg #0D0D0B, card #141414, border #2A2A2A, fg #F5F2EC, muted #A9A9A1, faint #8B8B84 decorative-only) + light toggle theme, brand layer constant (UX-DR1); DM Serif Display display/display-sm and Inter body with `label-caps` and `code` styles (UX-DR2); rounded sm4/md6/lg8/full and the brand motifs ("E." badge, 4×40 brand-dash) render (UX-DR4, UX-DR5)

**Given** the theme toggle in the header
**When** it is clicked and the page reloaded
**Then** the choice persists (localStorage) and applies before first paint — no white flash — and themes never mix per-surface (UX-DR3)

**Given** the API client pipeline
**When** types are generated from the API's OpenAPI schema
**Then** `apps/web` imports generated types only — no hand-copied response shapes (AD-10) — and `packages/ui` contains no fetch/client code, enforced by the same boundary lint as the API (FR20)

**Given** the route shell
**When** `/`, `/agent`, `/retrieve` are opened
**Then** each renders its placeholder with the page title focused and announced (UX-DR18 partial)

### Story 4.2: Chooser landing — the two role doors

As a visitor opening the app,
I want two clear doors (delivery agent / customer),
So that I land in the right workflow in one tap without logging in.

**Requirements:** UX-DR6

**Acceptance Criteria:**

**Given** the chooser landing at `/`
**When** it renders
**Then** exactly two RoleCards show — "Store packages" (→ `/agent`) and "Pick up a package" (→ `/retrieve`) — eyebrow + display-sm serif title + one body line each (UX-DR6)

**Given** a RoleCard
**When** it is hovered or focused
**Then** the border brightens toward brand orange and the **whole card** is the click target (no nested button); clicking navigates on release

**Given** either role route
**When** navigation completes
**Then** focus moves to the page title and it is announced; there is no auth gate anywhere
**And** component tests cover navigation from both cards and the whole-card click target

### Story 4.3: Agent console — station grid with live availability

As a delivery agent,
I want to see every locker with its size and live availability at a glance,
So that I know what's free before walking packages in from the van.

**Requirements:** FR17 · AD-10 · UX-DR7, UX-DR8

**Acceptance Criteria:**

**Given** the agent console at `/agent` with lockers present
**When** the grid renders
**Then** every tile shows its size label and state — free lockers are cream "lit doors" (the brightest objects on screen), occupied lockers sink to card/border tones and are not interactive (UX-DR7); cold load shows skeleton tiles matching the final layout, never a bare spinner

**Given** the console is open and visible
**When** 10 seconds pass
**Then** the grid re-polls silently; polling pauses when the tab is hidden; a manual refresh affordance is always present; a failed poll is a silent skip with the "last updated" label going stale-labeled — no toast spam (UX-DR8)

**Given** grid updates
**When** they land
**Then** they are announced via one polite live region with a count summary ("14 free of 18"), not per-tile chatter (UX-DR7)

**Given** the API client
**When** the grid fetches
**Then** availability comes from `GET /lockers` responses verbatim — the SPA computes nothing (AD-10)
**And** polling hook + grid are covered by component tests with a mocked client (10s cadence, pause-on-hidden, count announcement)

### Story 4.4: Create-locker control and the empty-station state

As a delivery agent,
I want to add lockers of a chosen size from the console and see a friendly empty state before any exist,
So that I can set up (or grow) the station without leaving the screen.

**Requirements:** FR16 · UX-DR12, UX-DR16 (UX-DR17 partial)

**Acceptance Criteria:**

**Given** the console with zero lockers
**When** it renders
**Then** the empty state shows the display-sm headline "This station has no lockers yet." with the single primary action "Create the first locker" (UX-DR16)

**Given** the empty-state CTA (or the console's create control)
**When** it is activated
**Then** a dialog opens with a size picker (SMALL/MEDIUM/LARGE) + submit; Esc closes it; dialogs never stack more than one level (UX-DR12)

**Given** a submitted size
**When** `POST /lockers` succeeds
**Then** the dialog closes and the grid refreshes immediately showing the new free tile; a `VALIDATION_ERROR` or `INTERNAL_ERROR` shows in the calm AD-7 mapping without closing the dialog or losing the picked size (UX-DR17 partial)

**And** the dialog flow (open → create → refresh; Esc; error-preserve) is component-tested against a mocked client

### Story 4.5: Store-package flow with the ResultCard climax

As a delivery agent,
I want to store a package by size and immediately see the assigned locker and pickup code,
So that I can photograph the code and move to the next stop in seconds.

**Requirements:** FR18 · UX-DR9, UX-DR10, UX-DR11 (UX-DR17 partial)

**Acceptance Criteria:**

**Given** the store form (size select + optional customerRef)
**When** Enter is pressed or the primary button clicked
**Then** the request submits; pending state shows an in-place button spinner with inputs locked (UX-DR10)

**Given** a free tile in the grid
**When** it is clicked
**Then** the store form's size prefills with that tile's size — a convenience, never required; occupied tiles do nothing (UX-DR9)

**Given** a successful store
**When** the ResultCard renders
**Then** it shows locker ID + pickup code in oversized `code` typography (butter-on-dark / ink-on-light), focus moves to it with a screen-reader announcement, one-tap copy on each value with an inline "Copied" swap (no toast), and the form is already cleared for the next package (UX-DR11); the grid tile flips to occupied immediately (UX-DR7)

**Given** `NO_SUITABLE_LOCKER`, `VALIDATION_ERROR`, or `INTERNAL_ERROR` from the store endpoint
**When** the response arrives
**Then** the calm copy from EXPERIENCE.md renders above the submit button — "No free locker fits a LARGE package right now." etc. — never destructive-red, never clearing what was typed (UX-DR17 partial)
**And** the flow (prefill, pending lock, ResultCard focus/copy, error-preserve, repeat-store rhythm) is component-tested with a mocked client

### Story 4.6: Customer retrieval — code input, charge ledger, calm errors

As a customer at the station (Meera, phone in one hand),
I want to enter my locker ID and pickup code and see exactly what I'm charged,
So that I can take my package in under 30 seconds, sure the price is fair.

**Requirements:** FR19 · AD-10 · UX-DR13, UX-DR14, UX-DR15 (UX-DR17 partial)

**Acceptance Criteria:**

**Given** `/retrieve` on a phone
**When** it renders
**Then** the form is the whole screen: locker ID input + the 8-cell chunked `XXXX-XXXX` CodeInput + one primary button; nothing else competes (UX-DR13, UX-DR19 phone-first)

**Given** the CodeInput
**When** characters are typed or pasted
**Then** cells auto-advance, auto-uppercase, an 8-char paste fills all cells, backspace navigates back, and `0/O/1/I` are rejected with a gentle inline hint (UX-DR14)

**Given** an error response (`INVALID_PICKUP_CODE`, `LOCKER_NOT_FOUND`, `LOCKER_EMPTY`, `VALIDATION_ERROR`, `INTERNAL_ERROR`)
**When** it renders
**Then** the blame-free copy from EXPERIENCE.md shows with the failing field flagged, and **all input is preserved** — Meera fixes one character and retries (UX-DR17 partial)

**Given** a successful retrieval
**When** the confirmation renders
**Then** "Locker {id} is open. Take your package." + the ChargeSummary ledger appear, replacing the form: only tiers actually used as rows (days × rate), hairline separators, emphasized total — every number verbatim from the API response, never recomputed (UX-DR15, AD-10) — with an option to retrieve another
**And** CodeInput mechanics, error-preserve, and ChargeSummary-from-response are component-tested with a mocked client

### Story 4.7: Hardening pass — full state matrix, accessibility, responsiveness

As any user (agent on a laptop, customer one-handed on a phone),
I want every surface correct in every state, screen size, and input modality,
So that the UI never traps me, lies to me, or becomes unreadable.

**Requirements:** UX-DR17 (complete), UX-DR18, UX-DR19, UX-DR20 · NFR3 (a11y floor)

**Acceptance Criteria:**

**Given** the complete AD-7 state matrix across both forms and the grid
**When** each state is exercised
**Then** every code maps to its EXPERIENCE.md copy — audited as a test/table including poll failure and the empty station; no raw error text ever reaches the screen (UX-DR17 complete)

**Given** WCAG 2.2 AA
**When** the surfaces are audited
**Then** contrast passes (muted ≥4.5:1 on card), touch targets ≥44×44px, form errors are politely live-announced and `aria-describedby`-linked, the 2px-offset brand-orange focus ring is visible everywhere, and route changes move focus to the page title (UX-DR18)

**Given** the responsive breakpoints
**When** viewed at ≥1024px, 768–1023px, and <768px
**Then** the console is a two-column asymmetric composition (grid hero wider) → stacks → single-column; the chooser cards sit side by side → stacked; `/retrieve` stays phone-first (UX-DR19)

**Given** `prefers-reduced-motion`
**When** transitions would animate
**Then** they reduce to opacity-only or none; and the banned list is respected nowhere: hover-only affordances on touch, modal stacks >1, destructive-red capacity errors, celebrations, drag interactions (UX-DR20)
**And** the pass lands as an audited checklist in the PR + failing-case tests where automatable (contrast, targets, announcements)

## Epic 5: Run anywhere & submission readiness

An evaluator (or HR) can clone the repo, run the full stack locally, see it deployed, and read a README — with the required AI-use disclosure.

### Story 5.1: Production containers and Render deployment

As an evaluator,
I want the system deployed and reachable, and reproducible as containers,
So that I can verify it works in a production-like environment, not just on the author's machine.

**Requirements:** NFR5 · AD-8 (migrate-on-boot), infra requirements (Dockerfiles, Railway, compose)

**Acceptance Criteria:**

**Given** `apps/api`
**When** its Docker image is built (multi-stage via `turbo prune`, `node:24-alpine` base)
**Then** the image builds reproducibly and, on boot against a fresh database, runs `prisma migrate deploy` in its entrypoint **before** serving — the app never boots against an unmigrated schema (AD-8)

**Given** `apps/web`
**When** its Docker image is built (static build served by nginx)
**Then** it builds reproducibly and serves the SPA with client-side routing intact (deep links like `/retrieve` return the app, not 404)

**Given** Render with a provisioned PostgreSQL
**When** both services are deployed (`DATABASE_URL` injected, `STORAGE_FEE_BASE` configurable)
**Then** `GET /health` on the live API URL returns ok, the web app loads, and a store→retrieve round trip succeeds against the deployed stack; the live URLs are recorded in the README

**Given** the local evaluator path
**When** someone runs `docker compose up` on a fresh clone
**Then** the full stack (Postgres + API + web) comes up runnable end to end — verified from a clean checkout, not the dev's working tree

### Story 5.2: README with approach, decisions, and AI-use disclosure

As an HR reviewer,
I want a README that explains the approach, decisions, assumptions, and trade-offs — plus exactly how AI was used,
So that I can evaluate the submission fairly and reproduce the candidate's reasoning.

**Requirements:** NFR6 · README + AI-disclosure deliverable (Additional Requirements)

**Acceptance Criteria:**

**Given** the README
**When** it is read
**Then** it covers: **approach** (how the challenge was tackled, level by level), **design decisions** (hexagonal architecture, allocation transaction, AD-7 error contract, SPA-computes-nothing — each with its why), **assumptions** (single station, anonymous retrieval, plaintext codes, day = 24h with ceil, partial-day-bills-full), **trade-offs**, and **future improvements** (multi-station, code hashing, notifications, auth)

**Given** the AI-use disclosure section
**When** it is read
**Then** it answers all four required questions: which AI tool(s), how they were used, which portions are AI-assisted, and the prompts/workflow (BMAD planning pipeline, per-story build, human review points)

**Given** an evaluator with the repo and nothing else
**When** they follow the README's run instructions
**Then** every command is real and complete — local run via compose, the OpenAPI docs URL, how to run the Level-4 concurrency proof, and the live deployment URLs

**Given** the git history
**When** it is reviewed
**Then** it reads as meaningful per-story commits in TDD order (tests before implementation where applicable), tagged per epic — the graded history criterion (NFR6) is met by the repo itself, not just claimed
