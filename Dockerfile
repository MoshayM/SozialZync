# build-buster: 20260915-v2
FROM node:22-slim AS base
RUN apt-get update && apt-get install -y openssl libatomic1 && rm -rf /var/lib/apt/lists/* && npm install -g pnpm@10

WORKDIR /app

# Copy workspace manifests for layer caching
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/agents/package.json ./packages/agents/
COPY packages/prompts/package.json ./packages/prompts/
COPY packages/config/ ./packages/config/
COPY apps/api/package.json ./apps/api/

# Install all workspace deps
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Build shared → then API (prisma generate doesn't need DB)
RUN pnpm --filter @cf/shared build && pnpm --filter @cf/api build

ENV NODE_ENV=production
EXPOSE 4007

# Sync schema then start (db push is idempotent and ignores migration history state)
CMD ["sh", "-c", "cd apps/api && npx prisma db push --accept-data-loss --skip-generate && node dist/main"]
