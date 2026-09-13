# Rubric Walker Review — ARCHITECTURE-SPINE.md (2026-09-13)

Reviewed against: `docs/prd.md` (approved 2026-09-13) and the 7-point rubric (divergence points, AD enforceability, Deferred leakage, tech currency, PRD Levels 1–4 coverage, altitude completeness incl. operational envelope, placeholder hygiene).

**Verdict: PASS-WITH-FIXES** — no CRITICAL findings; the spine is coherent, coverage-complete, and build-ready, with a handful of MEDIUM patches to apply before epics/stories are written.

---

## Checklist roll-up

| # | Rubric point | Result |
| --- | --- | --- |
| 1 | Fixes real divergence points, misses none | Pass (minor gaps: retrieval-already-done code, `GET /lockers` response shape) |
| 2 | Every AD's Rule enforceable, prevents its divergence | Pass (AD-2 enforcement is human-only; AD-3 needs a raw-SQL note) |
| 3 | Deferred leaks no divergence | Pass |
| 4 | Named tech verified-current | Pass (verified against npm 2026-09-13, see below) |
| 5 | Covers PRD Levels 1–4 | Pass (all levels + extensibility + tests mapped) |
| 6 | Every owned dimension decided/deferred/open — operational envelope | Pass-with-fixes (deploy-time migration + prod DB provisioning unstated) |
| 7 | No placeholders/template comments/empty sections | Pass |

---

## Findings

### MEDIUM-1 — PRD's "already-empty locker / already-retrieved" invalid scenario has no pinned error code
- **Area:** AD-7 (error contract) vs PRD §5 Level 2.
- **Problem:** AD-7 declares "the `error.code` list is the API contract; codes are never renamed," yet the list has no code for the explicit PRD invalid scenario "already-empty locker" (locker valid, code valid, package already retrieved). Story authors will each invent one (`PACKAGE_ALREADY_RETRIEVED`? reuse `INVALID_PICKUP_CODE`? which status — 404 vs 409 vs 410?), which is exactly the per-endpoint drift AD-7 exists to prevent — inside AD-7's own list.
- **Fix:** Add the code now, e.g. `PACKAGE_ALREADY_RETRIEVED` (409 or 404 — pick one), or explicitly state in AD-7 that retrieval of an already-retrieved package returns `INVALID_PICKUP_CODE` 404 and that is final.

### MEDIUM-2 — Operational envelope: deploy-time migration step and production DB provisioning are unstated
- **Area:** AD-8 + Capability map row "Operational envelope" (Deployment & Environments, Infra/Provider, Operations).
- **Problem:** AD-8 mandates "schema moves only via `prisma migrate`," and Railway is named as the deploy target, but nothing says *who runs migrations in production* (`prisma migrate deploy` at release? release command? manual step?) or how the production Postgres is provisioned (Railway Postgres plugin vs the compose image, `DATABASE_URL` injection). Two independently-built units are not at risk, but the level below (deploy story) has no rule to enforce, and the AD-8 invariant can silently be violated in prod (schema drift between local compose and Railway).
- **Fix:** One sentence in AD-8 or the operational map row: "Production deploy runs `prisma migrate deploy` as the Railway release command against the Railway-provisioned Postgres; `DATABASE_URL` is injected by the platform."

### MEDIUM-3 — AD-2 is enforced only by "violations fail review"
- **Area:** AD-2 (inward-only dependency rule).
- **Problem:** The rule is correct but its only enforcement mechanism is human review. A single accidental `import { PrismaClient }` in a use case silently makes the hexagon decorative, and nothing mechanical catches it — the AD's stated prevention ("domain logic leaking… making the domain untestable") is then not actually prevented.
- **Fix:** Name a mechanical boundary check in the AD: `eslint` `no-restricted-imports` per directory, or `dependency-cruiser` in the test script, so the rule fails CI/local test runs, not just review.

### MEDIUM-4 — Prisma cannot express `FOR UPDATE SKIP LOCKED` in its fluent API; AD-3 should say so
- **Area:** AD-3 (allocation transaction).
- **Problem:** The rule mandates "one Prisma interactive transaction that selects … `FOR UPDATE SKIP LOCKED`," but Prisma's type-safe query API has no `SKIP LOCKED`; this requires `tx.$queryRaw`. A story implementer following Prisma idioms may substitute `updateMany`-with-condition or rely on the partial unique index alone (correct result, different failure mode — lost smallest-fit under contention) and claim compliance.
- **Fix:** One clause in AD-3: "the locker selection step is `$queryRaw` inside the interactive transaction; application-level retries on serialization failures are the fallback, never removal of SKIP LOCKED."

### LOW-1 — ERD shows `pickupCode UK` (global) but AD-6 mandates uniqueness only across *unretrieved* packages
- **Area:** Structural Seed ERD vs AD-6.
- **Problem:** AD-6 says "DB-unique across *unretrieved* packages" (a partial unique index), while the ERD marks `pickupCode UK`, which reads as a global unique index. The stricter global index also makes code recycling impossible and would make AD-6's wording wrong. Ambiguity here produces two different `schema.prisma` outcomes from one spine.
- **Fix:** Align: either state "partial unique index on `pickupCode` WHERE `status = 'STORED'`" in the ERD annotation, or upgrade AD-6 to global uniqueness and say codes are never reused.

