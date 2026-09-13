# Multi-stage build for @locker/web (spine: node:24-alpine, turbo prune).
#
# Stage 1 prunes the monorepo down to @locker/web and its workspace
# dependencies (@locker/ui), stage 2 builds the static SPA with Vite, stage 3
# serves it from nginx:1.27-alpine.
#
# The API URL is a BUILD-time input: Vite bakes VITE_API_BASE_URL into the
# bundle (see apps/web/src/api/client.ts), so it arrives as a build arg from
# docker-compose and as build env from render.yaml.
#
# Why `pnpm --filter @locker/web run build` and not `turbo run build`: the
# root turbo.json makes `build` depend on `generate`, which depends on
# `@locker/api#export-openapi` — a package the web-only prune correctly leaves
# out, so turbo's task graph cannot resolve in this subset. Nothing is lost:
# the typed client is committed (apps/web/src/api/openapi.json +
# schema.d.ts), the build needs no API and no other workspace output, and
# @locker/ui is source-direct (its main is src/index.ts).

FROM node:24-alpine AS pruner
WORKDIR /repo
RUN npm install --global turbo@2.10.12
COPY . .
RUN turbo prune @locker/web --docker

FROM node:24-alpine AS build
WORKDIR /repo
ARG VITE_API_BASE_URL=''
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm install --global pnpm@12.4.1
COPY --from=pruner /repo/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
# turbo prune copies workspace packages + manifests, but not arbitrary root
# files; the workspace tsconfigs extend this one.
COPY tsconfig.base.json .
RUN pnpm --filter @locker/web run build

FROM nginx:1.27-alpine AS runner
COPY apps/web/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
# docker compose maps 8080:80 and leaves this default; Render overrides PORT
# and the template listens on whatever it injects.
ENV PORT=80
EXPOSE 80
