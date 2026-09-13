---
title: 'AD-9 amendment: human locker ids'
type: 'change'
created: '2026-09-13'
status: 'awaiting-approval'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '4c55506'
context:
  - '_bmad-output/planning-artifacts/architecture/architecture-smart_package_everest-2026-09-13/ARCHITECTURE-SPINE.md'
  - '_bmad-output/implementation-artifacts/deferred-work.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** AD-9 froze the locker's cuid as its only identifier. That value (`cmtzxfpwh0001kux6pee382wm`, 25 machine chars) is what a customer must type one-handed on `/retrieve` — the single worst UX wart in the demo path, surfaced during Epic 4 manual smoke.

**Approach:** Amend AD-9 rather than break it. A generated **6-character unambiguous code** (`K7Q4M2`) becomes the public `lockerId` carried in every payload — still *exactly one* public identifier, same field name, same call sites. The cuid is demoted to an internal surrogate key that never crosses the API boundary. Locker codes reuse the pickup-code alphabet (`0/O/1/I` excluded — a customer can never misread one), so the domain keeps a single source of truth for "human-typed characters".

## Boundaries & Constraints

**Always:** `LOCKER_CODE_LENGTH = 6` (31⁶ ≈ 887M codes — no counter, no concurrency surface); reuse the frozen `PICKUP_CODE_ALPHABET` from `@locker/domain`; generation is pure over the injected `RandomSource` (AD-6 idiom — `crypto-random.ts` already exists); `locker.code` is `NOT NULL UNIQUE` (AD-8: a real committed migration, never `db push`); collision on create retries a bounded 3 attempts inside the Prisma adapter, mirroring the existing `allocate(request, nextPickupCode)` house idiom; retrieval **normalizes** the typed id (`trim` + `toUpperCase`) so lowercase/pasted-with-spaces input just works; response schemas carry `pattern: '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$'`; the pickup request stays charset-loose so junk degrades to the calm `LOCKER_NOT_FOUND`, never a 400; AD-1 list ordering becomes "by the public identifier" (the code); dev database is reset via `prisma migrate reset` (1 locker, 1 package — nothing worth keeping), and the migration still carries a generic md5-derived backfill so it applies on any non-empty DB; regenerate the OpenAPI types for `apps/web`.

**Never:** no second public identifier (no `displayId` field — the code **is** `lockerId`, preserving AD-9's spirit); no change to pickup codes (still 8 chars, AD-6), charges, or the SKIP LOCKED allocation machinery (the SQL size-rank tiebreak stays on the internal `id` — invisible); no auth; no schema change to `stored_package`; cuids never appear in any payload after this change.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create locker | `POST /lockers` `{"size":"MEDIUM"}` | `201 {"lockerId":"K7Q4M2","size":"MEDIUM","occupied":false}` — 6-char code | N/A |
| Code collision on create | generator draws an existing code (≈1/887M) | adapter regenerates, ≤3 attempts; caller never sees it | exhausted → 500 AD-7 envelope |
| List lockers | `GET /lockers` | items keyed by code, ordered by code (AD-1 rider) | N/A |
| Store package | `POST /packages` | reply `lockerId` = the assigned locker's code | unchanged `NO_SUITABLE_LOCKER` 409 etc. |
| Retrieve, tolerant input | `POST /pickups` `" k7q4m2 "` | normalized to `K7Q4M2`, package retrieved | N/A |
| Retrieve, unknown code | any non-empty junk | `404 LOCKER_NOT_FOUND` — calm copy, nothing written | AD-7 envelope |
| Retrieve, wrong shape | empty/missing lockerId | `400 VALIDATION_ERROR` | AD-7 envelope |
| Existing dev DB | migration on non-empty `locker` table | md5-derived backfill assigns codes, then unique index | collide → migrate fails loudly (dev-only) |
| Fresh database | `prisma migrate deploy` | column + index created clean, backfill no-ops | N/A |

</frozen-after-approval>

## Code Map

- `packages/domain/src/locker-code.ts` (new) — `LOCKER_CODE_LENGTH`, `generateLockerCode(random: RandomSource)`; imports the frozen alphabet; exported via `index.ts`.
- `apps/api/prisma/schema.prisma` — `Locker.code String @unique @map("code")` + migration `human_locker_codes` (backfill + unique index).
- `apps/api/src/adapters/db/locker-repository.ts` — `create(size, nextLockerCode)` with the bounded P2002 retry; maps `row.code` → `lockerId` (create + list).
- `apps/api/src/adapters/db/package-repository.ts` — `storeWithin` selects `code` and returns it as `lockerId`; `retrieveWithin` resolves/CASes by `l.code` (join `WHERE`, fallback `findUnique({ where: { code } })`, `updateMany` where-clause).
- `apps/api/src/application/` — `ports/locker-repository.ts` (create signature + AD-9 v1.1 doc), `use-cases/create-locker.ts` (generator injected, passed through), `use-cases/retrieve-package.ts` (trim + uppercase normalize), `use-cases/list-lockers.ts` (order key comment).
- `apps/api/src/index.ts` (composition root) — wire `generateLockerCode(cryptoRandomInt)` into `CreateLocker`.
- `apps/api/src/adapters/http/schemas/` — response `pattern` + description updates; pickup request loosened to `minLength 1, maxLength 32`.
- `apps/web/src/routes/RetrievePage.tsx` — input auto-uppercases, `placeholder="e.g. K7Q4M2"`, `maxLength 32`; `packages/ui/src/components/result-card.tsx` — unchanged layout, now rendering a 6-char value.
- Tests: domain `locker-code.test.ts`; api create/list/store/retrieve integration fixtures swap cuids for codes (+ case-tolerance case); web retrieve-page + result-card fixtures.
- Docs: `ARCHITECTURE-SPINE.md` AD-9 → v1.1 amendment (+ AD-1 ordering rider), `BUILD-HANDOFF.md` deviation note.

## Tasks & Acceptance

**Execution:**

- [ ] 1. Domain: `locker-code.ts` + unit tests (length, alphabet membership, determinism under injected source, exclusion of `0/O/1/I`); export from `index.ts`.
- [ ] 2. Prisma: schema field + `prisma migrate dev --name human_locker_codes` (backfill SQL + unique index); reset the dev database.
- [ ] 3. Adapter: `PrismaLockerRepository` — code into `lockerId`, bounded collision retry; port signature update.
- [ ] 4. Package repository: `storeWithin`/`retrieveWithin` by code; integration tests updated (store → reply code; retrieve lowercase + padded → success).
- [ ] 5. Use cases + composition root: generator wiring, retrieval normalization, ordering comment.
- [ ] 6. HTTP schemas: response patterns, loosened pickup request; `/docs` renders the new shapes.
- [ ] 7. Contract regen for web (`schema.d.ts`), web changes + tests.
- [ ] 8. Docs sync: AD-9 v1.1 in ARCHITECTURE-SPINE.md, BUILD-HANDOFF deviation note, deferred-work.md "short display id" entry superseded.
- [ ] 9. Full pipeline (`turbo run build test lint`) green ×3 consecutive; test-count delta recorded here.

**Verification:**

- [ ] `npx pnpm@12.4.1 turbo run build test lint` ×3 green.
- [ ] User manual smoke: create → grid shows codes implicitly; store → ResultCard shows `K7Q4M2`-style id; `/retrieve` with lowercase+spaces → opens; wrong code paths calm.

## Implementation Notes

*(filled at close)*
