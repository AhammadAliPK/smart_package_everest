# Build Handoff — read this first in any new session

Single source of truth for where the Everest build stands. Updated 2026-09-13 ~19:50.

## Process rules (user-set, non-negotiable)

1. **User commits everything.** Agents never `git commit`/`add`/`stash`. Every dispatch ends with a COMMIT PLAN: per-story, test-first order, conventional message + exact paths. Hand it to the user verbatim.
2. **Speed over ceremony.** One dispatch per epic-batch. Full `turbo run build test lint` only at story boundaries. No multi-layer review agents during feature build — orchestrator spot-checks the risky files; everything else goes to `deferred-work.md` (post-deploy hardening pass).
3. **Machine:** pnpm = `npx pnpm@12.4.1` (corepack broken). Compose Postgres 18 already running (`locker-postgres`, host port **55432**; `.env` points DATABASE_URL there). Don't restart Docker. Local Node 22 is fine.
4. One command at a time; no parallel agents; no dev servers/watchers (tests use `app.inject()`).

## Where we are

- **Done:** Epic 1 COMPLETE (all five stories). 1.1 scaffold + 1.2 POST /lockers committed (through `ee00959`). 1.3–1.5 (GET /lockers frozen contract, POST /packages SKIP LOCKED allocation + pickup codes, 409 refusal) verified 14/14 pipelines, 87 tests — **changes sit UNCOMMITTED in the working tree awaiting the user's commits** (13-commit test-first plan was handed over 2026-09-13; spec `spec-1-3-1-5-complete-level-1-storage.md` status done). If the tree still shows 1.3–1.5 files uncommitted, the user hasn't run the plan yet — do not commit, do not reset.
- **Next batches:** Epic 2+3 combined (retrieval 2.1–2.2, charges 2.3, concurrency proof 3.1–3.2) — user prefers DIRECT implementation by the orchestrator (no subagent dispatch) for speed. Then Epic 4 (UI), then Epic 5 (Render deploy + README with AI disclosure — needs the user's Render account).

## Workflow skeleton (bmad-build, compressed)

Per batch: write combined spec from `epics.md` story ACs + spine ADs → one AskUserQuestion approval (freeze) → sync `sprint-status.yaml` (stories → in-progress) → dispatch ONE general-purpose agent with: spec as sole source of truth, machine realities above, the no-commit rule + commit-plan requirement, story-boundary-only full pipeline runs → on return: spot-check risky code (allocation transaction, code gen, error mapping), re-run pipelines once, tick spec tasks + append Implementation Notes + status done, sync sprint-status (done), hand commit plan to user. Specs live in this directory; sprint status in `sprint-status.yaml`; deferred hardening in `deferred-work.md`.

## Key contract reminders (from ARCHITECTURE-SPINE.md, binding)

- GET /lockers items use **`id`** (frozen list contract `{"lockers":[{"id","size","occupied"}]}`, ordered by id); POST responses use **`lockerId`** (AD-9).
- Error envelope AD-7: NO_SUITABLE_LOCKER 409, INVALID_PICKUP_CODE 404, LOCKER_NOT_FOUND 404, LOCKER_EMPTY 409, VALIDATION_ERROR 400, INTERNAL_ERROR 500. One mapper exists (`apps/api/src/adapters/http/error-mapper.ts`), `AppError` carries code+status.
- Pricing (Epic 2): pure domain policy, integer units, days = ceil(elapsed/24h), 1–5×X / 6–10×2X / 11+×3X, X = STORAGE_FEE_BASE (default 10).
- Boundary lint (AD-2) enforced: domain + application zones forbid fastify/typebox/prisma imports; application also forbids adapters. Committed violating fixtures prove it (`scripts/check-boundaries.mjs`).
- Stack pins corrected: @sinclair/typebox **0.34.52**, @fastify/type-provider-typebox 6.1.0, + @prisma/adapter-pg 7.10.0 (Prisma 7 requires a driver adapter).
