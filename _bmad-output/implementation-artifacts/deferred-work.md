# Deferred Work

Post-feature hardening backlog. Deferred by user decision 2026-09-13: build all features and deploy first, then run the verification/hardening pass.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-monorepo-scaffold-with-a-running-health-checked-api.md`
  summary: Boot fail-fast contract has no automated test — add a Vitest suite that spawns the built entrypoint with `DATABASE_URL` unset and asserts non-zero exit + stderr naming the variable.
  evidence: Verification-gap reviewer verified no test imports `index.ts` or `loadEnv`; breaking the env-first ordering or changing `exit(1)` → `exit(0)` leaves `turbo build test lint` green.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-monorepo-scaffold-with-a-running-health-checked-api.md`
  summary: Container path (Docker image build, `prisma migrate deploy` on boot, compose healthcheck) has zero automated verification — add a DB-backed smoke script or Docker-capable CI job.
  evidence: Verification-gap reviewer verified no pipeline definition invokes docker or prisma; the compose stack was exercised live once and never re-run by anything automated.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-monorepo-scaffold-with-a-running-health-checked-api.md`
  summary: No CI workflow exists — add one running `turbo run build test lint` on push.
  evidence: Blind-hunter finding; `.github/` absent. Spine Deferred already places CI out of v1; revisit with the deploy story.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-monorepo-scaffold-with-a-running-health-checked-api.md`
  summary: `parseEnv` accepts non-decimal integer forms (`0x50`, `1e2`) for `PORT`/`STORAGE_FEE_BASE` — tighten with `/^\d+$/` before `Number()`.
  evidence: Blind-hunter finding; `Number('0x50') === 80` passes the integer/range check today.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-monorepo-scaffold-with-a-running-health-checked-api.md`
  summary: `apps/api/test/**` is never type-checked — add a `tsc --noEmit` pass over tests (separate tsconfig or include widening).
  evidence: Verification-gap reviewer verified `apps/api/tsconfig.json` includes only `src/**/*.ts` and ESLint parses TS syntax-only via babel.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-monorepo-scaffold-with-a-running-health-checked-api.md`
  summary: Env-parsing hardening bundle — shape-check `DATABASE_URL` as `postgres(ql)://`, strict `/^\d+$/` integer forms, boundary tests (`PORT=0`/`65536`, whitespace-only), and fix the overstated "ONLY place process.env is read" comment in env.ts.
  evidence: Edge-case-hunter findings 12, 13, 23 + blind-hunter finding 1 (same root cause: env parsing strictness).

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-monorepo-scaffold-with-a-running-health-checked-api.md`
  summary: Process-lifecycle bundle — SIGTERM/SIGINT graceful shutdown (`app.close()` then exit), `process.exitCode = 1` instead of immediate `exit(1)` so piped stderr drains.
  evidence: Edge-case-hunter findings 15, 16; in-flight requests dropped on compose stop / Render spin-down.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-monorepo-scaffold-with-a-running-health-checked-api.md`
  summary: Container-ops bundle (Story 5.1) — `restart: unless-stopped`, `: ${DATABASE_URL:?}` guard before `prisma migrate deploy`, healthcheck `start_period`, un-hardcode PORT in healthcheck/EXPOSE.
  evidence: Edge-case-hunter findings 17–20; first transient migrate failure or slow boot currently kills the container with no recovery.
  done: ABSORBED BY STORY 5.1 (2026-09-14, spec-5-1-5-2). `restart: unless-stopped` on api+web; DATABASE_URL guard in the runner CMD (and `:?` interpolation guards in compose); `start_period: 15s` on the api healthcheck; PORT via runner `ENV PORT` (Render injects, app obeys, EXPOSE stays 3000 as documentation).

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-monorepo-scaffold-with-a-running-health-checked-api.md`
  summary: Boundary-lint strictness — add `'fastify/*'` and `'@sinclair/typebox/*'` subpath patterns to the AD-2 zones; add a `timeout` to `check-boundaries.mjs`'s `spawnSync`.
  evidence: Edge-case-hunter findings 21, 22; subpath imports currently bypass the no-restricted-imports zones.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-monorepo-scaffold-with-a-running-health-checked-api.md`
  summary: Turbo emits missing-declared-output warnings for `@locker/web`'s placeholder build; Dockerfile's `npm install --global` installs could be digest-pinned.
  evidence: Blind-hunter findings (warning noise; supply-chain drift). Fold into Story 5.1 container hardening.
  done: RESOLVED BY STORY 5.1 (2026-09-14): `@locker/web#build` no longer emits missing-declared-output (only the pre-existing `#test` coverage-glob warnings remain, all packages); global installs settle at exact-version pinning (npm cannot digest-pin globals), and the runner's global `prisma@7.10.0` was dropped entirely in favor of the exact-pinned local dependency.
