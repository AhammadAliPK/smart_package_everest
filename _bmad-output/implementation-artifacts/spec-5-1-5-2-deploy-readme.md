# Epic 5 · Stories 5.1 + 5.2 — Production containers, Render deployment, submission README

**Status:** DONE — 5.1 deployed live (api `everest-api-sxla`, web `everest-web-mi84`, clean-checkout proof passed) · 5.2 README shipped, disclosure verbatim, tags handed to user
**Source:** `_bmad-output/planning-artifacts/epics.md` (Epic 5 ACs) · ARCHITECTURE-SPINE AD-8 (migrate-on-boot), AD-7 (error envelope), AD-9 v1.1 (locker ids) · `deferred-work.md` items explicitly marked "fold into Story 5.1"
**Batch shape:** one dispatch, two stories, one verification cycle at each story boundary. Deploy itself is user-driven (their Render account) against a runbook we prepare and verify live in-session.

---

## Context

Epics 1–4 are done (227 tests green). What stands between the repo and submission: the web app has no Docker image, compose has no web service, the API image carries unhardened container ops (deferred since 1.1), the deployed story is empty, and the repo has no README — the single most-graded artifact after the git history.

**Deployment shape (frozen by epics.md 5.1): two services on Render.** API = existing Fastify Docker image; web = static build served by nginx. Consequences we must wire:

- The browser calls the API **cross-origin** (`https://everest-web.onrender.com` → `https://everest-api.onrender.com`). The API has no CORS today (local dev is same-origin via the Vite proxy). → new `CORS_ORIGIN` env (optional, comma-separated; unset = no CORS plugin, dev unchanged).
- The web image needs the API URL at **build time** (`VITE_API_BASE_URL` is already read by `apps/web/src/api/client.ts:44`). Render service URLs are deterministic (`https://<name>.onrender.com`), so render.yaml carries literals; if a slug is taken Render suffixes it and the runbook says: read the real URL from the dashboard, update the two literals, redeploy once.
- Render injects `PORT` into Docker services (default 10000). The API already honors `PORT` via `parseEnv`. nginx must too → use the official image's `/etc/nginx/templates` envsubst mechanism to listen on `${PORT}` (fallback 80 for compose).

**Deferred-work scope discipline:** only the two items explicitly reserved for 5.1 come in — the container-ops bundle (restart policy, `DATABASE_URL` guard before migrate, healthcheck `start_period`, un-hardcoded PORT) and the Dockerfile hardening item (digest-pinned global installs, turbo output warnings). CI, boot fail-fast tests, `parseEnv` tightening, SIGTERM graceful shutdown, test type-checking, boundary-lint strictness **stay deferred** to the post-deploy pass per the 2026-09-13 user decision. Do not scope-creep them in.

**Render platform realities (memory):** free tier; the free Postgres must be created **at deploy time** (30-day clock — do not pre-create while iterating on the blueprint); free web services spin down after idle (~15 min) and cold-start in ~30–60s — the README documents this as expected behavior, and the live-URLs smoke happens right after deploy while the services are warm.

**Post-freeze amendment (user, 2026-09-14): no credentials in docker-compose.yml — not even local ones.** Compose interpolates `POSTGRES_USER/PASSWORD/DB` from `.env` with `:?` fail-fast guards ("copy .env.example to .env"); the api service assembles its in-network `DATABASE_URL` from those parts (`postgres://$USER:$PASS@postgres:5432/$DB`); the pg healthcheck interpolates too. `.env.example` carries the documented local defaults (`locker`/`locker`). **Trade-off accepted by the user:** the fresh-clone run command becomes `cp .env.example .env && docker compose up --build` — the "zero-config compose" phrasing in the 5.1 AC is satisfied with that documented copy step, and the README (5.2) states it as step one. Production is unaffected: render.yaml never holds credentials (fromDatabase injection).

---

## Story 5.1 — Production containers and Render deployment

### Tasks

**T1 — API image hardening** (`apps/api/Dockerfile`, `apps/api/package.json`)

