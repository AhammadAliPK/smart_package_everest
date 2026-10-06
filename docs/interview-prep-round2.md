# Tech Round 2 — Prep Doc

**Date of round 1 feedback:** 2026-10 (passed, "not a strong yes" — round 2 is the close-out)
**What round 2 will cover (per recruiter intel):**

1. The two soft spots from round 1: **navigating + changing an existing codebase live**, and **testing concepts** (contract, component, coverage).
2. **DB / architecture / design depth** drawn from your 11 years (GIS, banking, gov/enterprise).
3. Possibly a **random problem statement** to solve live.

Round 1's verdict in one line: *you explain decisions well, but translating a proposal into actual code in the existing repo took extra time.* Round 2 is where you prove the gap is small. The single best preparation is having **already done the thing they asked**: implement the locker-size pricing extension for real, in this repo, before the interview.

---

## Part 1 — Kill the navigation weakness (highest priority)

### 1.1 The file map (memorize cold)

One request, all layers, in call order. If you can recite this you never look lost:

```
POST /packages
  adapters/http/routes/packages.ts        # route binding, hands raw body to use case
  adapters/http/schemas/package-schema.ts # Zod/OpenAPI schema for the endpoint
  application/use-cases/store-package.ts  # validation → calls repository port
  application/ports/package-repository.ts # the interface (contract) — no DB knowledge
  adapters/db/package-repository.ts       # Prisma impl: tx, SKIP LOCKED scan, CAS
  packages/domain/src/pickup-code.ts      # 6-char code, unambiguous alphabet
  packages/domain/src/allocation.ts       # SIZE_RANK (does M fit in L? yes)
  → Postgres: locker.occupied_by CAS + stored_package insert
```

```
POST /pickups  (the money flow — know it best)
  adapters/http/routes/pickups.ts
  application/use-cases/retrieve-package.ts   # normalize id, validate, delegate, price
  adapters/db/package-repository.ts#retrieveWithin
    1. locked join: locker ⋈ occupied_by ⋈ pickup_code ⋈ status='STORED'  FOR UPDATE
    2. miss → one locker read → NOT_FOUND / EMPTY / INVALID_CODE (calm, wrote nothing)
    3. SELECT now()  ← Postgres clock, one clock for storedAt/retrievedAt
    4. CAS-free: updateMany where occupiedBy = packageId, count must be 1
    5. flip package → RETRIEVED
  packages/domain/src/storage-pricing.ts      # pure tier math, ceiling days
```

**Rehearse saying it:** "Route validates shape via the OpenAPI schema, the use case owns the business rules, the port is the seam, the adapter owns transactions, the domain package owns pure policy. Inbound at HTTP, outbound at Postgres, nothing crosses backwards."

### 1.2 The navigation technique (what they actually scored you on)

The round-1 note was *not* "he doesn't know the code" — it was "working through the existing implementation took time." Fix the performance, not the knowledge:

1. **Narrate the hunt before you hunt.** "I expect the pricing rule to live in the domain package because it's pure policy — let me check `storage-pricing.ts`." Even when you land on the wrong file, the reasoning reads as signal, not wandering.
2. **Go-to-definition over grep.** In the live session: click the symbol, `⌘.` / F12, "find references." Grep is for when you don't know the name; you know this codebase's names.
3. **Timebox out loud.** "Give me 30 seconds to orient in this file." Buys calm time and looks like discipline.
4. **Vertical slice, checkpoint each layer.** Schema → failing test → port → adapter → use case → route. Say the plan *first*, then execute layer by layer. Interviewers forgive slowness; they don't forgive silence or randomness.
5. **When stuck, state the hypothesis and take the hint.** "My guess is the env validation rejects this — mind if I check env.ts?" Accepting a nudge gracefully is a pass signal; grinding silently is the fail one.

### 1.3 The five drills (do them for real, timed)

Do each with a 20-minute timer, talking aloud as if the panel is watching. That is the whole point — you are rehearsing the *performance*, not the code.

