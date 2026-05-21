# Taskyard

Self-hosted orchestrator that runs AI coding agents inside isolated Docker containers across a local network of machines.

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/) 9+
- Docker (for workers, Phase 2+)

## Setup

```bash
pnpm install
pnpm db:push
```

## Development

```bash
# Terminal 1 — Next.js server (port 3000)
pnpm dev:server

# Terminal 2 — WebSocket hub (port 3001, control API on 3002)
pnpm dev:hub

# Terminal 3 — worker daemon (Linux with Docker)
pnpm dev:worker -- --hub ws://localhost:3001 --name my-machine --ports 30000-31000

# Terminal 4 — terminal UI
pnpm dev:tui -- --server http://localhost:3000
```

## Monorepo layout

| Path | Description |
|------|-------------|
| `apps/server` | Next.js web UI + REST API |
| `apps/hub` | WebSocket hub for workers |
| `apps/cli` | Worker daemon + Ink TUI |
| `packages/protocol` | Shared TypeScript types |
| `packages/core` | Shared business logic (ports, threads, vault) |
| `packages/db` | Drizzle schema + SQLite client |
| `agents/` | Pluggable agent scripts |
| `images/` | Base Docker image |

## API keys (vault)

```bash
curl -X PUT http://localhost:3000/api/vault \
  -H "Content-Type: application/json" \
  -d '{"agent_type":"codex","keys":{"OPENAI_API_KEY":"sk-..."}}'

curl -X PUT http://localhost:3000/api/vault \
  -H "Content-Type: application/json" \
  -d '{"agent_type":"_global","keys":{"GIT_PAT":"ghp_..."}}'
```

## Create a thread

```bash
# List projects to get project_id
curl http://localhost:3000/api/projects

curl -X POST http://localhost:3000/api/threads \
  -H "Content-Type: application/json" \
  -d '{"project_id":"<uuid>","agent_type":"codex","branch":"main","prompt":"Fix the login bug"}'
```

## Phase 2: local end-to-end

```bash
# Build the agent container image (once)
docker build -f images/Dockerfile.base -t taskyard-base-image .

# Terminal 1–3: hub, server, worker
pnpm dev:hub
pnpm dev:server
pnpm dev:worker -- --hub ws://localhost:3001 --name local --ports 30000-31000

# Seed vault keys, then create a thread (see above).
# Worker clones the repo mirror, creates a worktree, runs agents/codex in Docker,
# and streams JSON events back to the hub.
```

See [PLAN.md](./PLAN.md) for the full implementation plan.

## Docker base image

```bash
docker build -f images/Dockerfile.base -t taskyard-base-image .
```
