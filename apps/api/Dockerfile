# Multi-stage build for @locker/api (spine: node:24-alpine, turbo prune).
#
# Stage 1 prunes the monorepo down to @locker/api and its workspace
# dependencies, stage 2 installs + builds that subset, stage 3 ships a runtime
# image with production dependencies only that applies committed migrations
# (AD-8) before starting.
#
# The runner is deliberately narrow: compiled output (apps/api/dist,
# packages/domain/dist), the pruned production node_modules, and the boot-time
# Prisma files (schema + migrations + prisma.config.ts). Two things moved into
# `dependencies` to make that possible — `prisma` (the CLI runs migrate-on-boot
# in the container) and `dotenv` (imported by prisma.config.ts); see
# apps/api/package.json. `src/config/load-env.ts` is copied because
# prisma.config.ts imports it at boot.

FROM node:24-alpine AS pruner
WORKDIR /repo
RUN npm install --global turbo@2.10.12
COPY . .
RUN turbo prune @locker/api --docker

FROM node:24-alpine AS build
WORKDIR /repo
RUN npm install --global pnpm@12.4.1 \
  && apk add --no-cache openssl
COPY --from=pruner /repo/out/json/ .
# BEFORE install, and this order is load-bearing: @locker/api's postinstall
# runs `prisma generate`, which reads the tsconfig chain next to the schema to
# pick import extensions (module: nodenext => "./enums.js"). Without it the
# generator emits "./enums.ts" specifiers, tsc passes them through verbatim,
# and plain Node cannot resolve them at boot.
COPY tsconfig.base.json .
COPY --from=pruner /repo/out/full/apps/api/tsconfig.json ./apps/api/tsconfig.json
# The schema must exist before install too: generate reads
# prisma/schema.prisma. Everything else from out/full is copied right after.
COPY --from=pruner /repo/out/full/apps/api/prisma ./apps/api/prisma
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
# Build domain first, then the API — plain pnpm, deliberately not turbo:
# turbo's `build -> generate -> export-openapi` chain imports @locker/domain's
# compiled output without depending on @locker/domain#build, which races in a
# cold workspace (harmless locally, where dist/ already exists). The image
# itself needs no export-openapi — that document feeds apps/web's committed
# typegen, and nothing here reads it.
RUN pnpm --filter @locker/domain run build \
  && pnpm --filter @locker/api run build

FROM node:24-alpine AS runner
WORKDIR /repo
# Prisma's schema engine needs openssl on alpine; the CLI runs `migrate deploy`.
RUN apk add --no-cache openssl \
  && npm install --global pnpm@12.4.1
ENV NODE_ENV=production
# Render injects PORT into Docker services; 3000 is the local default. EXPOSE
# stays 3000 — it is documentation, the app obeys the env var.
ENV PORT=3000
COPY --from=pruner /repo/out/json/ .
# Same inputs as the build stage's generate (tsconfig chain, then schema) so
# the postinstall emits identical import extensions.
COPY tsconfig.base.json .
COPY --from=pruner /repo/out/full/apps/api/tsconfig.json ./apps/api/tsconfig.json
COPY --from=pruner /repo/out/full/apps/api/prisma ./apps/api/prisma
RUN pnpm install --prod --frozen-lockfile
# Compiled app + the one workspace package it imports (its package.json is
# already in place from out/json).
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/packages/domain/dist ./packages/domain/dist
# Boot-time Prisma: schema + migrations for migrate deploy, the config the
# CLI loads, and the one source file that config imports.
COPY --from=build /repo/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY --from=build /repo/apps/api/src/config/load-env.ts ./apps/api/src/config/load-env.ts
EXPOSE 3000
# AD-8: the app never boots against an unmigrated schema — and never without
# the database URL to migrate it with. Prisma 7 loads prisma.config.ts from
# the current directory, so migrate runs from apps/api.
CMD ["sh", "-c", "cd apps/api && test -n \"$DATABASE_URL\" || { echo 'DATABASE_URL is not set' >&2; exit 1; } && pnpm exec prisma migrate deploy && node dist/index.js"]
