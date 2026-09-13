# Version / Reality-Check Review — ARCHITECTURE-SPINE.md

- **Reviewed file:** `_bmad-output/planning-artifacts/architecture/architecture-smart_package_everest-2026-09-13/ARCHITECTURE-SPINE.md`
- **Lens:** every committed decision web-verified vs asserted from training data; pinned versions exist, are current stable (not RC-as-stable), and still fit their role.
- **Date of verification:** 2026-09-13
- **Sources:** npm registry `dist-tags` + per-version metadata (`registry.npmjs.org`), Docker Hub tag API, nodejs/Release `schedule.json`, github.com/microsoft/TypeScript/releases, prisma.io docs (supported-databases, transactions), docs.railway.com (Dockerfile deploys).

## Verdict

**PASS with advisories.** The Stack table is unusually accurate: all 8 pinned versions were fetched from the npm registry and every one is the exact current stable `latest` tag, none is an RC misread as stable. The spine's most suspicious-looking claim — "Prisma 7.10.0 (8.x is RC-only)" — is **verifiably true** (Prisma's `latest` dist-tag currently points at `8.0.0-rc.14`; the newest non-RC is `7.10.0`). Two real gaps were found: the interactive-docs claim in AD-1 needs `@fastify/swagger-ui`, and the TypeBox pin is on the legacy package line of an ecosystem that has split.

## Stack table verification (all checked live, 2026-09-13)

| Spine pin | Registry `latest` dist-tag | Verdict |
| --- | --- | --- |
| TypeScript 7.0.2 | `7.0.2` | ✅ Exact match. GA confirmed on GitHub releases: 7.0.2 marked "Latest" (released 2026-08), shipped from `microsoft/typescript-go` (the Go-native rewrite) — a real stable release, not the `7.0.1-rc` pre-release. Note: this is a runtime/toolchain change of implementation; pin is correct as-is. |
| Node.js 22 LTS, `node:22-alpine` | — | ⚠️ Exists (`node:22-alpine` tag live), LTS until 2027-04-30 — **but in maintenance phase since 2025-10-21**. See HIGH-2/MEDIUM below. |
| Fastify 5.12.4 | `5.12.4` | ✅ Exact match. `next` is `6.0.0-alpha.3` (alpha) — correctly avoided. |
| @fastify/swagger 9.8.1 | `9.8.1` | ✅ Exact match. Built for Fastify 5 ecosystem (`fastify-plugin ^6`, no conflicting peers). |
| @sinclair/typebox 0.34.52 | `0.34.52` | ⚠️ Exact match, not deprecated — but this is the legacy line. See HIGH-1. |
| Prisma 7.10.0 ("8.x is RC-only") | `8.0.0-rc.14` (`prev` = `7.10.0`) | ✅ Claim **confirmed**: latest tag is literally an RC; 7.10.0 is the newest stable. `@prisma/client` latest is also `7.10.0` — a matched CLI+client pin at 7.10.0 is consistent. Engines: `node ^20.19 \|\| ^22.12 \|\| >=24` → satisfied by any current `node:22-alpine` (22.x is well past 22.12). |
| PostgreSQL 18, `postgres:18-alpine` | — | ✅ Image tag exists (Docker Hub 200). PG 18 is the current released major as of today (annual cadence puts PG 19 late-Sept 2026). Prisma 7 officially supports PostgreSQL 9.6–**18** inclusive. |
| Vitest 5.0.0 | `5.0.0` | ✅ Exact match, stable (preceded by `5.0.0-rc.4`; v4 line still tagged `4.1.11`). |

## Prose-claim checks

- **AD-1 "OpenAPI via `@fastify/swagger`, interactive docs at `/docs`"** — ⚠️ `@fastify/swagger` alone serves only the OpenAPI *JSON/schema*; the interactive UI page requires the separate plugin **`@fastify/swagger-ui`** (current stable **6.1.1**, Fastify-5-compatible via `fastify-plugin ^6` + `@fastify/static ^10`). Not in the Stack table.
- **AD-3 "one Prisma interactive transaction … `FOR UPDATE SKIP LOCKED`"** — ✅ Supported in Prisma 7.x: `prisma.$transaction(async (tx) => …)` with `$queryRaw` inside, plus `timeout`/`isolationLevel` options. ⚠️ Caveat (LOW): prisma.io docs now default to the **8.0.0-RC API** — `db.transaction(...)`, no `$transaction`, no timeout/isolation options, no nested transactions. Build stories must follow the 7.x docs or they will copy non-existent v7 APIs. A one-line pointer in the spine would prevent this.
- **Hexagonal/adapters (Fastify + Prisma + Postgres)** — ✅ All technologies exist and fit their roles; Fastify 5 route-level JSON Schema validation works with TypeBox output (standard JSON Schema).
- **Docker → Railway** — ✅ Verified: Railway auto-detects a root `Dockerfile` (capital D), zero config needed; `RAILWAY_DOCKERFILE_PATH` only for custom names/paths. Spine's structural seed matches.
- **AD-8 partial unique index / schema via `prisma migrate`** — ✅ Standard Prisma 7 capability; no version risk.

