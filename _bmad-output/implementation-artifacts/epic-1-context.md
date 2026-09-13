# Epic 1 Context: Locker Station & Package Storage

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Build the complete "Level 1" system as a pure REST API: delivery agents can create lockers of any size, see every locker's live availability, and store a package — which the system places in the smallest locker that fits, handing back a pickup code the customer will later use. This epic also creates the substrate everything else lands in: the monorepo scaffold, the health-checked bootable service, and the git repository with per-story commits. It is standalone-complete on its own; Epic 2 retrieves what it stores, Epic 3 proves its locking transaction under concurrency, and Epic 4 puts a UI on its endpoints.

## Stories

- Story 1.1: Monorepo scaffold with a running, health-checked API
- Story 1.2: Create lockers of a chosen size
- Story 1.3: View the locker station with live availability
- Story 1.4: Store a package in the smallest fitting locker with a pickup code
- Story 1.5: Gracefully refuse storage when no suitable locker exists

## Requirements & Constraints

**Create lockers** — accept a size of SMALL, MEDIUM, or LARGE; respond with the locker's identifier, size, and `occupied: false`. Invalid sizes (unknown value, wrong case, missing) return 400 with the standard error envelope and create nothing.

**List lockers** — the response shape is a frozen API contract: exactly `{"lockers":[{"id","size","occupied"}]}`, ordered by id, with `occupied` as the only availability field and no per-locker package detail. An empty station returns an empty list, never a 404.

**Store a package** — the agent declares the package size (customer reference optional). The system assigns the *smallest locker that fits*: size rank SMALL < MEDIUM < LARGE, ties broken by lowest locker id. A SMALL package may occupy a LARGE locker when nothing smaller is free — exhaustion is per-fitting-size, never blocking on exact match. Success returns the assigned locker id plus the pickup code.

**Pickup codes** — 8 characters, uppercase alphanumeric excluding `0/O/1/I`, unique among unretrieved packages, bound to exactly one package + locker pair, generated only on store and never regenerated.

**Store bookkeeping** — record the exact storage time (`storedAt`); the locker flips to occupied. `storedAt` is consumed by Epic 2's pricing, so it must be captured now even though nothing displays it yet.

**Refusal** — when no locker fits, return 409 `NO_SUITABLE_LOCKER` with zero side effects: no package row, no locker state change.

**Error contract** — every non-2xx uses one envelope `{"error":{"code","message"}}` with the stable code set (`NO_SUITABLE_LOCKER`, `INVALID_PICKUP_CODE`, `LOCKER_NOT_FOUND`, `LOCKER_EMPTY`, `VALIDATION_ERROR`, `INTERNAL_ERROR`); codes are never renamed, even the ones this epic doesn't trigger yet.

**Identity** — a locker has exactly one identifier: its cuid, always carried as the field named `lockerId`. No human display code exists in v1.

**Tests** — happy paths and every invalid scenario covered at both levels: domain/use-case logic unit-tested as pure functions, routes integration-tested against the real status codes and exact response shapes.

## Technical Decisions

- **Hexagonal layering, mechanically enforced.** `@locker/domain` (entities, allocation rule, pickup-code generation — pure TypeScript, zero runtime dependencies) ← `apps/api/src/application/` (use cases + repository ports) ← `apps/api/src/adapters/` (Fastify routes + TypeBox schemas; Prisma repositories). Nothing in domain or application imports fastify, @prisma, or typebox; ESLint restricted-import zones (or dependency-cruiser) wired into `turbo lint` make violations fail the build.
- **Contract-first HTTP.** One Fastify service; every route declares TypeBox request/response schemas; interactive OpenAPI docs served at `/docs`.
- **Store is one atomic transaction.** Select free fitting lockers `ORDER BY size rank, id` `FOR UPDATE SKIP LOCKED` via `$queryRaw` (the fluent API can't express row locks), occupy the first, create package + code — commit or roll back atomically. READ COMMITTED only; raising isolation is forbidden — correctness comes from row locks and CAS updates. A Prisma write conflict retries up to 3 times, then surfaces `INTERNAL_ERROR`. This transaction is the mechanism Epic 3 will prove under load.
- **State transitions live only in application use cases.** HTTP handlers parse/validate/serialize; Prisma repositories are the only code touching tables. Every occupancy mutation is a compare-and-swap or row lock — never a blind boolean write.
- **PostgreSQL is the only durable state.** Via Prisma; no module-level mutable stores. One package per locker is enforced by a partial unique index in the schema, not just code. Schema changes ship only as `prisma migrate` files committed with the story that needs them.
- **Env config validated once at boot** (`DATABASE_URL`, `PORT`, `STORAGE_FEE_BASE`): missing or malformed values fail fast with one clear error naming the variable — no partial boot. `GET /health` returns `200 {"status":"ok"}`.
- **Conventions:** kebab-case files, PascalCase types, singular PascalCase Prisma models with snake_case columns, cuid IDs, ISO-8601 UTC timestamps, Fastify's built-in JSON request logging, no auth in v1.
- **Stack pins (do not drift):** TypeScript 7.0.2 · Node 24 LTS (`node:24-alpine`) · Fastify 5.12.4 · TypeBox 1.3.30 (+ type provider 6.1.0) · @fastify/swagger 9.8.1 + swagger-ui 6.1.1 · Prisma 7.10.0 (do not take the 8.x RC) · PostgreSQL 18 (`postgres:18-alpine`) · Vitest 5.0.0 · Turborepo 2.10.12 · pnpm 12.4.1.
- **Monorepo & local runtime:** pnpm workspaces + Turborepo with pipelines `build`, `test`, `lint`, `dev`, `db:migrate`; workspaces `apps/api`, `apps/web`, `packages/domain` (`@locker/domain`), `packages/ui` (`@locker/ui`) — web and ui are placeholders in this epic. Docker-compose (postgres + api) serves local dev and the Vitest suites; suites run against the compose Postgres with per-suite isolation (truncate vs transaction-rollback is each story's call).
- **Git discipline starts here.** The repo is initialized in Story 1.1 and every subsequent story commits in TDD order (tests before implementation) — the commit history itself is an evaluation criterion.

## Cross-Story Dependencies

- **Story 1.1 is the substrate:** every later story lands inside the scaffold it creates (pipelines, env validation, migration wiring, git repo, boundary lint gate proven by a violating fixture).
- **1.2 → 1.3:** the list endpoint needs the Locker schema/migration and data to list. **1.2 + 1.1 → 1.4:** storing requires lockers to fill and the migration pipeline; 1.4 introduces the StoredPackage model, pickup codes, and the allocation transaction. **1.4 → 1.5:** the refusal is the allocation rule's "nothing fits" outcome mapped to a 409.
- **Outbound:** Epic 2 depends on 1.4's stored packages (`pickupCode`, `storedAt`); Epic 3 reproves the `FOR UPDATE SKIP LOCKED` transaction built in 1.4; Epic 4's UI consumes exactly these endpoints and their frozen contracts.
