# Multi-stage build for @locker/api (spine: node:24-alpine, turbo prune).
#
# Stage 1 prunes the monorepo down to @locker/api and its workspace
# dependencies, stage 2 installs + builds that subset, stage 3 ships a runtime
# image that applies committed migrations (AD-8) before starting.
#
# Deliberately simple for story 1.1: the runtime stage copies the whole built
# workspace (dev dependencies included) rather than hand-picking node_modules
# subtrees — a smaller production image is a deploy-story optimization.

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
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
# turbo prune copies workspace packages + manifests, but not arbitrary root
# files; the workspace tsconfigs extend this one.
COPY tsconfig.base.json .
RUN pnpm turbo run build --filter=@locker/api

FROM node:24-alpine AS runner
WORKDIR /repo
# Prisma's schema engine needs openssl on alpine; the CLI runs `migrate deploy`.
RUN apk add --no-cache openssl \
  && npm install --global prisma@7.10.0
ENV NODE_ENV=production
COPY --from=build /repo/ .
EXPOSE 3000
# AD-8: the app never boots against an unmigrated schema. Prisma 7 loads
# prisma.config.ts from the current directory, so migrate runs from apps/api.
CMD ["sh", "-c", "cd apps/api && prisma migrate deploy && node dist/index.js"]
