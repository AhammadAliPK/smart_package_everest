# Everest Lockers

A smart-package locker station. Delivery agents drop packages into the smallest
fitting locker; customers pick them up with a **locker ID + pickup code**; storage
bills in tiered 24-hour days. One API, one SPA, one Postgres.

`Node 24` · `pnpm 12.4.1` · `TypeScript 5.9` · `237 tests` · `live on Render`

---

## Table of contents

1. [Live demo](#live-demo)
2. [Tech stack](#tech-stack)
3. [Monorepo map](#monorepo-map)
4. [Scaffolding & code generation](#scaffolding--code-generation)
5. [Run locally](#run-locally)
6. [Testing](#testing)
7. [API surface](#api-surface)
8. [Approach, level by level](#approach-level-by-level)
9. [Design decisions](#design-decisions)
10. [Assumptions, trade-offs, future work](#assumptions-trade-offs-future-work)
11. [AI-use disclosure](#ai-use-disclosure)

---

## Live demo

| Service | URL |
|---|---|
| Web app | https://everest-web-mi84.onrender.com |
| API | https://everest-api-sxla.onrender.com |
| Swagger UI | https://everest-api-sxla.onrender.com/docs |
| Raw OpenAPI | https://everest-api-sxla.onrender.com/docs/json |

Deployed on Render's **free tier**: services sleep after ~15 min idle and take
30–60 s to wake — a slow first load is expected, not broken. The free Postgres
trial runs through ~2026-10-14.

---

## Tech stack

**API — `apps/api` (`@locker/api`)**

| Tool | Version | Role |
|---|---|---|
| Fastify | 5.12.4 | HTTP server, type-provider integration |
| @sinclair/typebox | 0.34.52 | Request/response contracts — one schema drives validation *and* OpenAPI |
| @fastify/swagger + swagger-ui | 9.8.1 / 6.1.1 | Interactive docs at `/docs` |
| @fastify/cors | 11.3.0 | Cross-origin for the deployed SPA; registered only when `CORS_ORIGIN` is set |
| Prisma + @prisma/adapter-pg | 7.10.0 | Schema, migrations, driver adapter over **PostgreSQL 18** |
| dotenv | 17.4.2 | Env loading (boot + tests) |
| tsx · Vitest | — | Dev runner · 113 tests |

**Web — `apps/web` (`@locker/web`)**

| Tool | Version | Role |
|---|---|---|
| React | 19.3.0 | SPA (chooser / agent console / customer retrieval) |
| react-router | 8.3.1 | Routing + deep links |
| Vite | 8.3.0 | Dev server, prod build |
| Tailwind CSS | 4.3.3 | `@theme` token system from DESIGN.md |
| openapi-typescript | 7.13.0 | **Typed API client generated from the API's real OpenAPI** |
| @fontsource | — | DM Serif Display (display) + Inter Variable (text) |
| Testing Library · jsdom · Vitest | — | 82 component tests |

*TypeScript is pinned to 5.9.3 in `apps/web` only — openapi-typescript needs the
JS compiler API that TS7 native drops.*

**Design system — `packages/ui` (`@locker/ui`)** — Radix primitives
(dialog/select), class-variance-authority, clsx + tailwind-merge, lucide-react.
Presentation-only: no domain knowledge, no fetching.

**Domain — `packages/domain` (`@locker/domain`)** — pure functions, **zero
dependencies**: allocation, pickup-code generation, tiered pricing, locker-ID
generation. Nothing framework-flavoured can leak in (lint-enforced).

**Root tooling**

| Tool | Role |
|---|---|
| pnpm 12.4.1 workspaces | `apps/*` + `packages/*`, approved build scripts for prisma/esbuild |
| Turborepo 2.10 | `build → generate ← export-openapi → test → lint` pipeline (16 tasks) |
| ESLint 10 | Typed linting + **boundary-zone rules** (see below) |
| Docker | Per-app Dockerfiles (API: node prod-deps runner · Web: `nginx:1.27-alpine`) |
| docker compose | Full local stack (postgres + api + web) |
| render.yaml | Blueprint for the live deployment (3 free resources) |
| Node | >= 24 (`engines`) |

---

## Monorepo map

| Path | What lives there |
|---|---|
| `apps/api` | Fastify HTTP adapter, TypeBox contracts, Prisma repositories, use cases |
| `apps/web` | React SPA; `src/api/schema.d.ts` is *generated* (never hand-edited) |
| `packages/domain` | Pure policies: `allocation.ts`, `pickup-code.ts`, `storage-pricing.ts`, `locker-id.ts` |
| `packages/ui` | `@locker/ui` tokens + components (Button, CodeInput, LockerTile, dialogs…) |
| `docs/` | Product source: challenge brief, PRD, DESIGN, EXPERIENCE |
| `_bmad-output/` | Build method: per-epic specs, sprint status, decision log, deferred work |
| `scripts/` | `check-boundaries.mjs` (architecture lint) · `test-report.mjs` (feature report) |
| `render.yaml` · `docker-compose.yml` · `Dockerfile`s | Deployment shapes |

---

## Scaffolding & code generation

**Hexagonal layering, lint-enforced (AD-2).** Zones: `domain` (pure) →
`application` (use cases) → `adapters` (http / db). A committed violating
fixture proves the lint works: domain + application may not import
fastify/typebox/prisma; application may not import adapters.
`npx pnpm@12.4.1 run check:boundaries`

**Contract-first codegen — one source of truth, no drift:**

```
TypeBox schemas ──▶ OpenAPI JSON ──▶ schema.d.ts ──▶ typed api client
   (validation)      (export-openapi)   (generate)      (apps/web)
```

Turbo wires the chain (`web#generate` depends on `api#export-openapi`), so a
schema change propagates end-to-end in one `turbo run build`.

**Prisma** owns the schema; `prisma migrate deploy` runs **on boot** (AD-8) —
the API never serves an unmigrated schema.

---

## Run locally

**Option A — full stack in Docker (fresh clone):**

```bash
cp .env.example .env           # local defaults — no real secrets anywhere
docker compose up --build      # web :8080 · api :3000 · postgres 18
```

Migrations run on boot; open http://localhost:8080.

**Option B — dev mode (hot reload):**

```bash
cp .env.example .env
docker compose up -d postgres
npx pnpm@12.4.1 install                    # npx pnpm@12.4.1: corepack is broken on this machine
npx pnpm@12.4.1 --filter @locker/api db:migrate
npx pnpm@12.4.1 --filter @locker/api dev   # Fastify :3000 — /docs
npx pnpm@12.4.1 --filter @locker/web dev   # Vite :5173 (same-origin proxy)
```

**Environment** (all optional except `DATABASE_URL`):

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | — | Postgres connection string |
| `PORT` | `3000` | API listen port |
| `STORAGE_FEE_BASE` | `10` | Whole-unit base fee per 24 h day (AD-5) |
| `CORS_ORIGIN` | unset | Comma-separated origins; unset = CORS plugin not registered |
| `TEST_DATABASE_URL` | → `DATABASE_URL` | Where integration suites truncate |

---

## Testing

**237 tests** — domain 41 · api 113 · web 83. TDD throughout: commit order
shows test → implementation per story.

```bash
npx pnpm@12.4.1 test              # everything (turbo)
npx pnpm@12.4.1 run test:domain   # or test:api / test:web
npx pnpm@12.4.1 run test:report   # feature-grouped HTML report →
                                  #   test-report/index.html (self-contained, no server)
```

**Concurrency proofs** (Level 3) — the headline tests. True `Promise.all`
fan-out against the real route stack and the real Postgres, no mocks and no
artificial serialization:

| Suite | Race | Proven outcome |
|---|---|---|
| `concurrency-parallel-store` | 8 parallel stores → 3 free lockers | Exactly 3 distinct 201s + 5 `NO_SUITABLE_LOCKER`; the 3 winners hold *distinct* lockers, losers write nothing |
| `concurrency-parallel-store` | 2 LARGE stores → only 1 fitting locker | Exactly one winner — concurrent stores of the same locker never double-assign |
| `concurrency-parallel-store` | 6 parallel stores → 6 lockers | Row-level check: every occupied locker holds a distinct STORED package |
| `concurrency-mixed` | 6 rounds × parallel stores + retrievals | `occupied == STORED` asserted **in the DB** every half-round; freed lockers re-fill the next round |
| `concurrency-mixed` | 2 parallel pickups of the same package | One 200 + one 409 `LOCKER_EMPTY`; exactly one RETRIEVED row |

The mechanism under test: the store transaction scans free candidates with
`SELECT … FOR UPDATE SKIP LOCKED` and CAS-flips `occupied` — parallel stores
serialize on row locks instead of racing check-then-write.

Also notable: design-audit tests read the *shipped* CSS and enforce DESIGN.md
tokens, so the UI can't silently drift from the design system.

---

## API surface

| Method & path | Purpose | Errors |
|---|---|---|
| `GET /health` | Liveness + DB check | — |
| `POST /lockers` | Create a locker (`SMALL/MEDIUM/LARGE`) | `VALIDATION_ERROR` |
| `GET /lockers` | Availability list, ordered by id | — |
| `POST /packages` | Store into the smallest fitting locker → `lockerId` + `pickupCode` | `NO_SUITABLE_LOCKER` 409 |
| `POST /pickups` | Retrieve with id + code → charge ledger | see below |

Every error is one envelope (AD-7): `{"error":{"code","message"}}` — calm codes,
mapped in exactly one place, and the UI never shows raw errors.

| Code | HTTP | Meaning |
|---|---|---|
| `NO_SUITABLE_LOCKER` | 409 | Nothing free fits the requested size |
| `INVALID_PICKUP_CODE` | 404 | Code doesn't match this locker |
| `LOCKER_NOT_FOUND` | 404 | No such locker at this station |
| `LOCKER_EMPTY` | 409 | Already picked up |
| `VALIDATION_ERROR` | 400 | Malformed request |
| `INTERNAL_ERROR` | 500 | Unexpected — logged, not leaked |

Charges (AD-5): days = `ceil(elapsed/24h)`, tiers `1–5×X · 6–10×2X · 11+×3X`
(`X = STORAGE_FEE_BASE`), returned as an itemised breakdown with the
confirmation — computed server-side only.

---

## Approach, level by level

- **Level 1 — allocation.** `pickSmallestFitting` ranks sizes (`SIZE_RANK`) and
  takes the smallest locker the package fits; the store runs in one
  transaction. (`packages/domain/src/allocation.ts`)
- **Level 2 — outcomes & pricing.** Every invalid retrieval is a distinct,
  side-effect-free outcome behind the AD-7 envelope; charges are a pure domain
  policy. (`packages/domain/src/storage-pricing.ts`)
- **Level 3 — concurrency.** The store transaction scans free candidates with
  `SELECT … FOR UPDATE SKIP LOCKED` and CAS-flips `occupied`; parallel stores
  serialize on row locks and never double-assign. Proven by the two suites
  above. (`apps/api/src/adapters/db/`)
- **Level 4 — the SPA computes nothing.** Charges, IDs, codes, errors render
  verbatim from API responses (AD-10); the client does no pricing or validation
  math beyond input hygiene.

---

## Design decisions

- **Hexagonal + boundary lint** — use cases stay framework-free, and the lint
  *proves* it rather than trusting convention.
- **`SKIP LOCKED` + CAS, not check-then-write** — a naive read-check-write
  races; row locks make the smallest-fit scan atomic, retries bounded.
- **AD-9 v1.1 human locker IDs — the honest story.** v1 used a 25-char cuid;
  mid-build the author renegotiated it: IDs are generated 6-char values over an
  unambiguous alphabet (`K7Q4M2` — no 0/O/1/I) and *are* the primary key — no
  surrogate, no second column. Collisions (~1/887M) retry, bounded. A migration
  swapped the PK in place.
- **AD-6 pickup codes** — 8 chars, same unambiguous alphabet; possession =
  retrieval; stored plaintext (stated assumption, see below).
- **AD-8 migrate-on-boot** — deploys are one step and the schema is never stale.
- **AD-10 SPA-computes-nothing** — one pricing implementation, zero client drift.
- **Contract-first types** — TypeBox generates validation, docs, *and* the
  web's typed client from one schema.

---

## Assumptions, trade-offs, future work

**Assumptions:** single station · anonymous customers (possession-based
retrieval, optional free-text `customerRef`) · plaintext pickup codes · a
storage day is 24 h elapsed, ceil'd, partial day bills full · whole-unit fees ·
no SMS/email delivery.

**Trade-offs:** runner-image simplicity over size (slim-down attempted; the two
cold-build fixes cost more than the saved layer — recorded in the 5.1 spec) ·
polling (10 s, pauses when the tab hides) over push · id-as-PK + bounded retry
over surrogate-key simplicity · plaintext codes over hashing (single-station
threat model) · Postgres row locks over an app-level lock manager · free-tier
Render (spin-down) over paid always-on.

**Future:** multi-station · hashed pickup codes · notifications · agent auth ·
CI · the honest backlog in `_bmad-output/implementation-artifacts/deferred-work.md`.

---

## AI-use disclosure

- **Which AI tools were used:** Claude Code (CLI) as the working agent, powered
  by the GLM 5.1 model (Z.ai) via API, driven through the BMAD method —
  spec-driven development where every epic was frozen into a written spec
  before implementation.
- **How they were used:** a planning pipeline (PRD → architecture spine →
  epics → per-epic specs) produced the standing instructions; then per-story
  implementation with tests, each batch approved and verified against its spec.
- **Which portions are AI-assisted:** the overwhelming majority of code and
  test text was AI-drafted under human direction. All product decisions,
  priorities, and mid-build renegotiations (e.g. AD-9 v1.1 human locker IDs)
  were the author's. The author reviewed every diff, made every commit
  personally, and performed the manual smoke testing.
- **Prompts / workflow:** `_bmad-output/implementation-artifacts/` holds the
  per-epic specs (the standing prompts), sprint status, and build handoff log;
  the loop per story was approve → build → verify → human review at spec freeze
  and manual smoke.

The git history is tagged per epic (`epic-1` … `epic-5`) — TDD commit order and
story boundaries are visible in the log.
