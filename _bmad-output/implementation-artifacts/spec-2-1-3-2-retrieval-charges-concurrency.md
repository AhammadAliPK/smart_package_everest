---
title: 'Stories 2.1–2.3 + 3.1–3.2: Retrieval, tiered charges, and the concurrency proof'
type: 'feature'
created: '2026-09-13'
status: 'planning'
route: 'direct'
review_loop_iteration: 0
baseline_commit: 'b9d0b59'
context:
  - '_bmad-output/implementation-artifacts/BUILD-HANDOFF.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Packages go in but never come out. Level 2 (retrieval), Level 3 (tiered charges), and Level 4 (concurrency proof) are unbuilt (FR7–FR15).

**Approach:** One batch, implemented directly by the orchestrator. **2.1** `POST /pickups` — validate lockerId + code, atomically free the locker and mark the package RETRIEVED. **2.2** four distinct, side-effect-free invalid outcomes. **2.3** pure `StoragePricingPolicy` (AD-5) + charge breakdown in the retrieval response. **3.1/3.2** the reproducible Level-4 proof: parallel no-double-assignment, oversubscription, mixed-op invariants, P2034 retry unit test.

## Boundaries & Constraints

**Always:** `POST /pickups {"lockerId","pickupCode"}` → `200 {"lockerId","retrievedAt","storageCharge","daysCharged","breakdown":[{"tier","days","rate","amount"},...]}` (only tiers actually used; integers only — AD-5). Retrieval = one transaction: resolve via a single query joining `locker.occupied_by = stored_package.id` with `pickup_code = ? AND locker id = ? AND status = 'STORED'` (AD-6), CAS-free the locker (`UPDATE ... SET occupied_by = NULL WHERE id = ? AND occupied_by = ?`, count-checked — AD-4), set `retrievedAt` + `status = 'RETRIEVED'`. Outcome order: malformed body → `400 VALIDATION_ERROR`; unknown lockerId → `404 LOCKER_NOT_FOUND`; locker exists, occupied, wrong code → `404 INVALID_PICKUP_CODE` (no burn, zero writes); locker exists, nothing stored (never or already retrieved) → `409 LOCKER_EMPTY`. Wrong attempt never mutates anything; immediate retry with the right code succeeds. Pricing: `StoragePricingPolicy.charge(storedAt, retrievedAt, baseFee)` pure in `@locker/domain` — days = `ceil(elapsed/24h)` (day 1 starts at storage; exact 24h = 1 day, 24h+1min = 2 days), tiers 1–5×X / 6–10×2X / 11+×3X, integer units, X = `STORAGE_FEE_BASE` env (default 10) injected from `Env.storageFeeBase`. Concurrency suites: `Promise.all` against the real route stack (no artificial serialization, no sleep-based timing, seeded fixtures, truncate isolation); P2034 retry proven by a conflict-injecting repository mock (fails once, succeeds on retry 2, exhausts after 3 → INTERNAL_ERROR). Suite must pass 3× consecutively. OpenAPI: `POST /pickups` schemas at `/docs`. Per-story test-first commits (Claude commits — user delegated 2026-09-13).

**Never:** no UI; no auth; no code hashing; no floats; no isolation-level raises; no regenerating pickup codes; `apps/web`/`packages/ui` untouched.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected |
|----------|--------------|----------|
| Valid retrieval | occupied locker + matching code | `200` with `retrievedAt` ISO-8601 UTC, charge fields; locker `occupied:false` after; package `RETRIEVED` |
| Atomicity | crash/rollback mid-retrieval | never a freed locker with a STORED package or vice versa (single transaction) |
| Wrong code | occupied locker, wrong code | `404 INVALID_PICKUP_CODE`, zero writes, right code still works immediately after |
| Unknown locker | random cuid | `404 LOCKER_NOT_FOUND` |
| Already retrieved | repeat pickup with the old code | `409 LOCKER_EMPTY` |
| Malformed | missing fields, code not 8 chars, wrong types | `400 VALIDATION_ERROR` via TypeBox |
| Pricing table | <24h→X; 24h→X; 24h+1m→2X; 5d→5X; 6d→5X+2X; 12d→5X+10X+6X=210@X=10; non-default X | exact integer results + breakdown rows only for used tiers |
| Oversubscription | N>M parallel stores, M free fitting | exactly M `201` distinct lockerIds + N−M `409`; occupied count == M after |
| Mixed rounds | interleaved stores/retrievals ×R | after every round: occupied lockers == STORED packages; no locker double-assigned; freed lockers immediately re-assignable |

## Tasks

- [ ] 2.1: `storage-pricing.ts` domain policy + table-driven unit tests (test-first)
- [ ] 2.1: `RetrievePackage` use case + `PackageRepository.retrieve` port; errors `InvalidPickupCodeError` 404 / `LockerNotFoundError` 404 / `LockerEmptyError` 409; unit tests with mock port
- [ ] 2.1: Prisma retrieval transaction (single-query resolve + CAS free + RETRIEVED) ; `POST /pickups` route + schemas; integration: happy path + locker freed + OpenAPI
- [ ] 2.2: integration suite for all four invalid outcomes incl. no-burn retry and zero-mutation row assertions
- [ ] 2.3: charge breakdown wired into retrieval response from recorded `storedAt`; integration with backdated `storedAt` asserting exact charge/breakdown
- [ ] 3.1: parallel-store suite (distinct ids, exact M successes, occupied invariant)
- [ ] 3.2: mixed-rounds suite + P2034 retry unit tests (retry-2 success, exhaustion)
- [ ] Full pipeline green ×3 consecutive runs; per-story commits

## Spec Change Log

## Verification

- `npx pnpm@12.4.1 turbo run build test lint` ×3 consecutive — green
- `curl -X POST :3000/pickups` happy + each invalid outcome; `/docs/json` lists `/pickups`
