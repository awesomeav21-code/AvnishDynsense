# ============================================
# Dynsense API — Multi-stage Docker build
# Build from monorepo root: docker build -f apps/api/Dockerfile .
# ============================================

# --- Stage 1: Base with pnpm ---
FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

# --- Stage 2: Install ALL dependencies (including native builds for bcrypt) ---
FROM base AS deps
# bcrypt requires python3, make, g++ for native compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace config + lockfile first (cache layer)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY turbo.json tsconfig.base.json ./

# Copy all package.json files for workspace resolution
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/agents/package.json ./packages/agents/
COPY packages/mcp/package.json ./packages/mcp/

RUN pnpm install --frozen-lockfile

# --- Stage 3: Build ---
FROM deps AS build

# Copy source code
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Build with turbo (builds dependencies first: shared → db → agents → api)
RUN pnpm turbo build --filter=@dynsense/api...

# --- Stage 4: Production dependencies only ---
FROM base AS prod-deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY turbo.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/agents/package.json ./packages/agents/
COPY packages/mcp/package.json ./packages/mcp/

RUN pnpm install --frozen-lockfile --prod

# --- Stage 5: Production runner ---
FROM node:20-slim AS runner

# Install tini for proper PID 1 signal handling
RUN apt-get update && apt-get install -y --no-install-recommends tini \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Non-root user
RUN groupadd --gid 1001 dynsense && \
    useradd --uid 1001 --gid dynsense --shell /bin/sh --create-home dynsense

# Copy production node_modules
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=prod-deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=prod-deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=prod-deps /app/packages/agents/node_modules ./packages/agents/node_modules
COPY --from=prod-deps /app/packages/mcp/node_modules ./packages/mcp/node_modules

# Copy built artifacts
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/packages/db/dist ./packages/db/dist
COPY --from=build /app/packages/db/package.json ./packages/db/
COPY --from=build /app/packages/db/migrations ./packages/db/migrations
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/packages/agents/dist ./packages/agents/dist
COPY --from=build /app/packages/agents/package.json ./packages/agents/
COPY --from=build /app/packages/mcp/dist ./packages/mcp/dist
COPY --from=build /app/packages/mcp/package.json ./packages/mcp/

# Copy workspace config (needed for pnpm workspace resolution at runtime)
COPY --from=build /app/package.json ./
COPY --from=build /app/pnpm-workspace.yaml ./

# Copy DB init script for migrations
COPY scripts/db-init.sql ./scripts/

# Copy entrypoint
COPY apps/api/docker-entrypoint.sh ./apps/api/
RUN chmod +x ./apps/api/docker-entrypoint.sh

USER dynsense

ENV NODE_ENV=production
ENV API_PORT=3001
ENV API_HOST=0.0.0.0

EXPOSE 3001

ENTRYPOINT ["tini", "--"]
CMD ["./apps/api/docker-entrypoint.sh"]
