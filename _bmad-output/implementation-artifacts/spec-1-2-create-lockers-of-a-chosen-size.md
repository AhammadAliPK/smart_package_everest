---
title: 'Story 1.2: Create lockers of a chosen size'
type: 'feature'
created: '2026-09-13'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '8bf3b38'
context:
  - '_bmad-output/implementation-artifacts/epic-1-context.md'
  - '_bmad-output/implementation-artifacts/deferred-work.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The station has no lockers — there is nothing to store packages into. Delivery agents must be able to add lockers of a chosen size (FR1).

**Approach:** `POST /lockers` with a declared size creates a locker. The Prisma `Locker` model arrives with its own migration (AD-8); TypeBox contract-first request/response schemas + the AD-7 error envelope + OpenAPI docs at `/docs` go live (AD-1, AD-7); size validation is a pure domain rule (AD-2).

## Boundaries & Constraints

**Always:** corrected registry-verified pins — `@sinclair/typebox 0.34.52`, `@fastify/type-provider-typebox 6.1.0`, `@fastify/swagger 9.8.1`, `@fastify/swagger-ui 6.1.1`; AD-7 envelope `{"error":{"code","message"}}` for every non-2xx (starts with `VALIDATION_ERROR` 400); response `{"lockerId": <cuid>, "size": ..., "occupied": false}` — `lockerId` is the locker's only identifier (AD-9); enum `SMALL|MEDIUM|LARGE`; Locker table columns `id` (cuid), `size`, `occupiedBy` (nullable, default null — CAS target for AD-4, unused until Story 1.4; the partial unique index arrives with `StoredPackage` in 1.4); wire `prisma generate` into the pipeline (postinstall + build dependency) — the first import of the generated client happens this story; make `pnpm dev`/tests load `.env` (tsx `--env-file-if-exists` or dotenv import first in `index.ts`); integration tests run against the compose Postgres with a documented per-suite isolation strategy — this story picks **truncate-after-suite** via a shared test-db helper; TDD commit order, per-story commits (NFR6).