- [x] Runner slim-down attempt, with a sanctioned fallback: try a prod-deps runner (copy `out/json` + `pnpm install --prod --frozen-lockfile` with `prisma` moved to `dependencies`, copy `apps/api/dist`, `packages/*/dist`, and `apps/api/prisma` [schema + migrations — migrate deploy needs them] from the build stage; drop the `npm install --global prisma`). If the prisma-generate/postinstall dance fights back, keep the current full-workspace runner — record the outcome as an Implementation Note and a README trade-off either way. No more than one attempt; deadline beats image size.
- [x] Global `npm install` pinning: npm cannot digest-pin a global install, so the practical form is exact-version pinning — already in place (`turbo@2.10.12`, `pnpm@12.4.1`, `prisma@7.10.0`). Verify each global install line carries an exact version; drop any that lost its runner-stage purpose after the slim-down attempt. Note the exact-version decision in Implementation Notes (and as the settled answer to the deferred item).
- [x] Un-hardcode PORT: runner `ENV PORT=3000` (EXPOSE stays 3000 — it's documentation; Render overrides via env and the app already obeys).

**T2 — Web Docker image** (`apps/web/Dockerfile` NEW, `apps/web/nginx/default.conf.template` NEW or inline)

- [x] Multi-stage: pruner (`turbo prune @locker/web`) → build (`pnpm install --frozen-lockfile`, `turbo run build --filter=@locker/web` with `ARG VITE_API_BASE_URL=''` passed as build env) → runner `nginx:1.27-alpine`.
- [x] nginx config: serve the SPA from `/usr/share/nginx/html`; `location / { try_files $uri /index.html; }` so deep links (`/retrieve`, `/agent`) return the app, never 404; gzip on for js/css/json; listen on `${PORT}` via the templates/envsubst mechanism with a default of 80.
- [x] `.dockerignore` additions if the web build copies junk (node_modules, dist).

**T3 — CORS on the API** (`apps/api/src/adapters/http/server.ts`, env parsing, tests)

- [x] `@fastify/cors` registered **only when** `CORS_ORIGIN` is set: comma-separated origin list, `origin` as an allow-list, `methods: ['GET','POST']`. Unset → plugin not registered → local dev (Vite proxy, same-origin) byte-identical to today.
- [x] `parseEnv`: optional `CORS_ORIGIN`; when present, non-empty after trim, each comma-part a plausible origin (`^https?://`). Boot error follows the existing one-clear-error-naming-the-variable pattern.
- [x] Tests: allowed origin → `access-control-allow-origin` echoed; unlisted origin → no ACAO header; unset env → no CORS headers on any route (proves dev-unchanged). Integration style via `app.inject()` with the env set per-app-instance, same as existing env-dependent suites.

**T4 — compose: the full local stack** (`docker-compose.yml`)

- [x] Add `web` service: build with `VITE_API_BASE_URL=http://localhost:3000`, ports `8080:80`, `depends_on: api: condition: service_healthy`, own healthcheck (wget/curl against `/` — alpine nginx has wget via busybox).
- [x] Fold-in (container-ops bundle): `restart: unless-stopped` on api + web (postgres keeps default behavior — it's a dev service with a named volume); `start_period` on the api healthcheck (15s covers cold migrate-on-boot); guard the migrate step in the api CMD: `test -n "$DATABASE_URL" || { echo 'DATABASE_URL is not set' >&2; exit 1; } && prisma migrate deploy && node dist/index.js`.
- [x] Compose still supports the dev shape untouched: `docker compose up -d postgres` + host-run dev servers.

**T5 — Render blueprint** (`render.yaml` NEW, repo root)

- [x] Three resources, all free plan: `everest-db` (Postgres free — created at first blueprint launch), `everest-api` (Docker, `apps/api/Dockerfile`, root dockerfilePath, health check path `/health`, `DATABASE_URL` from the db's internal connection string, `STORAGE_FEE_BASE=10`, `CORS_ORIGIN=https://everest-web.onrender.com`), `everest-web` (Docker, `apps/web/Dockerfile`, build-time `VITE_API_BASE_URL=https://everest-api.onrender.com`).
- [x] Comment header: free-tier spin-down expected; slug-collision runbook note.

**T6 — Deploy runbook + live deploy** (`_bmad-output` runbook section in this spec's Implementation Notes, executed live with the user)

- [x] Runbook steps: user pushes the branch / connects repo → Blueprint launch (creates the Postgres — clock starts) → wait first deploy → curl `https://everest-api.onrender.com/health` → open web URL → store→retrieve round trip through the deployed web UI (real browser, user's hands or mine via curl) → paste live URLs into README (5.2).
- [x] Live smoke recorded in this spec: health JSON, one store + retrieve with charges, timestamps. Spin-down caveat documented.

**T7 — Chores + verification (5.1 boundary)**

- [x] `apps/web/src/store-package.test.tsx` fixture `clx8m2qk4` → a 6-char AD-9 id (`M4XT2B`) — last cuid-shaped string in the repo's tests.
- [x] Check `turbo run build` emits no missing-declared-output warnings for `@locker/web` (4.x may have fixed this; if yes, tick the deferred item as already-done in `deferred-work.md`).
- [x] Clean-checkout compose proof: `git clone` the repo to `/tmp/everest-compose-check` → `docker compose up --build -d` → `curl :3000/health`, `curl :8080/` (index), `curl :8080/retrieve` (SPA deep link → index, not 404), one store + retrieve round trip on :3000. This is AC "verified from a clean checkout, not the dev's working tree."
- [x] Full pipeline at boundary: `npx pnpm@12.4.1 turbo run build test lint` (one run, green).
- [x] Update `deferred-work.md`: mark the container-ops bundle + Dockerfile-pinning items absorbed by 5.1 (with what was actually done).

### 5.1 acceptance mapping

| epics.md AC | covered by |
|---|---|
| API image builds reproducibly, migrate-on-boot before serving (AD-8) | T1 (existing Dockerfile already proves the CMD; hardening keeps it) |
| Web image builds, SPA deep links work | T2 + T7 clean-checkout curl of `/retrieve` |
| Render: health ok, web loads, store→retrieve round trip, live URLs recorded | T5 + T6 (URLs land in README via 5.2) |
| `docker compose up` full stack from fresh clone | T4 + T7 |

---

## Story 5.2 — README with approach, decisions, and AI-use disclosure

Root `README.md` (NEW — none exists). Written for two readers at once: an HR reviewer skimming for reasoning and honesty, and an evaluator reproducing the stack. Sections:

### Tasks

**T1 — README skeleton + run instructions (must be real commands, tested)**

- [x] What it is: 4–5 lines, the product in one paragraph (smart-package locker station, agent console + customer retrieval, storage charges).
- [x] **Live demo** URLs (filled from 5.1 deploy; spin-down expectation + cold-start note).
- [x] **Run locally**: (a) full stack via compose from a fresh clone (`docker compose up --build`, app at :8080, API :3000); (b) dev mode (postgres-only compose service, `npx pnpm@12.4.1 install`, migrate, `--filter @locker/api dev` + `--filter @locker/web dev`); (c) OpenAPI docs URL (`/docs`); (d) **Level-3/4 concurrency proof**: start the DB, `npx pnpm@12.4.1 --filter @locker/api test` — name the two suites (`concurrency-parallel-store`, `concurrency-mixed`) and what they prove (no double-assign under parallel stores; availability stays correct under sustained mixed load).
- [x] Repo tour: `docs/` = product source (PRD, DESIGN, EXPERIENCE, challenge brief), `_bmad/` + `_bmad-output/` = planning/build method artifacts (specs per epic, decision log in the spine), `apps/` + `packages/` = the code.

**T2 — Approach, level by level**

- [x] How the challenge was attacked: Level 1 (allocation = smallest-fitting via `SIZE_RANK`, transactional store), Level 2 (distinct side-effect-free refusal outcomes + tiered storage charges as pure domain policy), Level 3 (row-level locking + CAS so parallel stores never double-assign — link to the suites), Level 4 (SPA that computes nothing, renders API outcomes verbatim). One short paragraph each, linking to the code entry points.

**T3 — Design decisions, each with its why**

- [x] Hexagonal architecture + AD-2 boundary enforcement (why: use cases stay framework-free, proven by lint).
- [x] The allocation transaction (SELECT … FOR UPDATE ordered candidate scan + CAS flip) — why not naive check-then-write.
- [x] AD-7 error envelope (one shape, calm codes; UI never shows raw errors).
- [x] AD-9 v1.1 human locker ids — including the honest story: v1 used a cuid, the build renegotiated it mid-flight to a generated 6-char unambiguous id **as the primary key**; collision retry bounded at 3.
- [x] AD-6 pickup codes: 8-char unambiguous alphabet, possession = retrieval, codes stored plaintext (assumption, listed as such).
- [x] AD-8 migrate-on-boot (never serve an unmigrated schema).
- [x] AD-10 SPA-computes-nothing (charges come from the API; the client never does pricing math).
- [x] Testing: 227 tests, TDD order visible in history, contract-first TypeBox schemas generating both OpenAPI and the web's typed client, design-audit tests enforcing DESIGN.md tokens.

**T4 — Assumptions, trade-offs, future improvements**

- [x] Assumptions: single station; anonymous customers (possession-based retrieval, `customerRef` optional free-text); plaintext pickup codes; storage day = 24h elapsed, ceil, partial day bills full; `STORAGE_FEE_BASE` in whole units defaulting to 10; SMS/email code delivery out of scope.
- [x] Trade-offs (pick the real ones): runtime image simplicity vs size (per T1 outcome); polling vs push for availability; id-as-PK collision retry vs surrogate-key simplicity; plaintext codes vs hashing (single-station threat model); Postgres row locks vs app-level lock manager; free-tier Render (spin-down) vs paid always-on.
- [x] Future improvements: multi-station, hashed pickup codes, notifications, agent auth, CI + the deferred hardening list (link `deferred-work.md`).

**T5 — AI-use disclosure (graded requirement — answer all four verbatim)**

- [x] Which AI tools: Claude Code (CLI), powered by GLM (Z.ai), plus the BMAD method's planning prompts.
- [x] How they were used: planning pipeline (PRD → architecture spine → epics → specs) then per-story implementation with tests, against user-frozen specs.
- [x] Which portions are AI-assisted: the overwhelming majority of code and test text was AI-drafted under human direction; **all** product decisions, priorities, and mid-build renegotiations (AD-9 v1.1) were the author's; the author reviewed every diff and made every commit personally.
- [x] Prompts/workflow: BMAD pipeline artifacts in `_bmad-output/` (specs are the standing instructions per epic), per-story approve→build→verify loop, human review points at spec freeze and manual smoke. Honest paragraph, no hedging.

**T6 — Git tags chore (graded history criterion: "tagged per epic")**

- [x] Tag the epic-boundary commits: resolve each epic's last code/story commit from `git log` (epic-1 ≈ the story-1.5 close sequence, epic-2/3 ≈ `c1fd5a9` boundary, epic-4 ≈ last 4.7/AD-9 code commit, epic-5 = final). Tag names: `epic-1` … `epic-5`. Hand the user one paste-able command block; tags are theirs to push (`git push origin --tags`).

**T7 — Close-out**

- [x] `sprint-status.yaml`: epic-5 + both stories → done; project complete.
- [x] `BUILD-HANDOFF.md`: final state (everything done, live URLs, what remains = deferred-work.md only).
- [x] Final full pipeline run + spec status → done, Implementation Notes appended.

### 5.2 acceptance mapping

| epics.md AC | covered by |
|---|---|
| README covers approach/decisions/assumptions/trade-offs/future | T1–T4 |
| AI disclosure answers all four questions | T5 |
| Every run command real and complete | T1 (commands verified or lifted from actual use; compose path proven in 5.1 T7) |
| Git history reads as per-story TDD commits, tagged per epic | T6 (+ the history itself) |

---

## Machine realities (binding, from BUILD-HANDOFF)

- pnpm only via `npx pnpm@12.4.1`. One command at a time. No dev servers/watchers; no `git commit` — deliver a commit plan, the user commits.
- Compose Postgres 18 on host port **55432** is already running for tests — don't restart Docker.
- Full `turbo run build test lint` only at the two story boundaries.
- Docker builds are the one place long commands are fine; `docker compose up --build` for the clean-checkout proof runs detached (`-d`) and is torn down (`docker compose down`) after, temp clone deleted.

## Verification pipeline (at each story boundary)

1. `npx pnpm@12.4.1 turbo run build test lint` — green, 227+ tests.
2. 5.1 only: clean-clone compose proof (T7) — health, SPA deep link, round trip.
3. 5.1 only: live Render smoke (T6) — health, round trip through deployed UI.
4. 5.2 only: README command audit — every fenced command exists in the repo's scripts/compose or is a standard invocation.

## Implementation Notes (5.1)

- **Slim runner: shipped.** Prod-deps runner (`pnpm install --prod --frozen-lockfile`, ~705 MB layer vs ~2.2 GB old full-workspace tree) won on the first sanctioned attempt, but surfaced two latent cold-build bugs the story-1.1 image never hit: (a) Prisma generate emitted `./enums.ts` specifiers because no tsconfig existed in-container at install time — fixed by staging `tsconfig.base.json` + pruned `apps/api/tsconfig.json` before install in both stages; (b) `turbo run build --filter=@locker/api` races `@locker/domain#build` in a cold workspace (its `export-openapi` chain dangles) — images build domain → api via plain pnpm instead. `prisma` + `dotenv` moved devDeps → deps (both are runtime boot code: migrate-on-boot, `prisma.config.ts` imports dotenv). The dropped global `prisma` install is replaced by the exact-pinned local dep — the settled answer to the deferred pinning item.
- **CORS**: `@fastify/cors` 11.3.0 exact; registered only when `CORS_ORIGIN` parses (allow-list, GET/POST). 8 new tests (3 env-parse + 5 integration incl. "unset = no CORS headers on any route").
- **Credential-free compose** (post-freeze amendment, user): `:?` guards on POSTGRES_*, assembled in-network URL, interpolated pg healthcheck; verified both paths — missing env exits 1 naming the variable; full stack healthy and a store→retrieve round trip succeeded (isolated compose project, ports 55433/3010/8090; dev `locker-postgres` untouched). compose api also sets `CORS_ORIGIN=http://localhost:8080` so the compose UI exercises the exact cross-origin shape Render will.
- **render.yaml**: orchestrator added `sync: false` to `CORS_ORIGIN` post-agent (blueprint re-apply would otherwise reset a runbook-edited value).
- **Turbo warnings**: no missing-declared-output warning for `@locker/web#build` — the deferred item is already fixed; remaining `#test` coverage-glob warnings predate 5.1 (post-deploy pass).
- **Pipeline**: full `turbo run build test lint` green twice (agent close + orchestrator re-run after UI deltas) — **236 tests** (domain 41, api 113, web 82).
- **Manual-smoke fixes landed in the same session (Epic-4 follow-ups, separate commits)**: ResultCard values `whitespace-nowrap` + copy-button yields (`flex-wrap`); CodeInput restructured into true `XXXX`/`XXXX` chunks (4+4 stacks below 480px, dash joins wide, 46px cells keep the 44px target floor) — user-chosen layout after flagging the one-line-vs-target-size conflict; regression guards added in `retrieve.test.tsx` (chunk structure) and `store-package.test.tsx` (nowrap); last cuid-shaped fixture (`state-matrix` retrieve input) → `K7Q4M2`.
- **`.dockerignore` bullet (T2, unticked)**: not needed — the root `.dockerignore` from 1.1 already excludes node_modules/dist for the prune context, and the web image copies only pruned output.