**Drill 1 — THE extension: locker-size-based pricing (do this first; it's the one they already asked).**

> **SHIPPED 2026-10-05 — this is no longer a rehearsal.** The full slice is on `main`: migration `20261005040719_pricing_config` (table + seed, SMALL 10 · MEDIUM 15 · LARGE 20), `PricingConfigRepository` port + Prisma adapter (env fallback on a missing row), `PackageRetrieval.size` threaded through the join, `RetrievePackage` pricing by size, `GET /pricing` now serving one fully-priced block per size, `StorageRates` rendering three blocks verbatim, and the truncate helper re-seeding config so suites stay deterministic. Your job now is only the *narration*: re-read the diff top to bottom, then re-do §1.4's demo with a MEDIUM package (6-day stay → 105 units) so the numbers come out of your mouth fluently.

Vertical slice, exactly as you'd present it (and as it now exists):

1. `apps/api/prisma/migrations/…_pricing_config/` — new table:
   ```sql
   CREATE TABLE pricing_config (
     size LockerSize PRIMARY KEY,
     base_fee INTEGER NOT NULL
   );
   INSERT INTO pricing_config VALUES ('SMALL',10),('MEDIUM',15),('LARGE',20);
   ```
   *Why a table:* operations changes prices without a deploy; the tiers (×1/×2/×3) stay in code because they're policy, not configuration.
2. `application/ports/` — add a `PricingConfigRepository { getBaseFee(size: LockerSize): Promise<number> }` port. The use case now needs the locker's size at retrieval — extend `PackageRetrieval` with `size` (the join already touches the locker row; adding `l.size` is one column).
3. `adapters/db/pricing-config-repository.ts` — trivial read, cached in-module if asked about perf (invalidate on deploy; prices are read-hot).
4. `retrieve-package.ts` — inject the port; `charge(storedAt, retrievedAt, await pricing.getBaseFee(retrieval.size))`.
5. Tests first at every step: migration exists (repo test), wrong-size fee rejected, retrieval price uses MEDIUM's 15 not the env's 10, tiers still stack.
6. Rollback story: table is additive; old env var becomes the fallback default. Zero-downtime: deploy code that *reads* the table before the data exists? Seed in the same migration — always shipped together (that's your AD-8 discipline answer).

**Drill 2 — add `customerRef` to the retrieval response.**
Smallest full-lambda slice: join already loads the package row → add `customer_ref` to `StoredRow` → `PackageRetrieval` → use case result → `pickup-schema.ts` response schema → web's generated `schema.d.ts` regenerates via `export-openapi` → one web test. ~10 minutes if fluent. This drill is "show them you can touch every layer cheaply."

**Drill 3 — `GET /lockers/utilization` (SQL + window functions).**
Occupancy per size, last 24h: `COUNT(*) FILTER (WHERE occupied_by IS NOT NULL)`, grouped by size; talk through what index serves it (none needed at this size; `occupied_by` partial index already narrows). Banking flavor: this is your utilization-report muscle, say so.

**Drill 4 — add a `LockerSize` value + contract ripple.**
Add `EXTRA_LARGE` to the enum: Prisma migration, `locker-size.ts` alphabet, `SIZE_RANK`, schema enum, web chooser options, error messages. The *lesson to narrate*: type-safety turns a scary cross-cutting change into a compiler-guided checklist — the generated OpenAPI types fail the web build until it's updated. That's contract testing in action (see Part 2).

**Drill 5 — write one test for code that has none.**
Pick `crypto-random.ts` or the error mapper; write it test-first. Narrate the choice of level: pure function → unit; adapter → integration with the test DB.

### 1.4 The charge-ledger demo — closing round 1's one concrete "miss"

The panel's only specific product note: *"didn't show how much it cost once the package is picked up."* The feature is built, tested, deployed, and verified live (2026-10-05, locker `72CMTJ`): the retrieval response carries `storageCharge` / `daysCharged` / tier `breakdown`, and the confirmation card renders the ledger (`RetrievePage.tsx` → `ChargeSummary`, asserted in `retrieve.test.tsx`). The gap was the walkthrough, not the app.

**Open round 2 by closing the loop** — this converts the criticism into a verification story:

> "You noted the pickup cost wasn't surfaced. I went back and checked — the retrieval response prices the stay and the confirmation screen renders a tiered ledger. I think the gap was my walkthrough, not the app; let me show it now."

**The 60-second script:**
1. Agent console → store a package → note locker + code.
2. `/retrieve` → enter id + code → submit.
3. **Stop talking while "Locker X is open" lands.** Then walk the ledger: "Storage charge, N days. Tier 1 covers days 1–5 at the base rate; a stay past day 5 adds tier-2 rows at 2X; day 11+ at 3X. Total is the API's number — the SPA never recomputes a charge (AD-10)."
4. One-clock kicker: "Both timestamps come from Postgres — mixing the JS clock into `retrievedAt` could tip an exact 24h stay into a second day."

**The long-stay artifact:** a just-stored SMALL package always shows 1 day / 10 units — flat. A demo package stored today gets richer daily (6+ days → tier 2 appears, 11+ → all three tiers), and a MEDIUM demo (15/day) shows size pricing immediately. Store one of each now and retrieve *those* live if round 2 is late enough; otherwise demo fresh and narrate the tier table from the 1-day ledger.

**Shipped since round 1 (2026-10-05) — the follow-up this section motivated, now size-based end to end:** `GET /pricing` serves the rate card as one fully-priced block per size (`pricing_config` fee × the domain's `PRICING_TIERS` multipliers — the same table `charge` prices by), and the UI shows all three blocks in both flows: under the agent's store form and on the customer's pickup form (`StorageRates`, numbers verbatim from the API, AD-10). Retrieval prices from the same table by locker size (`RetrievePackage` → `PricingConfigRepository`), with `STORAGE_FEE_BASE` demoted to a missing-row fallback so a config gap can never fail a pickup. Suite still 249 (domain 45 · api 117 · web 87). **The round-2 line:** "After the feedback I verified the charge ledger was live, found the real gap was that no rate card existed before pickup, shipped `GET /pricing` as a vertical slice — then did the size-based pricing extension for real: a `pricing_config` table seeded in its own migration, a repository port the use case reads at retrieval time, and the rate card plus every charge now keyed off locker size. Changing a price is a DB row, not a deploy." Walk that diff file by file — it *is* Drill 1, shipped.

### 1.5 Warm-up protocol on the day

- 60–30 min before: open the repo, `⌘P` through the file map once, run `npx pnpm@12.4.1 test` once (DB on 55432 up) so the suite is green in your head.
- Have ready: README, `package-repository.ts`, `storage-pricing.ts`, `pickup-code.ts`.
- Know your numbers: **237 tests = 41 domain · 113 api · 83 web**; `FOR UPDATE SKIP LOCKED`; `P2002`/`P2034`; `MAX_TRANSACTION_ATTEMPTS = 3`; pickup alphabet 6 chars ~1/887M collision space.

---

## Part 2 — Testing concepts (the vocabulary gap)

Map every concept to a real file in your repo. Abstract definitions are what sank round 1; "here's where mine lives" is what closes round 2.

### 2.1 The levels, in your repo

| Level | Definition | Where in Everest | Count |
|---|---|---|---|
| **Unit** | One pure unit, no I/O, milliseconds | `packages/domain/test/*` — pricing tiers, pickup alphabet, allocation ranks | 41 |
| **Integration** | One real collaborator (here: Postgres) behind one adapter | `apps/api/test/package-repository.retry.test.ts` — P2002/P2034 retry behavior against the real DB | (within the 113) |
| **Component (API)** | The whole service booted, HTTP in → JSON out, real DB | `apps/api/test/pickups.test.ts`, `store-refusal.test.ts`, the concurrency suites — Fastify `app.inject` + real Postgres on `TEST_DATABASE_URL` | 113 |
| **Component (web)** | One UI piece rendered, user-centric queries, network faked at the client seam | `apps/web/src/*.test.tsx` — Testing Library + jsdom, `client.test.ts` fakes fetch | 83 |
| **Contract** | Verifies two systems agree on the interface, not the behavior | `apps/api/test/openapi.test.ts` (provider side) + `schema.d.ts` generated from the API's OpenAPI into the web build (consumer side) | — |
| **E2E** | Both apps, real browser, real deploy path | **Deliberately absent** — next thing I'd add: Playwright against the Render stack, ~5 happy-path journeys | 0 (own it) |

**The line to deliver:** "My pyramid is anchored at the component level: domain logic is pure so it earns cheap unit tests, and everything meaningful — transactions, locking, validation — is proved by booting the real app against a real Postgres, truncated per test. The web fakes exactly one thing, the fetch boundary, because everything below it is the API's contract, not the UI's business."

### 2.2 Contract testing — the one they named

- **Problem it solves:** consumer and provider are deployed by different people; each can break the other while all their own tests stay green.
- **Two flavors:**
  - *Schema contracts* (what Everest does): the API publishes an OpenAPI document; `openapi.test.ts` pins that the served document matches expectations; the web's types are **generated** from that same document (`openapi-typescript`), so a breaking change fails the web *build*. Cheap, one provider, few consumers.
  - *Consumer-driven contracts* (Pact): each consumer's test run records the exact requests+expectations it makes (the "pact"); the provider replays every pact in CI and fails if it would break a consumer. The win: you only maintain the parts of the API people actually use, and you can delete fields fearlessly because absence of usage is *proven*.
- **When you'd reach for Pact here:** multiple consumer teams (a mobile app, a partner integration) or independent deploy cadences. One SPA + one API = generated types is the right weight; Pact would be ceremony.
- **Contract vs E2E:** contract tests give you "these two systems still agree" *without* standing both up together — that's why they scale when E2E doesn't.
- **Broader contracts:** DB migrations vs entity code, event schemas (schema registry + compatibility modes in banking), even `check-boundaries.mjs` is an *architecture contract* — the repo tests its own layering (nothing skips a hexagonal layer). That's a distinctive answer; use it.

### 2.3 Component testing — the nuance that reads senior

- Kent C. Dodds' framing: a "component" is the thing your test is about; for the API that's the whole app, for the web it's a page/flow. The unit of *behavior*, not of *code*.
- Testing Library principle you already follow: **query the way the user sees** (role, text), not implementation (`data-testid`-free where possible); assert what's rendered, not state internals.
- jsdom fakes the browser; if a bug lives in real-browser behavior (layout, focus quirks — you have `usePageFocus.ts`), jsdom can't catch it → that's the Playwright gap again. Consistent story: you know exactly where your suite stops.

### 2.4 Coverage — the honest position

- Line/branch vs *assertion quality*: 100% line coverage with weak asserts is theater. What matters: every **outcome path** exercised — your three calm retrieval errors are three tests, not one `catch`.
- Where you insist on 100%: pure domain (cheap, deterministic) and **boundary code** (validation, adapters) — that's where production incidents live.
- **Mutation testing** (Stryker): flips `>=` to `>`, `&&` to `||` and checks a test dies — the only real measure of assertion strength. "I'd run Stryker on `storage-pricing.ts` before trusting its coverage number."
- Boundary tests as coverage-adjacent: `__fixtures__/boundary-violation.fixture.ts` + the CI check — you test that the *architecture* holds, which coverage can't express.
- The concurrency proofs (`concurrency-mixed`, `concurrency-parallel-store`) are the answer to "what's your most valuable test?": true `Promise.all` racing against real Postgres, asserting exactly one winner — a test most suites never write because it requires the real engine.

### 2.5 "How would you test X?" — the reusable recipe

1. **Classify the unit** (pure / adapter / component / boundary between systems).
2. **Pick the level** where the risk actually lives — DB bug can't be caught by a mock; pricing math doesn't need a server.
3. **Name the outcome paths** incl. failure + concurrency before writing anything.
4. **Fake exactly one seam** (the boundary furthest from the risk).
5. Say what you'd *deliberately not* test and why (E2e breadth, real-clock timing flakiness — you took `SELECT now()` partly to keep time testable/consistent).

---

## Part 3 — DB & architecture depth (your 11 years, on the hook)

### 3.1 Postgres — questions your own code answers

**"Why READ COMMITTED and not SERIALIZABLE?"**
Correctness comes from explicit row locks (`FOR UPDATE`) + compare-and-swap (`updateMany ... where occupiedBy IS NULL`, count must be 1), not from isolation level. SERIALIZABLE would abort-conflict broadly and force retry machinery everywhere; we confine contention to the one hot row and get parallel-store safety from `SKIP LOCKED`. Rule: *pick the weakest isolation your locking discipline makes correct* — cheaper and easier to reason about.

**"Why FOR UPDATE SKIP LOCKED on the candidate scan?"**
Without it, parallel stores queue on the same top-ranked free locker — a lock convoy where N-1 transactions wait then fail. With it, each store skips rows somebody already holds and takes the *next* free locker. Classic job-queue pattern; same answer for "how would you build a work queue in Postgres?"

**"Two customers enter the same code simultaneously?"**
Both reach the locked join; one wins the `FOR UPDATE`; the loser *blocks*, then — READ COMMITTED re-evaluates the predicate after the wait — the join's `status='STORED'` no longer matches, it falls to the outcome branch and returns `LOCKER_EMPTY`. No retry needed, no double retrieval. (Walk them through `retrieveWithin` line by line — this is your showpiece.)

**"Why read the clock from Postgres (`SELECT now()`)?"**
`storedAt` is written by Postgres `default(now())`; mixing the JS clock in for `retrievedAt` lets ms of skew tip an exact-24h stay into day 2. One clock for both endpoints. `now()` is transaction-start and constant within the tx — also the right choice for audit consistency.

**"Your indexes?"**
PKs; plus two **partial unique indexes** from the migrations: `locker(occupied_by) WHERE occupied_by IS NOT NULL` — one package per locker as a *schema fact*, and `stored_package(pickup_code) WHERE status='STORED'` — pickup codes unique only among live packages, so history never exhausts the code space. Partial indexes: smaller, and they encode the actual invariant.

**"When do you drop to `$queryRaw`?"**
Prisma's fluent API can't express row locks. ORM for shape, SQL for semantics. Also: window functions, `FILTER (WHERE …)` aggregation, CTEs, `ON CONFLICT` upserts.

**Indexing depth you should keep loaded:** B-tree (equality + range, leftmost-prefix on composites), GIN (jsonb, full-text, arrays), **GiST (PostGIS — your GIS story)**, covering indexes (`INCLUDE`), why `SELECT *` defeats index-only scans, `EXPLAIN (ANALYZE, BUFFERS)` before/after habit, connection pooling (PgBouncer transaction mode; Prisma's pool per instance — N app pods × pool = surprise; that's a real banking-incidents story slot).

**"Prisma trade-offs?"**
Typed client + migrations as reviewable files (we use `migrate deploy`, never `db push`, in prod — AD-8). Costs: lock-in to its expression power (raw escape hatch), client-side joins temptation → N+1 if careless, interactive transactions hold a connection (keep them short — ours is 3 statements, 5s timeout).

### 3.2 Architecture — defend hexagonal without sounding academic

**"Why ports & adapters on a three-table app?"**
Honest answer: at this size it's the upper bound of justified ceremony, and I chose it deliberately — the assignment's whole risk was the transaction/retrieval semantics, and isolating them behind `PackageRepository` meant I could prove concurrency against the real DB while keeping use cases pure and trivially testable. On a CRUD-only service I'd happily run route → Prisma directly. *Pattern weight follows change-risk, not fashion.*

**"Repository pattern — isn't it redundant with Prisma?"**
Prisma is a data-access library, not a *seam*. The port hides: which engine, transaction boundaries, retry policy, lock strategy. Evidence it pays: the use case reads as business rules only (`retrieve-package.ts` has zero DB vocabulary), and I swapped locking approaches inside the adapter without touching callers.

**Banking-flavored set pieces (have one story each, STAR, 60s):**
- **Idempotency:** payment APIs keyed by client-supplied idempotency key + unique index, not "hope." Map directly to your pickup-code unique constraint.
- **Reconciliation:** never trust one system's ledger; nightly/async checks, append-only event log, diffs triaged. Slot your real project here.
- **Audit:** state changes as facts with actor+time (your `stored_at`/`retrieved_at` + who'd extend to `agentId`).
- **GIS:** PostGIS, GiST spatial indexes (`ST_DWithin` on geography), why "lat/lng B-tree" fails for radius queries, coordinate-system bugs (the classic: degrees vs meters). Link to lockers: *nearest-available-locker is a `ST_DWithin` query* — volunteering that bridges their world and yours.

**Design patterns you can ground, not recite:** strategy (pricing policy injection), factory (`nextPickupCode` injected generator — that's why collision-retry works), adapter (Prisma/HTTP layers), value objects in domain (LockerId, PickupCode — parse, don't validate).

**"Monolith vs services":** start modular-monolith (this repo: `packages/domain` enforced by CI boundary checks); split when *team* scaling or deployment cadence demands it, not for resume reasons. Split along seams you already enforced — the boundaries check makes future extraction cheaper.

---

## Part 4 — Random problem statement (the method + 3 rehearsals)

**The method — say it before solving anything:**
1. Restate the problem in your own words (30s).
2. Clarify 2–3 constraints: scale? consistency vs latency? read/write ratio? who calls it?
3. Worked example on the whiteboard/editor — inputs → expected output.
4. Brute force first, out loud, with complexity. Then optimize the bottleneck you just identified.
5. Edge cases + concurrency + failure paths *before* they ask.
6. State what you'd test and at which level (ties back to Part 2 — full-circle moment).

**Rehearsal A — rate limiter for `POST /pickups` (5/min per customer).**
Token bucket per key; single instance = in-memory Map + interval refill. Multi-instance → shared Redis (`INCR` + `EXPIRE`, or Lua for atomic check-and-decrement). Discuss: clock drift, memory bounds (LRU eviction), 429 + `Retry-After`, why middleware order matters. Test: component level with parallel requests.

**Rehearsal B — design an append-only locker event log.**
`locker_event(id, locker_id, type, actor, at, payload jsonb)`; current state = replay or projection table maintained transactionally with the event insert (outbox pattern). Why: audit (banking reflex), debugging, analytics. Query patterns → index on `(locker_id, at)`; retention/archival story.

**Rehearsal C — SQL exercise: daily revenue + average stay per size, last 30 days.**
`stored_package` self-join of `stored_at`/`retrieved_at`, `GROUP BY size, date_trunc('day', retrieved_at)`, `FILTER` for revenue vs counts, window function for 7-day rolling average. Practice writing this cold — banking reporting is your home turf, this must be flawless.

---

## Part 5 — Day-of checklist

- [ ] Drills 1–5 completed at least once, timed, narrated aloud (spread over 2–3 sittings, not crammed)
- [ ] **Long-stay demo package stored** (locker + code saved somewhere safe) — ledger gets richer every day it sits
- [ ] Charge-ledger 60-second script rehearsed (§1.4) — the round-1 "miss" opener
- [ ] File map recited from memory
- [ ] The four showpiece numbers: 237 = 41/113/83 · SKIP LOCKED · P2002/P2034 · 6-char ~1/887M
- [ ] One STAR story each: idempotency (banking), spatial index (GIS), production incident you caught via observability, and one honest failure
- [ ] "What I'd add next" rehearsed: Playwright E2E against Render, Stryker on domain, Pact if a second consumer appears, metrics endpoint (p99 latency per route) — shows the ceiling is visible, not reached
- [ ] Warm-up: repo open, tests green once, `⌘P` tour
- [ ] Slow is fine; silent is not. Narrate every search, timebox every exploration

**The frame for the whole round:** round 1 proved you can *design*; round 2 proves you can *execute inside a living codebase and reason about how it's proven*. Every answer should end in a file, a test, or a query — concrete beats abstract, every time.
