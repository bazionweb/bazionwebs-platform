# syntax=docker/dockerfile:1

# Keep dependency installation cached when application source changes. The lockfile and
# every workspace manifest are copied first; source files are added after install.
FROM node:26-bookworm-slim AS workspace
WORKDIR /repo
RUN npm install --global pnpm@12.18.0
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --parents apps/*/package.json packages/*/package.json templates/package.json ./

# Database role bootstrap is part of the versioned image, not a mount from
# Dokploy's ephemeral checkout directory.
FROM postgres:18.7-alpine3.24 AS database
COPY packages/database/init/001-create-roles.sh /docker-entrypoint-initdb.d/001-create-roles.sh

# The migration target is an operator-run, one-shot image. It runs the
# application and Better Auth schemas with the least-privilege migration role.
FROM workspace AS migrate
RUN --mount=type=cache,id=bazion-pnpm-store,target=/root/.local/share/pnpm/store/v11 \
    pnpm install --frozen-lockfile --filter @bazion/database... --filter @bazion/auth...
COPY . .
ENV NODE_ENV=production
USER node
CMD ["sh", "-ec", "pnpm --filter @bazion/database migrate && pnpm --filter @bazion/auth migrate"]

FROM workspace AS api-build
RUN --mount=type=cache,id=bazion-pnpm-store,target=/root/.local/share/pnpm/store/v11 \
    pnpm install --frozen-lockfile --filter @bazion/api...
COPY . .
RUN pnpm --filter @bazion/api... run build
RUN pnpm --filter @bazion/api --prod deploy /out

FROM node:26-bookworm-slim AS api
ENV NODE_ENV=production
ENV PORT=4000
ENV HOSTING_TEMPLATE_DIRECTORY=/opt/bazion/client-templates
WORKDIR /app
COPY --from=api-build --chown=node:node /out/ ./
COPY --from=api-build --chown=node:node /repo/deploy/client-templates/ /opt/bazion/client-templates/
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:4000/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["node", "dist/server.js"]

# A guarded, one-shot operator task for granting the initial platform-owner
# role to an already-created, email-verified account. It runs only when the
# Dokploy Compose operator-bootstrap profile is explicitly enabled.
FROM api AS platform-bootstrap
COPY --from=api-build --chown=node:node /repo/scripts/create-platform-admin.ts /app/scripts/create-platform-admin.ts
HEALTHCHECK NONE
CMD ["node", "--experimental-strip-types", "scripts/create-platform-admin.ts"]

FROM workspace AS admin-build
ARG API_BASE_URL=http://api:4000
ARG PUBLIC_STOREFRONT_URL=https://church-staging.bazionweb.com
ENV API_BASE_URL=${API_BASE_URL}
ENV PUBLIC_STOREFRONT_URL=${PUBLIC_STOREFRONT_URL}
RUN --mount=type=cache,id=bazion-pnpm-store,target=/root/.local/share/pnpm/store/v11 \
    pnpm install --frozen-lockfile --filter @bazion/admin...
COPY . .
RUN pnpm --filter @bazion/admin... run build

FROM node:26-bookworm-slim AS admin
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=admin-build --chown=node:node /repo/apps/admin/.next/standalone/ ./
COPY --from=admin-build --chown=node:node /repo/apps/admin/.next/static/ ./apps/admin/.next/static/
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:3001/').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["node", "apps/admin/server.js"]

FROM workspace AS storefront-build
ARG API_BASE_URL=http://api:4000
ENV API_BASE_URL=${API_BASE_URL}
RUN --mount=type=cache,id=bazion-pnpm-store,target=/root/.local/share/pnpm/store/v11 \
    pnpm install --frozen-lockfile --filter @bazion/storefront...
COPY . .
RUN pnpm --filter @bazion/storefront... run build

# Reuse the fully installed storefront build stage to run its suite without a second install.
FROM storefront-build AS storefront-test
RUN pnpm --filter @bazion/storefront test

FROM node:26-bookworm-slim AS storefront
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=storefront-build --chown=node:node /repo/apps/storefront/.next/standalone/ ./
COPY --from=storefront-build --chown=node:node /repo/apps/storefront/.next/static/ ./apps/storefront/.next/static/
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["node", "apps/storefront/server.js"]

FROM workspace AS notification-worker-build
RUN --mount=type=cache,id=bazion-pnpm-store,target=/root/.local/share/pnpm/store/v11 \
    pnpm install --frozen-lockfile --filter @bazion/notifications...
COPY . .
RUN pnpm --filter @bazion/notifications... run build
RUN pnpm --filter @bazion/notifications --prod deploy /out

FROM node:26-bookworm-slim AS notification-worker
ENV NODE_ENV=production
WORKDIR /app
COPY --from=notification-worker-build --chown=node:node /out/ ./
USER node
CMD ["node", "dist/worker.js"]
