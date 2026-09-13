---
title: 'Story 1.1: Monorepo scaffold with a running, health-checked API'
type: 'feature'
created: '2026-09-13'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'NO_VCS'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Nothing exists yet — no repo, no workspace, no runnable service. Every feature story needs a substrate that builds, tests, lints, and runs.

**Approach:** Scaffold the pnpm + Turborepo monorepo per the architecture spine's structural seed (Fastify API with `GET /health`, Prisma wired with an empty versioned schema, docker-compose Postgres, boundary lint, Vitest smoke test) and initialize the git repository with the first commits.

## Boundaries & Constraints

**Always:** stack pins from the spine (TypeScript 7.0.2, Node 24 LTS, Fastify 5.12.4, TypeBox 1.3.30, Prisma 7.10.0 — never 8.x RC, PostgreSQL 18, Vitest 5.0.0, Turborepo 2.10.12, pnpm 12.4.1); `@locker/domain` has zero runtime dependencies; env vars validated once at boot (`DATABASE_URL` required, `PORT`, `STORAGE_FEE_BASE` default 10); kebab-case files, PascalCase types; per-story commits from here on (NFR6).

**Never:** no Locker/StoredPackage models yet (tables arrive with the stories that need them — schema stays empty but versioned); no business logic, no UI setup (Epic 4 owns `apps/web`/`packages/ui` internals — placeholders only); no auth; no raising isolation levels; no module-level mutable state.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Health check | `GET /health` on running API | `200 {"status":"ok"}` | N/A |
| Missing env var | boot without `DATABASE_URL` | process exits non-zero | one clear config error naming the variable; no partial boot |
| Boundary violation | source file in `packages/domain` or `apps/api/src/application` importing `fastify`, `@prisma/*`, or `@sinclair/typebox` | lint fails the build (non-zero exit), proven by a committed violating fixture | N/A |

</frozen-after-approval>

## Code Map

- Greenfield — no existing code. Authoritative shapes: `ARCHITECTURE-SPINE.md` (structural seed, AD-2, AD-8, stack table) and `epic-1-context.md`.
- `pnpm-workspace.yaml` + root `package.json` + `turbo.json` -- workspaces `apps/*`, `packages/*`; pipelines `build`, `test`, `lint`, `dev`, `db:migrate`.
- `apps/api/src/adapters/http/app.ts` -- Fastify app factory (no listen); enables `app.inject()` tests.
- `apps/api/src/config/env.ts` -- single boot-time env parse/validate; the only place env is read.
- `apps/api/prisma/schema.prisma` -- datasource + generator only; first empty migration committed so `db:migrate` is real from day one (AD-8).

## Tasks & Acceptance

