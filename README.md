# Taskyard

Self-hosted orchestrator that runs AI coding agents (Cursor / Kimi via ACP) across a local machine — create threads, stream events, manage tasks. See [docs/mvp.md](./docs/mvp.md) for the current MVP scope.

## Prerequisites

- Node.js 20+ (rebuild `better-sqlite3` if you switch Node versions: `pnpm rebuild better-sqlite3`)
- [pnpm](https://pnpm.io/) 9+
- For ACP agents: [Cursor CLI](https://cursor.com/docs/cli) (`agent login`) and/or Kimi CLI (`kimi login`)

## Setup

```bash
pnpm install
pnpm rebuild better-sqlite3   # if native module ABI mismatches
pnpm db:push                  # fresh DB — or pnpm db:migrate-mvp on an existing data/taskyard.db
pnpm --filter cli build
```

## Development (MVP dogfood)

```bash
# Terminal 1 — Next.js server (port 3000)
pnpm dev:server

# Terminal 2 — WebSocket hub (workers ws://127.0.0.1:3001, control API http://127.0.0.1:3002)
pnpm dev:hub

# Terminal 3 — worker (host ACP, no sandbox)
pnpm dev:worker -- --hub ws://localhost:3001 --name local --local --ports 30000-31000
```

Then in the browser: http://localhost:3000 — create a task, start a `stub` or `cursor` thread, send follow-ups.

### Agent task CLI

```bash
pnpm --filter cli build
node apps/cli/dist/main.js task list --pretty
node apps/cli/dist/main.js task create --project <project_id> --title "Ship MVP" --description "..."
node apps/cli/dist/main.js task claim <short_id> --as me
node apps/cli/dist/main.js task status <short_id> in_progress
node apps/cli/dist/main.js task decision add --task <short_id> --choice "..." --why "..."
```

Each project checkout has `.taskyard/project.json`, `.taskyard/decisions.md`, and a Taskyard section in `AGENTS.md`. Commit all three. `taskyard setup --project <id>` creates the project file, refreshes the decision file, and installs or updates that `AGENTS.md` section from the CLI contract. Any later `taskyard` command run in that checkout rewrites the section when the contract hash inside it is missing or no longer matches, and prints the new instructions before its normal output. `taskyard sync` copies decisions from the server into `.taskyard/decisions.md` without duplicating ids already there. Everyone working on the repo uses the same Taskyard server; git carries the files between checkouts. Workers still put `taskyard` on `PATH` and set the thread id for agents they spawn. Thread prompts still include the contract for sessions Taskyard starts.

## Monorepo layout

| Path | Description |
|------|-------------|
| `apps/server` | Next.js web UI + REST API |
| `apps/hub` | WebSocket hub for workers |
| `apps/cli` | Worker daemon, `taskyard task` CLI, Ink TUI stub |
| `packages/protocol` | Shared TypeScript types |
| `packages/core` | Shared business logic (tasks, threads, vault) |
| `packages/db` | Drizzle schema + SQLite client |
| `agents/` | Manifests (`cursor`, `kimi` ACP; `stub` for free tests) |

## Create a thread

```bash
curl http://localhost:3000/api/projects

curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"project_id":"<uuid>","title":"Fix login","description":"..."}'

curl -X POST http://localhost:3000/api/threads \
  -H "Content-Type: application/json" \
  -d '{"project_id":"<uuid>","agent_type":"stub","branch":"main","task_id":"<task_id>"}'
```

## Tests

```bash
pnpm test
```

Uses a temp SQLite DB and `agents/stub` for zero-token checks.

See [docs/mvp.md](./docs/mvp.md). Historical plan: [PLAN.md](./PLAN.md).