## Findings

### HIGH-1 — TypeBox package drift: `@fastify/type-provider-typebox` no longer peers on `@sinclair/typebox`
- **Evidence:** `@fastify/type-provider-typebox@6.1.0` (npm `latest`) declares `peerDependencies: { "typebox": "^1.0.13" }`. The `typebox` package (same project, new name) is at **1.3.30**. `@sinclair/typebox` remains at 0.34.52, unpublished-deprecated, but is the legacy 0.x line.
- **Impact:** The spine names only `@sinclair/typebox 0.34.52`. Schemas-as-JSON-Schema still work fine with plain Fastify, so nothing *breaks* — but if build stories reach for the official type provider for typed handlers (the standard integration this stack implies), it will demand `typebox@1`, not the pinned package. This split is exactly the kind of fact training-data-era knowledge gets wrong.
- **Recommendation:** Make an explicit decision in the Stack table: either (a) `typebox 1.3.30` + `@fastify/type-provider-typebox 6.1.0` (ecosystem-current), or (b) keep `@sinclair/typebox 0.34.52` and note "no official type provider; wire TypeBox schemas directly / via a local wrapper". Don't leave it ambiguous for build stories.

### MEDIUM-1 — `/docs` interactive docs need `@fastify/swagger-ui`, which is not in the stack
- **Evidence:** AD-1 and the Consistency table promise interactive docs at `/docs`; `@fastify/swagger@9.8.1` metadata shows it serves OpenAPI output only (no UI assets; UI is the separate `@fastify/swagger-ui` plugin, latest **6.1.1**).
- **Recommendation:** Add `@fastify/swagger-ui 6.1.1` to the Stack table and AD-1's rule, or reword to "OpenAPI JSON at `/docs/json`" if the UI is not wanted.

### MEDIUM-2 — Node 22 is LTS but in **maintenance** phase; Node 24 is the Active LTS a greenfield service would default to
- **Evidence:** nodejs/Release schedule: v22 → LTS 2024-10-29, **maintenance since 2025-10-21**, EOL 2027-04-30. v24 → Active LTS since 2025-10-28 (until 2026-10-20); v26 reaches LTS 2026-10-28.
- **Impact:** "Node.js 22 LTS" is true but understates lifecycle position — a new service starting 2026-09 gets ~7 months of full support then security-only. Prisma 7 accepts `>=24`.
- **Recommendation:** Either accept maintenance-phase 22 knowingly (fine for a challenge, EOL 2027-04) or pin `node:24-alpine`. Label the choice in the Stack row.

### LOW-1 — Prisma docs currently document the v8 RC API; team on 7.10.0 must read 7.x docs
- **Evidence:** prisma.io transactions page (fetched today) describes ORM 8: "Prisma ORM 8 has no `$transaction`" (replaced by `db.transaction(...)`, no timeout/isolation options, no nested transactions).
- **Recommendation:** Add one line to AD-3: "Prisma pinned at 7.x: use `prisma.$transaction(async (tx) => …)` with `tx.$queryRaw` — ignore current docs pages describing the 8.0 RC API." Also pin `@prisma/client@7.10.0` explicitly (currently its `latest` is coincidentally 7.10.0, so no conflict — but say it).

### LOW-2 — PostgreSQL 19 lands within days-weeks
- Annual cadence puts PG 19 in late Sept 2026. `postgres:18-alpine` is correct today and stays supported by Prisma 7; no action, just don't "upgrade casually" the same way as Prisma 8.

## Not flagged (verified fine)

- Every numeric pin in the Stack table is the exact current npm stable — no version in the table is wrong or stale.
- No RC is misread as stable anywhere; the two RC-adjacent traps (TS 7.0.1-rc, Prisma 8.0.0-rc.14) are both correctly navigated by the spine.
- Fastify 5 + @fastify/swagger 9 compatibility confirmed via plugin metadata.
- `postgres:18-alpine`, `node:22-alpine` both exist on Docker Hub.
- Railway Dockerfile deploy path is real and requires no special config for the proposed root `Dockerfile`.
- Prisma 7 supports PostgreSQL 18.
