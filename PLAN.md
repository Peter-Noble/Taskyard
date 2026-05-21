# Taskyard — v1 Implementation Plan (TypeScript Unified Stack)

## 1. Overview

A self-hosted orchestrator that runs AI coding agents inside isolated Docker containers across a local network of machines. The entire project — server, worker, TUI, and shared infrastructure — is built in TypeScript. A central Next.js server provides a web dashboard and API. Node.js worker processes on each machine spawn containers, stream events, and report health. Agents are implemented as interchangeable scripts stored in the project's `agents/` directory.

### Goals
- Run multiple agent threads in parallel across 2–5 local machines.
- One thread = one Docker container = one git worktree.
- Web UI (mobile-friendly) to create, monitor, and kill threads.
- Real-time event stream per thread (thoughts, file operations, commands).
- GUI app preview via VNC inside every container.
- Terminal UI (TUI) for quick thread management without opening a browser.
- Pluggable agent system: add new agents by adding a folder to `agents/`.
- Single-language codebase: TypeScript everywhere (except agent scripts, which may be Python).

### Non-Goals (v1)
- ZED ACP integration (v2).
- Cloud worker machines.
- Push notifications.
- Fine-grained approval gating (sandbox is the safety boundary).
- Project-specific custom Docker images.
- Rust, Go, or other compiled worker binaries.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    YOUR DESKTOP / SERVER                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Web UI     │  │  Next.js API │  │  WebSocket Hub   │  │
│  │  (Next.js)   │  │  + SQLite    │  │  (port 3001)     │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  TUI (Ink/React) — talks to REST API + WebSocket   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │ WebSocket (worker→server)                 │
        ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  Worker Box 1│      │  Worker Box 2│      │  Worker Box 3│
│  (Linux)     │      │  (Linux)     │      │  (Linux)     │
│              │      │              │      │              │
│ ┌──────────┐ │      │ ┌──────────┐ │      │ ┌──────────┐ │
│ │taskyard  │ │      │ │taskyard  │ │      │ │taskyard  │ │
│ │worker    │ │      │ │worker    │ │      │ │worker    │ │
│ │(Node/TS) │ │      │ │(Node/TS) │ │      │ │(Node/TS) │ │
│ └────┬─────┘ │      │ └────┬─────┘ │      │ └────┬─────┘ │
│      │docker │      │      │docker │      │      │docker │
│      ▼       │      │      ▼       │      │      ▼       │
│ ┌─────────┐  │      │ ┌─────────┐  │      │ ┌─────────┐  │
│ │Thread   │  │      │ │Thread   │  │      │ │Thread   │  │
│ │Container│  │      │ │Container│  │      │ │Container│  │
│ │         │  │      │ │         │  │      │ │         │  │
│ │┌───────┐│  │      │ │┌───────┐│  │      │ │┌───────┐│  │
│ ││agent  ││  │      │ ││agent  ││  │      │ ││agent  ││  │
│ ││script ││  │      │ ││script ││  │      │ ││script ││  │
│ │└───────┘│  │      │ │└───────┘│  │      │ │└───────┘│  │
│ │┌───────┐│  │      │ │┌───────┐│  │      │ │┌───────┐│  │
│ ││xvfb + ││  │      │ ││xvfb + ││  │      │ ││xvfb + ││  │
│ ││x11vnc ││  │      │ ││x11vnc ││  │      │ ││x11vnc ││  │
│ │└───────┘│  │      │ │└───────┘│  │      │ │└───────┘│  │
│ └─────────┘  │      │ └─────────┘  │      │ └─────────┘  │
└──────────────┘      └──────────────┘      └──────────────┘
```

---

## 3. Monorepo Structure

Using **pnpm workspaces** (lightweight, no Turborepo complexity needed for v1):

```
taskyard/
├── PLAN.md                    # This file
├── README.md                  # Setup and usage instructions
├── package.json               # Root workspace config
├── pnpm-workspace.yaml        # Defines apps/* and packages/*
├── agents/                    # Agent implementations
│   ├── cursor/
│   │   ├── manifest.json
│   │   ├── run.py             # or run.ts
│   │   ├── requirements.txt   # or package.json
│   │   └── lib/
│   ├── codex/
│   │   ├── manifest.json
│   │   ├── run.ts
│   │   ├── package.json
│   │   └── src/
│   └── kimi/
│       ├── manifest.json
│       ├── run.py
│       └── requirements.txt
├── images/
│   └── Dockerfile.base
├── packages/
│   ├── protocol/              # Shared TypeScript types
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── websocket.ts   # WS message types
│   │   │   ├── events.ts      # Event stream types
│   │   │   └── api.ts         # REST API types
│   │   └── tsconfig.json
│   ├── db/                    # Shared database schema + client
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── schema.ts      # Drizzle schema
│   │   │   ├── client.ts      # SQLite client setup
│   │   │   └── migrations/
│   │   └── tsconfig.json
│   └── core/                  # Shared business logic (DB operations, port registry, machine picker, vault)
│       ├── package.json
│       ├── src/
│       │   ├── db.ts          # DB singleton
│       │   ├── threads.ts     # Thread CRUD + lifecycle
│       │   ├── machines.ts    # Machine registration & heartbeat
│       │   ├── port-registry.ts
│       │   ├── machine-picker.ts
│       │   ├── vault.ts
│       │   ├── events.ts
│       │   ├── projects.ts
│       │   ├── agents.ts
│       │   ├── hub-client.ts  # HTTP client to hub control API
│       │   ├── dead-workers.ts
│       │   └── format.ts
│       └── tsconfig.json
├── apps/
│   ├── server/                # Next.js central server
│   │   ├── package.json
│   │   ├── next.config.ts
│   │   ├── src/
│   │   │   ├── app/           # App Router pages
│   │   │   ├── lib/
│   │   │   │   ├── api-response.ts
│   │   │   │   └── sse.ts     # SSE streaming helpers
│   │   │   └── api/           # Route handlers
│   │   └── schema.sql
│   ├── hub/                   # Standalone WebSocket hub (Node/TypeScript)
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts       # Hub server entrypoint
│   │   │   ├── worker-socket.ts
│   │   │   └── http-control.ts # HTTP API for server → worker routing
│   │   └── tsconfig.json
│   └── cli/                   # Worker daemon + TUI
│       ├── package.json
│       ├── src/
│       │   ├── main.ts        # Entrypoint, command parsing
│       │   ├── worker.ts      # Worker daemon mode
│       │   ├── tui.tsx        # Ink TUI components
│       │   ├── docker.ts      # Dockerode wrapper
│       │   ├── git.ts         # simple-git operations
│       │   ├── server-ws.ts   # WebSocket client to hub
│       │   ├── thread-handler.ts
│       │   ├── manifest.ts
│       │   ├── events.ts
│       │   ├── config.ts
│       │   ├── specs.ts
│       │   └── protocol.ts    # Machine ID persistence
│       └── tsconfig.json
└── docs/
    └── agent-authoring.md