**Execution:**
- [x] `pnpm-workspace.yaml`, `package.json`, `turbo.json` -- define workspaces and pipelines -- substrate per spine
- [x] `packages/domain/` -- placeholder `@locker/domain` with **empty dependencies block** -- makes AD-2 physically true from the first commit
- [x] `packages/ui/`, `apps/web/` -- minimal placeholder package.json each -- pipelines green without Epic-4 scope
- [x] `apps/api/src/config/env.ts` -- parse + fail-fast validate env -- boot-safety AC
- [x] `apps/api/src/adapters/http/app.ts` + `routes/health.ts` -- app factory registering `GET /health` returning `{"status":"ok"}` -- first route
- [x] `apps/api/src/index.ts` -- build env, listen, log startup -- entrypoint
- [x] `apps/api/prisma/schema.prisma` + initial migration + `db:migrate` turbo task -- versioned empty schema -- AD-8
- [x] root `eslint.config.js` -- flat config with `no-restricted-imports` zones (domain/application may not import fastify, @prisma/*, @sinclair/typebox) -- AD-2 enforcement
- [x] boundary-fixture + check script or test that asserts lint **fails** on the fixture -- proof of enforcement
- [x] `apps/api/test/health.test.ts` -- Vitest: `app.inject({method:'GET',url:'/health'})` → 200 + exact body -- smoke AC
- [x] `docker-compose.yml` + `.env.example` -- `postgres:18-alpine` + api service -- local run AC
- [x] git: `init` (branch `main`), `.gitignore` (node_modules, .env, dist, coverage), logical initial commits -- NFR6 starts

**Acceptance Criteria:**
- Given a fresh clone with Docker running, when `docker compose up` then Postgres 18 is reachable and `GET /health` returns `200 {"status":"ok"}`.
- Given the workspace, when `pnpm turbo run build test lint`, then all pipelines pass across all four workspaces.
- Given the end of this story, when work begins on 1.2, then the git repo exists with this scaffold committed.

## Design Notes

App factory over side-effect server: `app.ts` exports `buildApp()` without listening; `index.ts` is the only caller of `listen()`. Tests use Fastify's `inject` — no ports, no race flake. Boundary rule shape (example):

```js
// eslint.config.js — zone example
{ files: ['packages/domain/src/**', 'apps/api/src/application/**'],
  rules: { 'no-restricted-imports': ['error',
    { paths: ['fastify', '@sinclair/typebox'], patterns: ['@prisma/*', 'prisma/*'] }] } }
```

## Verification

**Commands:**
- `docker compose up -d postgres` -- expected: healthy Postgres 18 container
- `pnpm install && pnpm turbo run build test lint` -- expected: all pipelines green
- `pnpm --filter @locker/api dev` then `curl -s localhost:3000/health` -- expected: `{"status":"ok"}`
- boundary check (script/test from tasks) -- expected: lint exits non-zero on the committed violating fixture
- `DATABASE_URL= pnpm --filter @locker/api dev` -- expected: non-zero exit naming `DATABASE_URL`
- `git log --oneline` -- expected: scaffold commits on `main`

## Implementation Notes

- **Baseline correction:** the repo pre-existed this story (BMAD tooling, docs, planning artifacts already committed; remote `github.com:AhammadAliPK/smart_package_everest`). True story diff = `d4b3843..0683530` (5 commits). The spec's `baseline_commit: NO_VCS` was stale from session-start metadata; preserved per workflow rule, corrected here.
- **Stack corrections discovered:** `@sinclair/typebox@1.3.30` does not exist (real latest 0.34.52); the type provider's real package name is `@fastify/type-provider-typebox` (6.1.0 correct, the hyphenated spelling 404s). Spine + epics stack pins updated 2026-09-13. Story 1.1 needed neither; Story 1.2 installs them.
- typescript-eslint does not support TypeScript 7 (peer `<6.1.0`, throws on load — typescript-eslint#10940). Lint parses TS via `@babel/eslint-parser` (all enabled rules are syntax-only); dead code is enforced type-aware by `tsc` (`noUnusedLocals`/`noUnusedParameters`). Revisit when TS 7 support ships.
- Toolchain: local machine has Node 22.13 + broken corepack 0.30 (stale signing keys) — use `npx pnpm@12.4.1`; `.nvmrc`/`engines`/Docker pin Node 24. Compose exposes Postgres on `${POSTGRES_PORT:-5432}` (this Mac runs its own Postgres on 5432); default unchanged on fresh clones.
- Prisma 7: connection URL lives in `prisma.config.ts`, not the schema; `.env` auto-load only via dotenv in dev.
- Dockerfile runtime stage intentionally ships dev dependencies — slimming is a Story 5.1 optimization.
- `_bmad-output/` artifacts are tracked in this repo but kept out of the story's code commits; they land in one story-close commit (spec, review triage, deferred backlog, sprint sync).
- **Verification:** orchestrator independently re-ran `turbo run build test lint` → 13/13 (boundary check uncached, both fixtures rejected with `no-restricted-imports`). Implementer additionally verified live: compose stack healthy, `prisma migrate deploy` idempotent, `curl :3000/health` → `200 {"status":"ok"}`, `DATABASE_URL=` boot exits 1 naming the variable.

## Review Triage Log

Layers run: blind-hunter, verification-gap, edge-case-hunter — all three reported. User decision (2026-09-13): feature development and deploy come first; no patch loop now. Findings are triaged below — verified-real items go to `deferred-work.md` for a post-deploy hardening pass, and the two items that would block the very next story are folded into the Story 1.2 plan instead.

| # | Layer | Finding | Verdict | Route |
|---|-------|---------|---------|-------|
| 1 | blind-hunter | `parseEnv` accepts non-decimal integer forms (`PORT=0x50`, `PORT=1e2`) via bare `Number()` | low — real laxness, negligible everyday harm; strict `/^\d+$/` check is the direct eventual fix | defer |
| 2 | blind-hunter | avoidable `databaseUrl as string` cast in `parseEnv` | low — guarded by the required-check invariant + comment; no runtime effect | rejected (cosmetic) |
| 3 | blind-hunter | no README accompanies the diff | false — README is Story 5.2's deliverable; this spec's Never boundary excludes it | rejected (intent excludes) |
| 4 | blind-hunter | no CI workflow runs the pipelines | low — real gap; spine's Deferred already places CI out of v1 | defer |
| 5 | blind-hunter | `turbo.json` declares `dist/**` build outputs but `@locker/web` placeholder emits none → cached-build warnings | low — warning noise only | defer |
| 6 | blind-hunter | `@locker/web` placeholder scripts exit 0 unconditionally, indistinguishable from a broken build | false — spec mandates green placeholders ("pipelines green without Epic-4 scope"); each script echoes its placeholder status | rejected (by design) |
| 7 | blind-hunter | Dockerfile `npm install --global turbo` unpinned-drift risk; `allowBuilds` key name worth verifying | low — global installs are version-pinned; `allowBuilds` empirically effective (prisma engines downloaded → `migrate deploy` succeeded against compose Postgres) | defer (Story 5.1 image hardening) |
| 8 | verification-gap (pre-verified) | boot fail-fast contract (`index.ts` env-first ordering, `exit(1)`, message naming the variable) exercised by no test | medium — verified regression gap: breaking ordering or the exit code leaves `turbo build test lint` green; filed disposition was patch (spawn-the-entrypoint test) | defer (user direction: verification pass after feature build) |
| 9 | verification-gap (pre-verified) | Docker image build + `prisma migrate deploy` + compose healthcheck path has zero automated verification | medium — verified; compose path verified live once, nothing re-runs it | defer (DB-backed smoke/CI after deploy) |
| 10 | verification-gap (pre-verified) | no `prisma generate` step anywhere; first import of the generated client will fail `tsc` | medium — verified coming blocker; first importer is Story 1.2 | handled in Story 1.2 spec (wire `prisma generate` into the build pipeline) |
| 11 | verification-gap (pre-verified) | `apps/api/test/**` never type-checked (tsconfig includes only `src`; babel lint is syntax-only) | low — verified; test type errors surface at Vitest runtime or not at all | defer |
| 12 | edge-case-hunter | `DATABASE_URL` never shape-checked — any non-empty string passes boot, failure surfaces later inside Prisma | low — real; spec matrix only requires missing-var handling; Prisma's own error names the URL | defer (env-hardening bundle) |
| 13 | edge-case-hunter | env.ts comment claims "ONLY place process.env is read" but `prisma.config.ts` also reads it (CLI config, by Prisma 7 design) | low — true claim mismatch; comment overstates the invariant | defer (comment fix) |
| 14 | edge-case-hunter | `pnpm dev` does not load `.env` — dotenv is imported only by `prisma.config.ts`, so `src/index.ts` boots with an empty env despite a `.env` file | medium — verified true; the documented dev command fails with `.env` present | handled in Story 1.2 spec (wire dotenv/env-file into the dev/test path) |
| 15 | edge-case-hunter | no SIGTERM/SIGINT handler — in-flight requests dropped, Fastify onClose never runs (compose stop, Render spin-down) | low — real; acceptable for v1, matters at deploy | defer (Story 5.1) |
| 16 | edge-case-hunter | `console.error` + immediate `process.exit(1)` can truncate piped stderr | low — set `process.exitCode` and return instead | defer (boot-test bundle) |
| 17 | edge-case-hunter | transient `migrate deploy` failure at container start → container stays down (no restart policy) | low — operational; empty-DB migrate is fast today | defer (Story 5.1) |
| 18 | edge-case-hunter | `DATABASE_URL` unset in container → opaque Prisma CLI error instead of a message naming the variable | low — CMD guard (`: ${DATABASE_URL:?}`) is the fix | defer (Story 5.1) |
| 19 | edge-case-hunter | api healthcheck has no `start_period`; migrations consume the 60s retry budget | low — real; budget ample for the single empty migration | defer (Story 5.1) |
| 20 | edge-case-hunter | `PORT` changeable via env but healthcheck URL, ports mapping, and `EXPOSE` stay hardcoded to 3000 | low — compose pins PORT=3000, so consistent in practice | defer (Story 5.1) |
| 21 | edge-case-hunter | boundary lint `paths` match exact module names — `fastify/x` / `@sinclair/typebox/y` subpath imports pass undetected | low — verified hole in AD-2's mechanical proof; dev-time only | defer (add `'fastify/*'`, `'@sinclair/typebox/*'` patterns) |
| 22 | edge-case-hunter | `check-boundaries.mjs` `spawnSync` has no timeout — a hung ESLint child blocks lint forever | low — unlikely; one-line `timeout` option | defer |
| 23 | edge-case-hunter | env tests miss boundary cases (`PORT=0`/`65536`, whitespace-only values) | low — verified gaps; logic itself correct | defer (env-hardening bundle) |

No `intent_gap` or `bad_spec` entries — no loopback. Survivors recorded in `deferred-work.md`; item 10 is folded into the next story's plan.