**Never:** no storing/allocation logic (Stories 1.4/1.5); no listing endpoint (Story 1.3); no auth; no floats; no isolation-level raises; no changes in `apps/web`/`packages/ui`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create locker | `POST /lockers` `{"size":"MEDIUM"}` | `201 {"lockerId": <cuid>, "size":"MEDIUM", "occupied": false}` | N/A |
| Invalid size | `"HUGE"`, lowercase `"small"`, missing, wrong type | `400 {"error":{"code":"VALIDATION_ERROR","message":...}}` via TypeBox schema; no locker created | AD-7 envelope |
| OpenAPI docs | `GET /docs` | interactive docs listing `POST /lockers` request/response schemas | N/A |
| Fresh database | migration applies via `prisma migrate` | `Locker` table created cleanly | N/A |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma` — `Locker` model (id/size/occupiedBy) + migration `20260913120000_create_locker`; `prisma generate` wired (postinstall, turbo build dependency).
- `packages/domain/src/locker-size.ts` — `LOCKER_SIZES`, `LockerSize`, `isLockerSize()`; pure, zero deps (AD-2).
- `apps/api/src/application/` — `ports/locker-repository.ts` (create), `use-cases/create-locker.ts` (validates size via domain, delegates to port).
- `apps/api/src/adapters/http/` — `schemas/locker-schema.ts` (TypeBox), `routes/lockers.ts` (POST), `plugins/` or app registration for `@fastify/swagger` + swagger-ui at `/docs`; error mapper producing the AD-7 envelope on validation failures.
- `apps/api/src/adapters/db/` — Prisma `LockerRepository` implementing the port.
- `apps/api/test/` — `test-db.ts` helper (connect, truncate between suites), `create-locker.test.ts` integration suite; unit tests for domain + use case (in-memory port).

## Tasks & Acceptance

**Execution:**
- [x] Prisma `Locker` model + migration + `prisma generate` wiring — table exists, client generates in CI-fresh installs
- [x] `.env` loading for dev/test path — `pnpm --filter @locker/api dev` boots with only a `.env` file present
- [x] `packages/domain/src/locker-size.ts` + unit tests — pure size validation
- [x] `LockerRepository` port + `CreateLocker` use case + unit tests (in-memory port; invalid size rejected)
- [x] Prisma `LockerRepository` implementation
- [x] TypeBox schemas + `POST /lockers` route + AD-7 `VALIDATION_ERROR` mapping
- [x] `@fastify/swagger` + swagger-ui registered; `/docs` serves the interactive docs
- [x] Integration suite against compose Postgres (truncate isolation): 201 body shape + cuid format; 400 envelope for each invalid-size variant; no row created on 400
- [x] Commits in TDD order (tests before implementation where applicable) — NFR6

**Acceptance Criteria:**

**Given** a valid size, **when** `POST /lockers` with `{"size":"MEDIUM"}`, **then** `201` with `{"lockerId": <cuid>, "size":"MEDIUM","occupied":false}` (AD-9).
**Given** a size outside the enum (`"HUGE"`, lowercase `"small"`, missing), **when** `POST /lockers`, **then** `400` AD-7 envelope `VALIDATION_ERROR` and no locker created.
**Given** a fresh database, **when** the migration applies, **then** it applies cleanly, the schemas appear at `/docs`, and the use case is covered by unit tests (invalid size) and the route by integration tests (status, body shape, cuid format).

## Design Notes

- Error mapping: Fastify's `setErrorHandler` + schema-validation hook produce the envelope — one `error-mapper.ts`, reused by every later story (NO_SUITABLE_LOCKER etc. arrive in 1.5/2.x).
- Isolation choice: truncate-after-suite (simple, honest against a real DB; rollback-via-savepoint would fight Prisma interactive transactions coming in 1.4).
- Pins note: the spine originally said `typebox 1.3.30`/`@fastify/type-provider-type-box` — corrected 2026-09-13 to registry-verified `0.34.52` / `@fastify/type-provider-typebox` (see spec-1-1 Implementation Notes).

## Spec Change Log

## Verification

**Commands:**
- `docker compose up -d postgres` — healthy Postgres 18
- `npx pnpm@12.4.1 install && npx pnpm@12.4.1 turbo run build test lint` — all pipelines green
- `npx pnpm@12.4.1 --filter @locker/api dev` then `curl -s -X POST localhost:3000/lockers -H 'content-type: application/json' -d '{"size":"MEDIUM"}'` — `201` with cuid `lockerId`
- same with `{"size":"HUGE"}` — `400` `{"error":{"code":"VALIDATION_ERROR",...}}`
- `curl -s localhost:3000/docs` — OpenAPI UI serves with `POST /lockers` present

## Implementation Notes

- **Verification:** orchestrator read the full story diff (`8bf3b38..e09c02e`, 30 files, +897/−8) and independently re-ran `turbo run build test lint` → 14/14 green (12 cached). Implementer's live checks accepted: `.env`-only boot → `/health` ok; `POST /lockers` MEDIUM → 201 cuid body; `HUGE`/`small`/`{}` → 400 AD-7 envelope with zero rows created; fresh-DB migrations clean; `/docs` + `/docs/json` list the route with its 201 schema. 37 tests total (8 domain, 29 api).
- **Deviations (all reasonable):** added `@prisma/adapter-pg 7.10.0` — Prisma 7's generated client refuses to connect without a driver adapter (version-matched to the pin); `.env` loading is an upward-searching dotenv loader (`load-env.ts`) rather than `tsx --env-file` — `.env` lives at the repo root while processes run from workspace dirs, and real env vars still win; Dockerfile copies `apps/api/prisma` before `pnpm install` because the new `postinstall: prisma generate` needs the schema (image build itself not run locally — belongs to Story 5.1); auto-generated migration timestamp renamed to `20260913120000` before first apply; Docker Desktop daemon restarted (wedged).
- **Known v1 behavior (accepted):** Fastify's default Ajv strips unknown body properties instead of rejecting (`{"size":"MEDIUM","junk":1}` → 201) — the spec's matrix never required strict body rejection and AD-7 is unaffected; unknown routes keep Fastify's default 404 (AD-7's frozen code set has no "no such route" code).
- **Review:** per user direction (2026-09-13), the 3-layer reviewer gate is skipped for feature stories; orchestrator diff review + independent pipeline re-run serve as the story review. Nothing routed to patch; no loopbacks.
- 7 commits in TDD order (`4a778b7..e09c02e`), local only, nothing pushed.
