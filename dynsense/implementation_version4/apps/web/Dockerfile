# ============================================
# Dynsense Web — Multi-stage Docker build
# Build from monorepo root: docker build -f apps/web/Dockerfile .
# ============================================

# --- Stage 1: Base with pnpm ---
FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

# --- Stage 2: Install dependencies ---
FROM base AS deps

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

# API URL is relative — browser resolves against current origin, nginx proxies /api/* to API container
ARG NEXT_PUBLIC_API_URL=/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Copy source code
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

# Build with turbo (builds dependencies first: shared → web)
RUN pnpm turbo build --filter=@dynsense/web...

# --- Stage 4: Production runner ---
FROM node:20-slim AS runner
WORKDIR /app

# Non-root user
RUN groupadd --gid 1001 dynsense && \
    useradd --uid 1001 --gid dynsense --shell /bin/sh --create-home dynsense

# Copy Next.js standalone output
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

USER dynsense

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

# Next.js standalone server
CMD ["node", "apps/web/server.js"]
