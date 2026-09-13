---
title: 'Stories 1.3–1.5: Complete Level 1 — list availability, store with allocation, graceful refusal'
type: 'feature'
created: '2026-09-13'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'ee00959'
context:
  - '_bmad-output/implementation-artifacts/epic-1-context.md'
  - '_bmad-output/implementation-artifacts/spec-1-2-create-lockers-of-a-chosen-size.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Level 1 is half-built — lockers can be created but the station cannot show availability, store packages, or refuse cleanly (FR2–FR6, FR10).

**Approach:** Three stories, one dispatch, per-story commit plan (user commits): **1.3** `GET /lockers` with the frozen list contract; **1.4** `POST /packages` — smallest-fitting allocation in one `FOR UPDATE SKIP LOCKED` transaction, pickup code, `storedAt`; **1.5** `NO_SUITABLE_LOCKER` 409, fully side-effect-free.

## Boundaries & Constraints

**Always:** AD-1 frozen list contract **verbatim** — `200 {"lockers":[{"id": string, "size": "SMALL"|"MEDIUM"|"LARGE", "occupied": boolean}]}` ordered by `id`; **list items use `id`** (not `lockerId`), exactly three fields, no package detail; empty station → `{"lockers":[]}`, never 404. `POST /packages` → `201 {"lockerId": <cuid>, "pickupCode": <code>}` (`lockerId` here per AD-9); `customerRef` optional string. AD-3: allocation is ONE Prisma interactive transaction — `$queryRaw` `SELECT ... WHERE occupied_by IS NULL AND <fits> ORDER BY <size rank>, id FOR UPDATE SKIP LOCKED LIMIT 1`, then CAS occupy (`UPDATE locker SET occupied_by = ? WHERE id = ? AND occupied_by IS NULL`, create-count checked), then create the package row — commit atomically; rank SMALL(1) < MEDIUM(2) < LARGE(3); smallest fitting wins, tie → lowest `id`; READ COMMITTED only; Prisma P2034 → bounded 3× retry, then `INTERNAL_ERROR`. AD-6: pickup code 8 chars from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no 0/O/1/I), crypto-random, unique among `STORED` packages — partial unique index `ON stored_package (pickup_code) WHERE status = 'STORED'`, never regenerated. AD-7: `NO_SUITABLE_LOCKER` → 409 envelope, zero writes. AD-4: no blind occupancy writes. `StoredPackage` model created now with `id, pickupCode, customerRef?, storedAt, retrievedAt?, status STORED|RETRIEVED` (retrievedAt/status unused until Epic 2) + the partial unique index on occupied_by-side (one package per locker enforced in schema, AD-8). Allocation rule and code generator are pure functions in `@locker/domain` with unit tests. Integration suites truncate-isolated (existing `test-db.ts`). **Commits: the agent stages nothing** — it delivers a per-story, test-first commit plan; the human runs every commit (NFR6 preserved by the plan's order).

**Never:** no retrieval/pricing endpoints (Epic 2); no concurrency-proof suites (Epic 3 — but include one two-parallel-stores smoke test so the locking is exercised); no UI; no auth; no module-level mutable state; no floats; no raising isolation levels.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior |
|----------|--------------|---------------------------|
| List mixed | `GET /lockers`, mixed sizes/occupancy | `200` exact frozen shape, ordered by `id`, exactly 3 fields per item |
| Empty station | `GET /lockers`, no rows | `200 {"lockers":[]}` |
| Store smallest-fit | free SMALL + MEDIUM, `POST /packages {"size":"SMALL","customerRef":"Meera R."}` | `201` SMALL locker, `{"lockerId","pickupCode"}`; row records `storedAt`; locker occupied |
| Rank then id | free SMALL + MEDIUM, MEDIUM package | MEDIUM locker chosen; ties broken by lowest `id` |
| Fits-not-exact | only LARGE free, SMALL package | stored in LARGE |
| Pickup code | any store | 8 chars, no `0/O/1/I`, unique among STORED, bound to this package+locker |
| Nothing fits | all fitting sizes occupied | `409 {"error":{"code":"NO_SUITABLE_LOCKER",...}}`, zero rows written, zero locker changes |
| Per-size exhaustion | SMALL all busy, MEDIUM free, SMALL package | succeeds in MEDIUM |
| Invalid body | `{"size":"HUGE"}` / missing / wrong type | `400 VALIDATION_ERROR` (existing mapper), nothing written |
| Concurrency smoke | 2 truly-parallel stores, 1 fitting free locker | exactly one `201`, one `409`, locker occupied once |

</frozen-after-approval>

## Code Map

Builds on 1.2's shape: domain → ports/use-cases → Prisma repo → TypeBox route → swagger.

- `packages/domain/src/allocation.ts` — `sizeRank`, `pickSmallestFitting(freeLockers, packageSize)` pure; `pickup-code.ts` — `generatePickupCode(random)` pure over an injectable byte source.
- `apps/api/src/application/` — extend `LockerRepository` port (`list()`, transaction-scanned allocate hooks); `PackageRepository` port; `StorePackage`, `ListLockers` use cases; `NoSuitableLockerError` (409).
- `apps/api/src/adapters/db/` — `PrismaLockerRepository.list`, `PrismaPackageRepository` + the `$transaction`/`$queryRaw` SKIP LOCKED store flow; migration `20260913130000_create_stored_package` (table + both partial unique indexes).
- `apps/api/src/adapters/http/` — `schemas/locker-schema.ts` (list reply), `schemas/package-schema.ts`, `routes/lockers.ts` (GET), `routes/packages.ts` (POST).
- Tests: domain units; use-case units (in-memory ports: rank/tie/exhaustion/no-fit, code alphabet); integration (matrix rows above, incl. storedAt recorded and 409 side-effect-free via row counts).

## Tasks & Acceptance

**Story 1.3 — list availability:**
- [x] `list()` on port + Prisma repo; `ListLockers` use case; `GET /lockers` TypeBox schema (frozen shape) + route; integration tests (exact shape/order, empty station); commit plan entry (test-first)

**Story 1.4 — store with allocation:**
- [x] `StoredPackage` model + migration (+ partial unique indexes)
- [x] Domain `allocation.ts` + `pickup-code.ts` + unit tests (rank order, tie by id, fits-not-exact, no-fit outcome; alphabet excludes 0/O/1/I, 8 chars)
- [x] `StorePackage` use case + ports; Prisma transaction flow (SKIP LOCKED select, CAS occupy, package insert, P2034 retry)
- [x] `POST /packages` route + schemas; integration tests (201 body, storedAt recorded, occupancy flip); concurrency smoke test (2 parallel, 1 free)

**Story 1.5 — graceful refusal:**
- [x] `NoSuitableLockerError` → 409 mapping via existing error mapper; integration tests (409 envelope, row counts unchanged, per-size exhaustion succeeds, invalid size 400)

**Acceptance:** every matrix row above holds; all suites green via `turbo run build test lint`; `/docs` shows `GET /lockers` + `POST /packages` with schemas; per-story test-first commit plan delivered for the human to run.

## Design Notes

- `$queryRaw` sketch (rank computed in SQL): `SELECT id, size FROM locker WHERE occupied_by IS NULL AND (CASE size WHEN 'SMALL' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END) >= $1 ORDER BY (CASE size WHEN 'SMALL' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END), id FOR UPDATE SKIP LOCKED LIMIT 1` — the domain `pickSmallestFitting` mirrors this rule for the unit-tested pure path; the SQL is the concurrency authority.
- Code uniqueness: rely on the partial unique index; on collision (P2002 within the transaction) regenerate and retry (bounded), not pre-check.
- Story 1.3's list must NOT join packages — `occupied` derives from `occupied_by IS NOT NULL` (AD-1: no per-locker package detail in v1).

## Spec Change Log

## Verification

**Commands:**
- `docker compose up -d postgres` (already running on 55432) + `npx pnpm@12.4.1 turbo run build test lint` — green
- `curl :3000/lockers` after creating mixed lockers — frozen shape, ordered by id
- `curl -X POST :3000/packages -d '{"size":"SMALL","customerRef":"Meera R."}'` — 201 with SMALL lockerId + 8-char code; repeat to exhaust → 409 NO_SUITABLE_LOCKER with state unchanged

## Implementation Notes

- **Verification:** implementer ran full pipelines at story boundaries (14/14 ×3, 87 tests: 22 domain + 65 api) plus live curl checks. Orchestrator independently re-ran pipelines (14/14, 12 cached) and spot-read the four riskiest files — the store transaction, the allocation rule, the code generator, and the migration SQL — confirming AD-3 (SKIP LOCKED rank/id scan inside one interactive transaction), AD-4 (count-checked CAS, no blind writes), AD-6 (32-char alphabet, no 0/O/1/I; partial unique index among STORED), AD-8 (one-active-package-per-locker index). Story 1.5's implementation is the unchanged AD-7 error mapper + `NoSuitableLockerError` from 1.4 — refusal proven side-effect-free by row-count assertions.
- **Deviations (accepted):** package insert precedes the CAS (the CAS needs the package's real cuid for `occupied_by` — both writes share the transaction, atomicity identical); 1.4/1.5 boundaries verified together (3 full runs, not 4); migration created with `--create-only`, hand-edited to add the partial indexes, applied once; Ajv coerces a wrong-typed `customerRef` to string rather than 400 (size wrong-type still 400; use case rejects non-strings at unit level — same known-v1 family as 1.2's additionalProperties stripping); list ordering owned by the `ListLockers` use case (single owner of the frozen contract).
- **Known gaps (fine):** no real-DB P2002 collision test (31^8 space, retry proven at unit level); full concurrency suites are Epic 3's scope — the 2-parallel-store smoke test already exercises the lock path.
- **Commits:** none made by agents (user rule). 13-commit test-first plan handed to the user, grouped 1.3 → 1.4 → 1.5.
