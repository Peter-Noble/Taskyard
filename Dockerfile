# Taskyard web UI (Next.js). Hub/worker stay on the host for now.
# Use Debian (not Alpine): better-sqlite3 is a native addon; Alpine/musl
# breaks host-built binaries if you bind-mount the repo like Show Engine.
FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    python3 \
    make \
    g++ \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json projects.json ./
COPY apps ./apps
COPY packages ./packages
COPY agents ./agents

RUN pnpm install --frozen-lockfile \
  && pnpm --filter @taskyard/protocol build \
  && pnpm --filter @taskyard/db build \
  && pnpm --filter @taskyard/core build \
  && pnpm --filter server build

ENV TASKYARD_REPO_ROOT=/app
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

# Run from repo root so workspace resolution and TASKYARD_REPO_ROOT stay correct.
CMD ["pnpm", "--filter", "server", "start"]