### LOW-2 — No collision-retry rule for pickup-code generation
- **Area:** AD-6.
- **Problem:** With a partial unique index, a generated code colliding with an unretrieved code surfaces as a constraint violation. The rule doesn't say regenerate-and-retry, so one story might 500 on collision and another might retry.
- **Fix:** Add: "on unique-violation at insert, regenerate and retry (bounded, e.g. 3 attempts)."

### LOW-3 — `GET /lockers` response shape (availability representation) is not pinned
- **Area:** Consistency Conventions → Endpoints.
- **Problem:** PRD Level 1 requires "list of lockers along with their current availability status." The endpoint is fixed but its payload fields (e.g. `{ id, size, occupied }` vs embedding the current package) are not, and AD-4 (only use cases mutate state) doesn't constrain the read shape. Low risk because TypeBox schemas are contract-first per AD-1, but it is the one Level-1 surface left to story-level invention.
- **Fix:** One line in the endpoints convention: "`GET /lockers` returns `[{ id, size, occupied }]`" (or accept and note it is a story-level TypeBox decision).

### LOW-4 — Node 22 is the maintenance LTS line, not the active one
- **Area:** Stack table.
- **Problem:** Verified-current check passes for every npm package (see below), but "Node.js 22 LTS" names a line that entered maintenance; Node 24 is the active LTS as of 2026. Not wrong — 22 is supported into 2027 — just not the newest stable LTS the rubric's "verified-current" ideally names.
- **Fix:** Either keep 22 with the existing rationale, or bump to 24 LTS (`node:24-alpine`) — one-line change, no design impact.

### LOW-5 — Naming nits: `currencyDays`, "minor-free units"
- **Area:** AD-5 / Consistency Conventions.
- **Problem:** `storageCharge + currencyDays breakdown` — `currencyDays` is not a self-describing name for a day-count (reads like a currency); "integer minor-free units" is ambiguous (no minor/cents subdivision? or currency-agnostic integer?). Both invite divergent field naming in retrieval responses.
- **Fix:** Rename to `daysBilled` (or `chargeBreakdown: [{ tier, days, rate }]`) and reword to "money as integer base-unit counts, no decimals, no currency symbol."

### LOW-6 — Deferred: per-story test-DB strategy could still fork helpers
- **Area:** Deferred (last item).
- **Problem:** Rubric point 3 passes — no deferred item lets two *runtime* units diverge. The one borderline case is the deferred truncate-vs-rollback choice: two story authors can build incompatible DB helper utilities, which is suite-level (not shipped-behavior) divergence. The seed already shows a shared `test/ … test-db helpers`; the deferral just needs to point at it.
- **Fix:** Add "helpers live only in `test/db-helpers`, one implementation" to that deferred line.

### INFO — PRD's auth hedge not carried
- **Area:** Conventions ("no auth in v1 (PRD scope-out)") vs PRD §6 ("Authentication/authorization … (unless trivial to add)").
- **Problem:** The spine states the scope-out but drops the PRD's "unless trivial to add" hedge. Defensible (flat rule is better for the level below), noted for traceability only.
- **Fix:** None required; optionally cite the hedge so the decision is auditable.

---

## Verification detail

**Tech currency (rubric 4)** — checked against npm `latest` dist-tags on 2026-09-13:
- `typescript@7.0.2` ✓ matches latest; `fastify@5.12.4` ✓; `@fastify/swagger@9.8.1` ✓; `@sinclair/typebox@0.34.52` ✓ (0.34.x is the current major line under TypeBox's 0.x scheme); `vitest@5.0.0` ✓.
- `prisma` latest tag resolves to `8.0.0-rc.14`; `prisma@7.10.0` confirmed published and is the newest 7.x stable — the spine's "8.x is RC-only — do not upgrade casually" is accurate and correct behavior.
- `postgres:18-alpine` — Postgres 18 is the current major. Node: see LOW-4.

**PRD coverage (rubric 5)** — L1 (create/list/store, smallest-fit, no-suitable message, code+locker id returned) → AD-1/3/7 + endpoints ✓; L2 (locker id + code, invalid scenarios, locker freed) → AD-4/6/7 ✓ (with MEDIUM-1 gap); L3 (storedAt recorded, 24h day, 5/5/∞ tiering, charge on retrieval) → AD-5 + entity fields ✓; L4 (concurrent stores, no double-assignment, correct under contention) → AD-3/8 ✓; extensibility (PRD §4) → hexagonal paradigm + multi-station deferral ✓; automated tests (§7) → Vitest per-level suites ✓.

**AD enforceability (rubric 2)** — AD-1, AD-4, AD-5, AD-6, AD-7, AD-8 rules are concrete, checkable, and each maps to a mechanism (TypeBox schema, use-case-only mutation, pure function + env, partial unique index + format, envelope + stable codes, migration files). Gaps: AD-2 (MEDIUM-3), AD-3 (MEDIUM-4).

**Deferred leakage (rubric 3)** — all six deferrals are either out-of-scope per PRD (notifications, auth), additive-later schema choices (station, customer entity), a one-file change (code hashing), or a story-owned test detail (LOW-6). None permits two independently-built *runtime* units to diverge.

**Placeholder hygiene (rubric 7)** — no template comments, no TBD/TODO, no empty sections; all `[ADOPTED]`/`[ASSUMPTION]` markers carry their rationale.