```

**Root `package.json`:**
```json
{
  "name": "taskyard",
  "private": true,
  "scripts": {
    "dev:server": "pnpm --filter server dev",
    "dev:hub": "pnpm --filter hub dev",
    "dev:worker": "pnpm --filter cli dev:worker",
    "dev:tui": "pnpm --filter cli dev:tui",
    "build": "pnpm -r build",
    "db:push": "pnpm --filter db push"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

**`pnpm-workspace.yaml`:**
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

---

## 4. Component Specifications

### 4.1 Central Server (`apps/server`)

**Stack:** Next.js 15 (App Router) + SQLite (`better-sqlite3`) + Drizzle ORM (optional). The WebSocket hub lives in a separate process (`apps/hub`) to avoid Next.js serverless constraints.

**Responsibilities:**
- Serve the Next.js web UI.
- REST API for thread and machine management.
- SQLite database: machines, threads, events, port allocations, vault.
- API key vault: stores keys in SQLite. For v1 local-only, plaintext is acceptable; encrypt at rest in v2.
- Machine selection: suggest worker based on RAM/CPU headroom; allow manual override.
- Port registry: each machine declares a range; server assigns 2 ports per thread (`web`, `vnc`).
- Event stream storage: append-only structured JSON per thread.
- Project registry: seeded from `projects.json` at repo root on first start; editable via web UI in v2.
- Dead worker detection: if a machine misses 3 consecutive heartbeats (90s), mark it `offline` and set all its non-terminal threads to `error`.
- Configure `serverExternalPackages: ['better-sqlite3']` in `next.config.js` to handle the native addon.

**REST API Endpoints (v1):**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects` | List all projects |
| POST | `/api/threads` | Create a new thread |
| GET | `/api/threads` | List threads (filter by status) |
| GET | `/api/threads/:id` | Get thread details + latest 50 events |
| POST | `/api/threads/:id/kill` | Kill a running thread (status → `error`) |
| POST | `/api/threads/:id/close` | Close a completed/error thread, remove container, archive (status → `closed`) |
| GET | `/api/machines` | List workers + utilization |
| GET | `/api/agents` | List available agent types (reads `agents/` dir) |
| GET | `/api/threads/:id/events` | SSE stream for single-thread events |
| GET | `/api/events` | SSE stream for all events (TUI dashboard) |

**WebSocket Protocol (Hub ↔ Workers):**

The hub (`apps/hub`) runs as a standalone Node process on port 3001. It maintains a map of `machine_id` → `WebSocket` and routes server messages to the correct worker. Both the Next.js API and the hub read/write the same SQLite database (WAL mode).

*Worker → Hub:*
- `register`: `{ type: "register", id: "uuid", hostname: "mini-pc-2", specs: { cpu_cores: 8, ram_gb: 32, gpu: null }, port_range: { start: 30000, end: 31000 } }`
  - The worker ID is deterministic: read from `~/.config/taskyard/machine-id` (generated on first run) or overridden by `--id`.
  - If a socket with the same ID is already connected, the hub closes the old socket and accepts the new one.
- `heartbeat`: `{ type: "heartbeat", machine_id: "uuid", cpu_percent: 45.2, ram_used_gb: 12.4 }`
- `event`: `{ type: "event", thread_id: "uuid", payload: { type: "stdout", ... } }`
- `state_change`: `{ type: "state_change", thread_id: "uuid", state: "running" }`

*Hub → Worker:*
- `spawn_thread`: `{ type: "spawn_thread", thread_id: "uuid", project: "my-app", repo_url: "https://...", branch: "feature-x", agent_type: "codex", prompt: "...", ports: { web: 30001, vnc: 30002 }, env: { OPENAI_API_KEY: "...", CURSOR_API_KEY: "...", GIT_PAT: "..." } }`
  - `env` contains all API keys for the requested agent type (queried from the vault) plus `GIT_PAT`.
- `kill_thread`: `{ type: "kill_thread", thread_id: "uuid" }`
- `close_thread`: `{ type: "close_thread", thread_id: "uuid" }`
- `ping`: `{ type: "ping" }` (worker must respond with `pong`)

### 4.2 CLI Package (`apps/cli`)

**Stack:** Node.js + TypeScript (`tsx` for dev, `esbuild` for bundling). Key dependencies: `commander`, `dockerode`, `ws`, `simple-git`, `ink`, `chalk`, `ora`, `systeminformation`.

**Subcommands:**
```bash
# Worker daemon mode
npx taskyard worker --hub ws://192.168.1.100:3001 --name "mini-pc-2" --ports 30000-31000

# TUI mode
npx taskyard tui --server http://192.168.1.100:3000
```

**Worker Mode Responsibilities:**
1. On startup, parse CLI args, connect WebSocket to the hub.
2. Send `register` message with machine specs (using `systeminformation` for CPU/RAM).
3. Every 30s, send `heartbeat` with current utilization.
4. On `spawn_thread`:
   - Ensure bare mirror exists at `~/.cache/taskyard/repos/{project}.git`. If not, clone `repo_url`. If yes, `git remote update` via `simple-git`.
   - Create git worktree: `git worktree add /tmp/taskyard-wt-{thread_id} {branch}`.
   - If branch doesn't exist: `git worktree add -b {branch} /tmp/taskyard-wt-{thread_id} origin/main` (or default branch).
   - Parse agent manifest from `agents/{agent_type}/manifest.json`.
   - Determine `Cmd` from manifest:
     - `language: "python"` → `['python3', '/agent/' + manifest.entrypoint]`
     - `language: "typescript"` or `"javascript"` → `['npx', 'tsx', '/agent/' + manifest.entrypoint]`
   - Build and execute `docker run` via `dockerode`:
     ```ts
     docker.createContainer({
       Image: 'taskyard-base-image',
       name: `taskyard-${threadId}`,
       HostConfig: {
         Binds: [
           `/tmp/taskyard-wt-${threadId}:/workspace`,
           `${agentsDir}/${agentType}:/agent:ro`,
         ],
         PortBindings: {
           '5900/tcp': [{ HostPort: `${vncPort}` }],
           '8080/tcp': [{ HostPort: `${webPort}` }],
         },
         AutoRemove: true,
       },
       Env: [
         `TASKYARD_THREAD_ID=${threadId}`,
         `TASKYARD_PROJECT=${project}`,
         `TASKYARD_PROMPT=${prompt}`,
         `TASKYARD_WORKSPACE=/workspace`,
         `TASKYARD_GIT_PAT=${env.GIT_PAT ?? ''}`,
         ...Object.entries(env).map(([k, v]) => `${k}=${v}`),
       ],
       Cmd, // determined from manifest above
     });
     ```
   - The agent's dev server must bind to port 8080 inside the container so the host mapping works.
   - Attach to container stdout/stderr, parse JSON lines, forward to hub via WebSocket.
5. On `kill_thread`:
   - `docker.getContainer(id).stop({ t: 10 })`. `AutoRemove: true` handles container cleanup.
   - `git worktree remove /tmp/taskyard-wt-{thread_id}` (with `--force` if dirty) via `simple-git`.
   - Report `state_change: error`.
6. On `close_thread`:
   - `docker.getContainer(id).remove({ force: true })` if still present (inspect first to avoid racing AutoRemove).
   - `git worktree remove /tmp/taskyard-wt-{thread_id}` (with `--force` if dirty).
   - Report `state_change: closed`.
7. On disconnect, reconnect with exponential backoff (using `ws` reconnect logic or `reconnecting-websocket`).

**TUI Mode Responsibilities:**
- Uses `ink` (React for terminals).
- Screens as React components:
  - **`<Dashboard>`**: Machines table (status, CPU, RAM), threads table (status, project, agent, machine). Color-coded with `chalk`.
  - **`<ThreadDetail>`**: Live event stream in a scrollable box. Action bar: `[Kill] [Close]`.
  - **`<CreateThread>`**: Form with `ink-text-input`. Project dropdown, agent dropdown (fetched from `/api/agents`), prompt textarea, machine selector (auto-suggested), branch input.
- Talks to server via REST API (`fetch`) + SSE (`GET /api/events`) for real-time events.
- Keyboard shortcuts: `q` quit, `k` kill, `n` new thread, `r` refresh, `Tab` switch focus.

### 4.3 Agent Scripts (`agents/`)

Each agent type is a self-contained folder:

```
agents/
├── cursor/
│   ├── manifest.json
│   ├── run.py             # or run.ts
│   ├── requirements.txt   # or package.json
│   └── lib/
├── codex/
│   ├── manifest.json
│   ├── run.ts
│   ├── package.json
│   └── src/
└── kimi/
    ├── manifest.json
    ├── run.py
    └── requirements.txt
```

**Manifest Schema (`manifest.json`):**
```json
{
  "name": "Cursor",
  "description": "Cursor SDK agent",
  "version": "1.0.0",
  "entrypoint": "run.py",
  "language": "python",
  "env_vars": ["CURSOR_API_KEY"]
}
```

**Script Interface:**

The script runs inside the container with these environment variables:
| Variable | Description |
|----------|-------------|
| `TASKYARD_THREAD_ID` | UUID for this thread |
| `TASKYARD_PROJECT` | Project name |
| `TASKYARD_PROMPT` | The user's prompt |
| `TASKYARD_WORKSPACE` | Absolute path to the git worktree (e.g., `/workspace`) |
| `TASKYARD_GIT_PAT` | Git HTTPS personal access token for pushes (injected from vault) |
| `OPENAI_API_KEY` | For Codex / OpenAI agents (injected from vault) |
| `CURSOR_API_KEY` | For Cursor agent (injected from vault) |
| `KIMI_API_KEY` | For Kimi agent (injected from vault) |

**Script Output (JSON Lines to stdout):**
```json
{"type":"system","event":"start","timestamp":"2026-05-18T23:00:00Z"}
{"type":"thought","content":"I'll examine the auth module.","timestamp":"..."}
{"type":"file_read","path":"/workspace/src/auth.rs","timestamp":"..."}
{"type":"file_write","path":"/workspace/src/auth.rs","size_bytes":1240,"timestamp":"..."}
{"type":"command_run","command":"cargo check","exit_code":0,"output":"Compiling...","timestamp":"..."}
{"type":"system","event":"complete","status":"success","timestamp":"..."}
{"type":"error","message":"API rate limit exceeded","timestamp":"..."}
```

**Script Requirements:**
- Emit **valid JSON lines** to stdout. Invalid lines are treated as raw `stdout` events by the worker.
- Instrument file writes: emit `file_write` **after** the write succeeds.
- Instrument commands: emit `command_run` **after** command completes with exit code.
- Catch exceptions and emit `error` event before exiting.
- Write all file changes to `TASKYARD_WORKSPACE`.
- Run autonomously to completion in v1 (no stdin interaction needed).

**Base Docker Image (`images/Dockerfile.base`):**
```dockerfile
FROM ubuntu:24.04

RUN apt-get update && apt-get install -y \
    git curl wget ca-certificates \
    python3 python3-pip python3-venv \
    nodejs npm \
    rustc cargo \
    xvfb x11vnc fluxbox \
    && rm -rf /var/lib/apt/lists/*

# Install common agent SDKs globally
RUN pip3 install openai cursor-sdk kimi-sdk  # adjust package names as needed
RUN npm install -g tsx typescript

# VNC setup
ENV DISPLAY=:99
EXPOSE 5900

CMD ["bash"]
```

---

## 5. Shared Packages

### 5.1 `packages/protocol`

Single source of truth for all TypeScript types used across server, worker, and TUI.

```ts
// src/websocket.ts
export type WorkerMessage =
  | { type: 'register'; id: string; hostname: string; specs: MachineSpecs; port_range: PortRange }
  | { type: 'heartbeat'; machine_id: string; cpu_percent: number; ram_used_gb: number }
  | { type: 'event'; thread_id: string; payload: AgentEvent }
  | { type: 'state_change'; thread_id: string; state: ThreadState };

export type ServerMessage =
  | { type: 'spawn_thread'; thread_id: string; project: string; repo_url: string; branch: string; agent_type: string; prompt: string; ports: { web: number; vnc: number }; env: Record<string, string> }
  | { type: 'kill_thread'; thread_id: string }
  | { type: 'close_thread'; thread_id: string }
  | { type: 'ping' };

// src/events.ts
export type AgentEvent =
  | { type: 'system'; event: string; [key: string]: unknown }
  | { type: 'thought'; content: string }
  | { type: 'file_read'; path: string }
  | { type: 'file_write'; path: string; size_bytes?: number }
  | { type: 'command_run'; command: string; exit_code: number; output?: string }
  | { type: 'error'; message: string };

export type ThreadState = 'pending' | 'spawning' | 'running' | 'paused' | 'completed' | 'error' | 'closed';
```

**Benefit:** Server and worker both import from `@taskyard/protocol`. Types never drift.

### 5.2 `packages/db`

Drizzle ORM schema + SQLite client, shared by `packages/core` and any app that needs direct DB access.

### 5.3 `packages/core`

Business-logic layer that sits between the HTTP/WebSocket handlers and the database. All DB mutations, port allocation, machine selection, vault access, and hub-client communication live here. Server routes and the hub both import from `@taskyard/core` rather than touching `@taskyard/db` directly. This keeps the API routes thin and ensures business rules are enforced in one place.

Key modules:
- `threads.ts` — thread CRUD, creation/kill/close orchestration
- `port-registry.ts` — atomic port allocation via SQLite transactions
- `machine-picker.ts` — selects best online worker by RAM/CPU headroom
- `hub-client.ts` — HTTP client that talks to the hub control API (`HUB_CONTROL_URL`)
- `dead-workers.ts` — heartbeat timeout detection
- `vault.ts` — API key storage and agent env assembly

```ts
// src/schema.ts
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const machines = sqliteTable('machines', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ipAddress: text('ip_address'),
  portRangeStart: integer('port_range_start').notNull(),
  portRangeEnd: integer('port_range_end').notNull(),
  cpuCores: integer('cpu_cores'),
  ramGb: integer('ram_gb'),
  gpuInfo: text('gpu_info'),
  status: text('status', { enum: ['online', 'offline', 'busy'] }).default('offline'),
  lastHeartbeat: integer('last_heartbeat', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  repoUrl: text('repo_url').notNull(),
  defaultBranch: text('default_branch').default('main'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const threads = sqliteTable('threads', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id),
  machineId: text('machine_id').references(() => machines.id),
  agentType: text('agent_type').notNull(),
  branch: text('branch').notNull(),
  prompt: text('prompt').notNull(),
  status: text('status', { enum: ['pending', 'spawning', 'running', 'paused', 'completed', 'error', 'closed'] }).default('pending'),
  worktreePath: text('worktree_path'),
  containerId: text('container_id'),
  webPort: integer('web_port'),
  vncPort: integer('vnc_port'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  closedAt: integer('closed_at', { mode: 'timestamp' }),
});

export const events = sqliteTable('events', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  threadId: text('thread_id').references(() => threads.id),
  eventType: text('event_type').notNull(),
  payload: text('payload').notNull(), // JSON string
  timestamp: integer('timestamp', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const portAllocations = sqliteTable('port_allocations', {
  port: integer('port').primaryKey(),
  machineId: text('machine_id').references(() => machines.id),
  threadId: text('thread_id').references(() => threads.id),
  purpose: text('purpose', { enum: ['web', 'vnc'] }),
  allocatedAt: integer('allocated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const vault = sqliteTable('vault', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  agentType: text('agent_type').notNull(),
  keyName: text('key_name').notNull(),
  keyValue: text('key_value').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
```

---

## 6. Data Flow & Thread Lifecycle

```
User clicks "New Thread" in Web UI / TUI
        │
        ▼
Server validates input, selects machine (auto or manual)
        │
        ▼
Server assigns ports, inserts thread row (status: pending)
        │
        ▼
Server sends `spawn_thread` to worker via WebSocket
        │
        ▼
Worker sets status: spawning
Worker clones/updates bare mirror (simple-git)
Worker creates git worktree
Worker runs `dockerode.createContainer()` + `start()`
Worker sets status: running
        │
        ▼
Agent script runs inside container
Emits JSON events → container stdout → Worker attach stream → Server → Web UI
        │
        ▼
Script exits (success or error)
Worker detects container exit via Docker events
Worker sets status: completed or error
Worker sends final state_change
        │
        ▼
User clicks "Close Thread"
Worker removes container (if still present)
Worker removes git worktree (simple-git)
Server frees ports
Server sets status: closed
```

**Kill Flow:**
User clicks "Kill" → Server sends `kill_thread` → Worker `container.stop()` then `container.remove()` → Worker removes worktree → Status: `error`.

**Close Flow:**
User clicks "Close" on a completed/error thread → Server sends `close_thread` → Worker removes container (if present) → Worker removes worktree → Server frees ports → Status: `closed`.

---

## 7. Port Allocation Strategy

- Each machine declares a range in its worker config (e.g., `30000-31000`).
- Server maintains `port_allocations` table.
- On spawn: server finds 2 free ports in that machine's range (`web`, `vnc`), inserts rows, includes them in `spawn_thread` message.
- On close/kill: server deletes port rows.
- Inside container:
  - Agent's dev server binds to port 8080.
  - Worker maps `web_port:8080` via Docker PortBindings.
  - x11vnc binds to 5900 inside container. Worker maps `vnc_port:5900`.
- Web UI shows: `http://{machine_ip}:{web_port}` and VNC connection string.

---

## 8. Git Strategy

1. **Bare mirror per project per machine:**
   `~/.cache/taskyard/repos/{project_name}.git`
2. **Update before spawn:**
   - If missing: `git clone --mirror {repo_url} {path}` (via `simple-git`)
   - If exists: `git remote update`
3. **Worktree creation:**
   `git worktree add /tmp/taskyard-wt-{thread_id} {branch}`
   - If branch doesn't exist: `git worktree add -b {branch} /tmp/taskyard-wt-{thread_id} origin/main`
4. **Cleanup:**
   `git worktree remove /tmp/taskyard-wt-{thread_id}` (with `--force` if dirty)
5. **Authentication:**
   - HTTPS with PAT token injected via `GIT_ASKPASS` script or `.netrc` file inside container.
   - Server stores PAT in the vault table, passes it in `spawn_thread.env` as `GIT_PAT`. The worker forwards it to the container as `TASKYARD_GIT_PAT`.

---

## 9. GUI Preview

Every container runs a virtual display:
- `Xvfb :99 -screen 0 1920x1080x24` (virtual framebuffer)
- `x11vnc -display :99 -forever -nopw` (VNC server on port 5900)
- `fluxbox` (lightweight window manager)

If the agent launches a GUI app, it renders to `:99`. The user connects via VNC viewer to `worker-ip:vnc_port`.

Web UI provides an "Open Desktop" button that launches the system VNC viewer (`vnc://{machine_ip}:{vnc_port}`). noVNC embedding is deferred to v2.

For web apps, the agent's dev server binds to its normal port. The worker forwards `web_port` to it. Web UI shows a direct link.

---

## 10. Web UI Design (`apps/server/src/app/`)

**Pages:**
- `/` — Dashboard
  - Grid of active threads (project, agent type, status badge, machine, running time).
  - Machine capacity bars (CPU/RAM usage from last heartbeat).
  - "New Thread" button → opens modal.
- `/threads/:id` — Thread Detail
  - Live event stream via SSE `GET /api/threads/:id/events` (auto-scrolling terminal, color-coded by event type).
  - Sidebar: project info, branch, ports (clickable links), machine name.
  - Actions: Kill (if running), Close (if completed/error).
  - Event filter tabs: All / Thoughts / Files / Commands.
- `/machines` — Machines List
  - Each machine: name, IP, specs, active threads, port range utilization.
- `/history` — Closed Threads
  - Searchable archive by project, prompt, date.

**Mobile:**
- Responsive stacking layout.
- Touch-friendly buttons (min 44px).
- SSE for mobile browser compatibility.

---

## 11. TUI Design (`apps/cli/src/tui.tsx`)

Using `ink` (React for terminals):

```tsx
// Main App component
<App>
  <Dashboard />      // Default view: machines + threads tables
  <ThreadDetail />   // Navigated via Enter on a thread
  <CreateThread />   // Navigated via 'n'
</App>
```

**Components:**
- **`<Dashboard>`**: Two-panel layout. Left: machines table. Right: threads table. Status colors via `chalk`.
- **`<ThreadDetail>`**: Top half: thread metadata + action bar (`[Kill] [Close] [Back]`). Bottom half: `<EventStream>` component.
- **`<EventStream>`**: Scrollable box. Receives events via SSE (`GET /api/events`). Auto-scrolls to bottom. Color-codes: thoughts (blue), files (green), commands (yellow), errors (red).
- **`<CreateThread>`**: Multi-step form using `ink-text-input`, `ink-select-input`. Steps: project → agent type → prompt → machine (auto-suggested) → branch.

**Keybindings:**
- `q` — quit
- `n` — new thread
- `k` — kill selected thread
- `Enter` — open thread detail
- `Esc` / `b` — back
- `r` — refresh data
- `Tab` — switch focus between panels

---

## 12. Implementation Phases

### Phase 0: Monorepo Scaffold (Day 1)
- [x] Initialize root with `pnpm init`, `pnpm-workspace.yaml`.
- [x] Create `packages/protocol` with shared types.
- [x] Create `packages/db` with Drizzle schema + `better-sqlite3`.
- [x] Initialize `apps/server` with `create-next-app`; configure `serverExternalPackages: ['better-sqlite3']`.
- [x] Initialize `apps/hub` with TypeScript + `tsx` + `ws` setup.
- [x] Initialize `apps/cli` with TypeScript + `tsx` setup.
- [x] Create base `Dockerfile.base`.
- [x] Create `agents/cursor/`, `agents/codex/`, `agents/kimi/` stubs with `manifest.json`.
- [x] Add root scripts: `dev:server`, `dev:hub`, `dev:worker`, `dev:tui`, `db:push`.

### Phase 1: Server Core (Days 2–4)
- [x] Drizzle schema push to SQLite (WAL mode).
- [x] REST API: projects (seeded from `projects.json`), threads, machines, agents list.
- [x] Standalone WebSocket hub (`apps/hub`) on port 3001: accepts worker connections, handles register/heartbeat/event/state_change, routes spawn/kill/close.
- [x] Port registry logic (2 ports per thread).
- [x] Vault API: store/retrieve API keys by agent type.
- [x] Dead worker detection: 90s timeout → mark offline, threads → error.
- [x] Simple dashboard page with static data.

### Phase 2: Worker Core (Days 5–7)
- [x] CLI argument parsing with `commander` (`--hub`, `--name`, `--ports`, `--id`).
- [x] Worker mode: WebSocket client to hub, register (deterministic ID), heartbeat (`systeminformation`).
- [x] Docker spawn/kill with `dockerode`; read manifest to build `Cmd`.
- [x] Git bare mirror + worktree with `simple-git`.
- [x] Event capture from container attach stream.
- [x] Test on single machine (server + hub + worker on localhost).
- [x] End-to-end test with `agents/codex` on localhost.

### Phase 3: Agent Scripts (Days 8–10)
- [x] Codex agent (`agents/codex/run.ts`) — uses native `fetch` to OpenAI Chat Completions API with tool calling (avoids container Node module resolution issues).
- [x] Cursor agent (`agents/cursor/run.ts`) — uses official `@cursor/sdk` TypeScript SDK with local agent mode and event streaming.
- [x] Kimi agent (`agents/kimi/run.py`) — uses OpenAI Python SDK pointing to Moonshot base URL (`https://api.moonshot.cn/v1`).
- [x] Standardized JSON event emission (`system`, `thought`, `file_read`, `file_write`, `command_run`, `error`) with ISO 8601 timestamps across all three.
- [x] Tested each agent manually: syntax validated, executes correctly, emits valid JSON lines, handles API errors gracefully.
- [x] Updated `images/Dockerfile.base` to install `openai` Python package robustly (removed `|| true`).

### Phase 4: Web UI Polish (Days 11–13)
- [ ] Thread creation modal with agent dropdown (fetched from `/api/agents`).
- [ ] Real-time event stream via SSE.
- [ ] Thread detail page with event filtering.
- [ ] Machine list page.
- [ ] Mobile responsiveness pass.

### Phase 5: Multi-Machine & TUI (Days 14–16)
- [ ] Deploy `apps/cli` to 2+ remote machines (`git clone && pnpm install && pnpm worker`).
- [ ] Verify machine auto-selection algorithm.
- [ ] Build TUI with `ink`: dashboard, thread list, create flow, kill action.
- [ ] TUI uses SSE (`GET /api/events`) for real-time dashboard.
- [ ] End-to-end test: create from TUI, watch in Web UI, kill from either.

### Phase 6: VNC & GUI Preview (Days 17–18)
- [ ] Verify xvfb + x11vnc in base image.
- [ ] Test GUI app launch inside container.
- [ ] Web UI "Open Desktop" button (launches system VNC viewer).
- [ ] Port link for web apps.

### Phase 7: Cleanup & Hardening (Days 19–20)
- [x] Worktree cleanup on thread close/kill.
- [x] Container removal verification (inspect-before-remove to avoid AutoRemove race).
- [x] Error handling: worker spawn/kill/close rejections caught and forwarded as events.
- [x] Hub control API auth (`HUB_CONTROL_TOKEN` / `X-Hub-Token`).
- [ ] Error handling: worker disconnect, Docker failure, agent crash, git failure (partial — spawn/kill covered).
- [ ] Write `README.md` and `docs/agent-authoring.md`.
- [ ] Basic auth for web UI (local-only password via env var).

---

## 13. Key Design Decisions (Final)

| Decision | Choice |
|----------|--------|
| Language | TypeScript everywhere (unified stack) |
| Package manager | pnpm workspaces |
| Sandbox | Docker containers (pluggable for BoxLite later) |
| Server | Next.js + SQLite + Drizzle ORM |
| Worker | Node.js/TypeScript CLI (`dockerode`, `ws`, `simple-git`) |
| TUI | Ink (React for terminals) |
| Agent system | Script-based, one folder per agent in `agents/` |
| Agent interface | Env vars in, JSON lines to stdout |
| Communication | Worker-initiated WebSocket to hub (`apps/hub`) |
| Client real-time | SSE for browsers and TUI |
| Git auth | HTTPS with PAT tokens (injected via `GIT_PAT`) |
| Worktree strategy | Bare mirror + per-thread worktree |
| Port allocation | Server-managed range per machine (2 ports: web, vnc), atomic via SQLite transactions |
| GUI preview | xvfb + x11vnc in every container |
| Real-time UI | SSE for browsers/TUI (server polls DB), WebSocket for workers |
| Hub auth | `HUB_CONTROL_TOKEN` env var + `X-Hub-Token` header |
| Approval flow | v1: autonomous (kill switch only) |
| ZED integration | v2 (TUI or ACP) |
| History storage | Append-only event stream in SQLite |
| Env var registry | `.env` file at repo root with commented placeholders for all variables |

> **Convention:** When adding a new environment variable anywhere in the codebase, always add a commented placeholder to the `.env` file at the repo root so the full configuration surface stays documented in one place.

---

## 14. Open Questions for Implementation

1. **Cursor SDK specifics:** Verified — `@cursor/sdk` npm package (TypeScript, public beta as of April 2026). Local mode with `Agent.create({ local: { cwd } })`. Authenticates via `CURSOR_API_KEY`.
2. **Kimi SDK:** Confirm `kimi-sdk` or equivalent package for Moonshot AI.
3. **Docker image size:** The fat image may be 3–5 GB. Acceptable for local network, but monitor build times.
4. **Worker deployment:** For v1, workers are deployed via `git clone && pnpm install`. Later, consider bundling `apps/cli` with `esbuild` into a single JS file, or using `pkg` to create a standalone executable.
5. **Auto-loading `.env`:** The project does not currently auto-load `.env` files. Consider adding `dotenv` to `apps/server`, `apps/hub`, and `apps/cli` entrypoints so `.env.local` is picked up automatically.
