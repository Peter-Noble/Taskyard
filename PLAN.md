# Taskyard — v1 Implementation Plan (TypeScript Unified Stack)

## 1. Overview

A self-hosted orchestrator that runs AI coding agents inside isolated **SmolVM** micro-VMs across a local network of machines. The entire project — server, worker, TUI, and shared infrastructure — is built in TypeScript. A central Next.js server provides a web dashboard and API. Node.js worker processes on each machine spawn VMs, stream events, and report health. Agents are implemented as interchangeable scripts stored in the project's `agents/` directory.

**Sandbox change (planned):** Replace per-thread Docker containers with [smolvm](https://github.com/smol-machines/smolvm) — sub-second cold start, hardware isolation (KVM / Apple Hypervisor), and a single portable `.smolmachine` base instead of a multi-GB image rebuild per task.

### Goals
- Run multiple agent threads in parallel across 2–5 local machines.
- One thread = one SmolVM instance = one git worktree.
- Web UI (mobile-friendly) to create, monitor, and kill threads.
- Real-time event stream per thread (thoughts, file operations, commands).
- **Web app preview:** dev server port-forwarded from the VM to the worker host (unchanged intent).
- **Desktop / native GUI builds:** agent emits an `artifact` event; worker copies the binary (or bundle) from the VM to a host path the user can run locally — no in-VM remote desktop.
- Terminal UI (TUI) for quick thread management without opening a browser.
- Pluggable agent system: add new agents by adding a folder to `agents/`.
- Single-language codebase: TypeScript everywhere (except agent scripts, which may be Python).

### Non-Goals (v1)
- ZED ACP integration (v2).
- Cloud worker machines.
- Push notifications.
- Fine-grained approval gating (sandbox is the safety boundary).
- Per-project custom sandbox images (one shared Taskyard `.smolmachine` base; agents stay script-mounted).
- RustDesk / Xvfb / in-sandbox remote desktop preview (dropped).
- Rust, Go, or other compiled worker binaries.

### Current status (May 2026)

| Phase | Status |
|-------|--------|
| 0 — Scaffold | Complete |
| 1 — Server core | Complete |
| 2 — Worker core | Complete (manual localhost E2E, codex) |
| 3 — Agent scripts | Complete (manual validation) |
| 4 — Web UI v2 | **Mostly complete** — design imported; responsive QA + live smoke pending |
| 5 — Multi-machine & TUI | Not started (TUI is a stub) |
| 6 — SmolVM sandbox | **Planned** — replaces Docker + RustDesk (§2.1, §9, Phase 6) |
| 7 — Hardening | Partial (README, agent-authoring, dotenv done; auth pending) |
| 8 — Automated testing | **In progress** — Vitest harness, 10 tests passing, `agents/stub` (§15) |

**Recent change:** commit `New design` imported `design/v2/` into Next.js — multi-route shell, three-pane dashboard, test-data mode, SSE wiring. Phase checklist below reflects this; §10 documents the v2 IA.

**Planned change:** migrate worker sandbox from Docker to SmolVM; drop RustDesk; use artifact copy-out for native GUI deliverables.

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
│      │smolvm│      │      │smolvm│      │      │smolvm│
│      ▼       │      │      ▼       │      │      ▼       │
│ ┌─────────┐  │      │ ┌─────────┐  │      │ ┌─────────┐  │
│ │Thread   │  │      │ │Thread   │  │      │ │Thread   │  │
│ │  VM     │  │      │ │  VM     │  │      │ │  VM     │  │
│ │         │  │      │ │         │  │      │ │         │  │
│ │┌───────┐│  │      │ │┌───────┐│  │      │ │┌───────┐│  │
│ ││agent  ││  │      │ ││agent  ││  │      │ ││agent  ││  │
│ ││script ││  │      │ ││script ││  │      │ ││script ││  │
│ │└───────┘│  │      │ │└───────┘│  │      │ │└───────┘│  │
│ │ worktree│  │      │ │ worktree│  │      │ │ worktree│  │
│ │  mount  │  │      │ │  mount  │  │      │ │  mount  │  │
│ └─────────┘  │      │ └─────────┘  │      │ └─────────┘  │
└──────────────┘      └──────────────┘      └──────────────┘
         │                     │                     │
         └─────────────────────┴─────────────────────┘
                    artifacts/  (desktop binaries copied out)
```

### 2.1 Design impact — Docker → SmolVM

| Area | Today (Docker) | After (SmolVM) |
|------|----------------|----------------|
| **Isolation unit** | Container sharing host kernel | Micro-VM (libkrun / KVM / Hypervisor.framework) — stronger boundary, aligns with “untrusted agent code” |
| **Cold start** | Image pull + container create (seconds–minutes) | Target **&lt;1s** per thread from a warm `.smolmachine` template |
| **Base runtime** | `images/Dockerfile.base` (~3–5 GB, RustDesk, Xvfb, fluxbox, apt bulk) | One **Taskyard base `.smolmachine`** baked once (git, node, python, agent deps); per-thread cost is VM boot + mounts, not image rebuild |
| **Worker dependency** | `dockerode` + Docker Engine on Linux workers | `smolvm` CLI on PATH; **KVM** on Linux workers, **Hypervisor** on macOS workers; document Windows host limitations (workers likely stay Linux) |
| **Thread identity in DB** | `container_id` | `sandbox_id` (VM name / smolvm id) — migration rename, same lifecycle |
| **Workspace** | Bind-mount worktree → `/workspace` | Mount worktree into guest (smolvm host-mount or equivalent); agent env `TASKYARD_WORKSPACE` unchanged |
| **Agent mount** | `agents/{type}:/agent:ro` | Mount agents dir read-only into guest, or bake agent runners into base machine and only mount workspace |
| **Logs / events** | `docker attach` stdout | `smolvm exec` / guest process stdout piped by worker (same JSON-line parser) |
| **Ports** | 2 per thread: `web` (8080) + `rustdesk` (21116) | **1 per thread:** `web` only (forward guest 8080 → host `web_port`); **halves** port range consumption |
| **GUI preview** | RustDesk to worker IP | **Dropped.** Web apps: link to `http://{machine}:{web_port}`. Native apps: **`artifact` event** + download path on server or `file://` on LAN |
| **Git credentials** | `GIT_PAT` in container env | Prefer **SSH agent forward** into VM where smolvm supports it; keep PAT fallback for HTTPS |
| **Kill / close** | `docker stop` / `remove` | `smolvm stop` / destroy instance; worktree cleanup unchanged |
| **CI / tests** | `DOCKER_E2E=1`, mock `dockerode` | `SMOLVM_E2E=1` (opt-in), mock `smolvm` CLI in unit tests; default CI still no hypervisor |
| **Multi-machine** | Unchanged hub protocol | Same WebSocket messages; `spawn_thread.ports` loses `rustdesk` |

**Risks / open integration work**

1. **Exact smolvm CLI contract** — map Taskyard spawn/kill to stable commands (`run`, `exec`, port forward, copy-out). Pin smolvm version in docs.
2. **Port forwarding API** — confirm how guest :8080 is published to host (may differ from Docker `PortBindings`).
3. **Artifact pipeline** — new agent event type + worker copy from guest → `~/.cache/taskyard/artifacts/{thread_id}/` + optional server upload for remote users.
4. **Architecture match** — `.smolmachine` is arch-specific; workers on `arm64` vs `amd64` need matching base builds.
5. **Transitional period** — Phase 6 implements SmolVM behind a feature flag (`TASKYARD_SANDBOX=smolvm|docker`) until E2E passes, then remove Docker path.

### 2.2 Thread placement (Option A — implemented)

Per-machine scheduling metadata: `scheduling_mode` (`auto` \| `manual_only` \| `disabled`), `pool`, `is_local`, `max_concurrent_threads`, `allowed_agent_types`, `allowed_project_ids`, `priority`.

`POST /api/threads` accepts `placement: { mode: 'auto' \| 'local' \| 'pool' \| 'machine', ... }`. Worker `--local` sets `is_local` on register (only one local worker at a time). `PATCH /api/machines/:id` edits policy. UI: placement radios in New Thread modal; policy table on `/machines`.

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
│   ├── codex/
│   ├── kimi/
│   └── stub/                  # (Phase 8) Deterministic no-AI agent for automated tests
├── design/                    # UI design exports (v2 = production reference)
│   ├── v1/
│   └── v2/
├── sandbox/
│   ├── taskyard-base.smolmachine   # (planned) portable base VM
│   └── build-base.sh               # recipe to bake git/node/python/agent deps
├── images/
│   └── Dockerfile.base             # (deprecated) remove after SmolVM cutover
├── packages/
│   ├── protocol/
│   ├── db/
│   ├── core/
│   └── test-utils/            # (Phase 8) Temp DB, env guards, mock worker
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
│       │   ├── sandbox.ts     # SmolVM CLI wrapper (replaces docker.ts)
│       │   ├── docker.ts      # (deprecated) Dockerode — remove after cutover
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
    "db:push": "pnpm --filter db push",
    "test": "vitest run",
    "test:unit": "vitest run --project unit",
    "test:integration": "vitest run --project integration",
    "test:ui": "vitest run --project ui",
    "test:e2e:sandbox": "cross-env SMOLVM_E2E=1 vitest run --project sandbox-e2e"
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
- Port registry: each machine declares a range; server assigns **1 port per thread** (`web` — dev server preview). RustDesk port removed.
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
- `spawn_thread`: `{ type: "spawn_thread", thread_id: "uuid", project: "my-app", repo_url: "https://...", branch: "feature-x", agent_type: "codex", prompt: "...", ports: { web: 30001 }, env: { OPENAI_API_KEY: "...", CURSOR_API_KEY: "...", GIT_PAT: "..." } }`
  - `env` contains all API keys for the requested agent type (queried from the vault) plus `GIT_PAT`.
- `kill_thread`: `{ type: "kill_thread", thread_id: "uuid" }`
- `close_thread`: `{ type: "close_thread", thread_id: "uuid" }`
- `ping`: `{ type: "ping" }` (worker must respond with `pong`)

### 4.2 CLI Package (`apps/cli`)

**Stack:** Node.js + TypeScript (`tsx` for dev, `esbuild` for bundling). Key dependencies: `commander`, `ws`, `simple-git`, `ink`, `chalk`, `ora`, `systeminformation`. **Sandbox:** invokes `smolvm` CLI (no `dockerode` after cutover).

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
   - Start a SmolVM from `sandbox/taskyard-base.smolmachine` (name: `taskyard-${threadId}`):
     - Mount worktree → guest `/workspace` (read-write).
     - Mount `agents/{agent_type}` → guest `/agent` (read-only).
     - Forward guest **8080** → host `web_port` (dev server preview).
     - Inject env: `TASKYARD_*`, vault keys, optional `GIT_PAT`; enable SSH agent forward when configured.
     - Run agent via manifest `Cmd` inside guest (`smolvm exec` or equivalent).
   - Stream guest stdout/stderr, parse JSON lines, forward to hub via WebSocket (same as today).
   - On agent `artifact` events: copy file(s) from guest path to `~/.cache/taskyard/artifacts/{thread_id}/` on the worker; record metadata in DB for UI download links.
5. On `kill_thread`:
   - `smolvm stop taskyard-${thread_id}` (destroy instance).
   - `git worktree remove /tmp/taskyard-wt-{thread_id}` (with `--force` if dirty) via `simple-git`.
   - Report `state_change: error`.
6. On `close_thread`:
   - Ensure VM is stopped/removed; prune artifact dir if policy says so.
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

The script runs inside the sandbox VM with these environment variables:
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
{"type":"artifact","path":"/workspace/target/release/my-app","name":"my-app","platform":"linux-x64","timestamp":"..."}
```

**`artifact` event (desktop / native deliverables):** Emit when a runnable binary (or archive) is ready. Worker copies from guest to host artifact store. Web UI offers **Download** (and documents how to run on the user's OS). Agents building cross-platform apps should emit one artifact per target or a single archive.

**Script Requirements:**
- Emit **valid JSON lines** to stdout. Invalid lines are treated as raw `stdout` events by the worker.
- Instrument file writes: emit `file_write` **after** the write succeeds.
- Instrument commands: emit `command_run` **after** command completes with exit code.
- Catch exceptions and emit `error` event before exiting.
- Write all file changes to `TASKYARD_WORKSPACE`.
- Run autonomously to completion in v1 (no stdin interaction needed).

**Base sandbox (`sandbox/taskyard-base.smolmachine`):**

Built once per host CPU architecture (see `sandbox/build-base.sh`). Guest includes:

- git, curl, ca-certificates
- python3 + venv, node + npm, `tsx` / typescript globally
- rustc/cargo (for agents that compile native code)
- Common agent SDK deps (OpenAI Python client, etc.)
- **No** Xvfb, fluxbox, or RustDesk

Agents listen on **8080** inside the guest for web preview. Port forward to host `web_port` is configured by the worker at spawn time.

**Legacy:** `images/Dockerfile.base` remains until SmolVM E2E passes; then delete Docker path and README build steps.

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
  | { type: 'spawn_thread'; thread_id: string; project: string; repo_url: string; branch: string; agent_type: string; prompt: string; ports: { web: number }; env: Record<string, string> }
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
  | { type: 'artifact'; path: string; name: string; platform?: string; size_bytes?: number }
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
  sandboxId: text('sandbox_id'),       // smolvm instance id (was container_id)
  webPort: integer('web_port'),
  // rustdesk_port removed — use artifacts for native GUI deliverables
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
  purpose: text('purpose', { enum: ['web'] }),
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
Worker starts SmolVM + agent process
Worker sets status: running
        │
        ▼
Agent script runs inside sandbox VM
Emits JSON events → guest stdout → Worker stream → Server → Web UI
        │
        ▼
Script exits (success or error)
Worker detects VM/process exit
Worker sets status: completed or error
Worker sends final state_change
        │
        ▼
User clicks "Close Thread"
Worker stops/removes VM (if still present)
Worker removes git worktree (simple-git); may retain artifacts until user downloads
Server frees ports
Server sets status: closed
```

**Kill Flow:**
User clicks "Kill" → Server sends `kill_thread` → Worker stops VM → Worker removes worktree → Status: `error`.

**Close Flow:**
User clicks "Close" on a completed/error thread → Server sends `close_thread` → Worker removes VM (if present) → Worker removes worktree → Server frees ports → Status: `closed`.

---

## 7. Port Allocation Strategy

- Each machine declares a range in its worker config (e.g., `30000-31000`).
- Server maintains `port_allocations` table.
- On spawn: server finds **1** free port in that machine's range (`web`), inserts a row, includes it in `spawn_thread` message.
- On close/kill: server deletes port rows.
- Inside sandbox VM:
  - Agent's dev server binds to port **8080**.
  - Worker forwards guest `8080` → host `web_port` (smolvm port-forward; exact flag TBD in Phase 6).
- Web UI shows: `http://{machine_ip}:{web_port}` for web apps.
- **Native GUI:** no port — user downloads artifact(s) from thread detail after agent emits `artifact`.

**Capacity win:** port range supports ~2× as many concurrent threads vs the old 2-port model.

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
   - HTTPS with PAT via `GIT_ASKPASS` or `.netrc` inside the sandbox VM, **or** SSH agent forward (preferred when smolvm supports it).
   - Server stores PAT in the vault table, passes it in `spawn_thread.env` as `GIT_PAT`. The worker forwards it as `TASKYARD_GIT_PAT`.

---

## 9. Preview & Deliverables

### Web apps (unchanged intent)

Agent runs a dev server on **8080** inside the sandbox. Worker forwards to host `web_port`. Web UI shows **Open preview** → `http://{machine_ip}:{web_port}`.

### Desktop / native GUI apps (new — replaces RustDesk)

RustDesk and in-VM remote desktop are **out of scope**. Flow:

1. Agent builds the app inside the sandbox (e.g. `cargo build --release`, `npm run tauri build`).
2. Agent emits `artifact` with guest path and optional `platform` hint.
3. Worker copies file(s) to `~/.cache/taskyard/artifacts/{thread_id}/` on the worker host.
4. Server stores artifact metadata (path on worker, size, name); UI lists **Download** links.
5. User runs the binary on their desktop (same OS/arch as build, or documented cross-compile).

**v1 limitation:** artifacts live on the worker machine that ran the thread; remote download may require a small `GET /api/threads/:id/artifacts/:name` proxy from server → worker (Phase 6). LAN users can also SCP from worker if proxy is deferred.

### Optional later (v2)

- Signed artifact bundles + checksum in event payload.
- Automated “open on host” helper for localhost workers only.

---

## 10. Web UI Design (`apps/server/src/app/`)

> **Design source:** `design/v2/` (HTML/CSS export + `DESIGN-MANIFEST.json` + `DESIGN-HANDOFF.md`). Production tokens and layout live in `apps/server/src/styles/taskyard.css`. v1 export kept under `design/v1/` for reference only.

### 10.1 v2 information architecture

| Route | Component | Role |
|-------|-----------|------|
| `/` | redirect | Redirects to `/overview` |
| `/overview` | `OverviewClient` | Launcher / high-level summary (design entry screen) |
| `/dashboard` | `DashboardClient` | Primary operator surface — three-pane layout |
| `/auto` | `AutoClient` | Automation rules UI (design scaffold; backend rules engine deferred) |
| `/machines` | `MachinesClient` | Worker inventory, specs, port utilization bars |
| `/threads/:id` | `ThreadDetailClient` | Dedicated thread detail + event terminal |

Shared chrome: `AppShell` (nav, branding), `Providers` + `useTestData` (demo mode toggle).

### 10.2 Dashboard layout (v2)

The v2 dashboard replaces the original single-grid dashboard with a **three-pane operator console**:

- **Left — `MachineDock` / `ThreadRailAside`:** online machines as tiles with 4-cell load meters; thread rail with active threads and an inline **thread history** section (replaces the original standalone `/history` route).
- **Center — `ChatStream` or `TaskDetailPane`:** live agent output via SSE when connected to real data; task-detail view when a dashboard task is selected (task rail data from `lib/dashboard-tasks.ts` — design mock, not persisted server-side yet).
- **Right — `TaskRail`:** project task list with statuses, attachments, and “mark ready for agent” affordances from the design export.

**New Thread:** `NewThreadModal` — fetches `/api/projects`, `/api/agents`, `/api/machines`; posts to `/api/threads`.

### 10.3 Thread detail

- Live events via `useEventStream` → SSE `GET /api/threads/:id/events` (initial snapshot from `GET /api/threads/:id`).
- `EventTerminal` + `FilterTabs`: All / Thoughts / Files / Commands.
- Metadata sidebar: project, branch, machine, web preview link, **artifacts** list (when present).
- Actions: Kill (running), Close (completed/error).

### 10.4 Test-data mode (dev / UI testing without live stack)

- **`TestDataToggle`** in the shell toggles `useTestData`.
- When on, pages read from `lib/test-data/fixtures.ts` instead of API routes — no hub, worker, SmolVM, or SQLite writes required.
- Demo thread IDs are namespaced (`isDemoThreadId`) so toggling off never sends live API calls for fixture rows.
- Intended for design QA and future **automated UI tests** (see §15); not a substitute for integration tests against the real API.

### 10.5 Remaining UI work (post–v2 import)

- [ ] Validate responsive layout against the v2 viewport matrix (360px → 1920px); fix horizontal overflow.
- [ ] Wire dashboard **task rail** to real backend data (or explicitly defer and hide in v1).
- [ ] **`/auto` rules engine** — currently design-only; needs API + persistence or removal from nav until ready.
- [ ] Dedicated **`/history`** archive page with search (optional — history is partially inline in the thread rail).
- [ ] Live E2E smoke: create thread from modal → SSE updates on `/dashboard` and `/threads/:id` with test-data off.
- [ ] Touch targets (min 44px) audit on primary actions.
- [ ] **SmolVM UI:** remove RustDesk port chips; add artifact download section; update design fixtures (dashboard/overview copy still references RustDesk).

**Mobile:**
- Responsive rules ported from `design/v2/css/taskyard.css`; not yet verified on all breakpoints.
- SSE for mobile browser compatibility (unchanged).

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
- [x] Create base `Dockerfile.base` (to be superseded by `sandbox/taskyard-base.smolmachine`).
- [x] Create `agents/cursor/`, `agents/codex/`, `agents/kimi/` stubs with `manifest.json`.
- [x] Add root scripts: `dev:server`, `dev:hub`, `dev:worker`, `dev:tui`, `db:push`.

### Phase 1: Server Core (Days 2–4)
- [x] Drizzle schema push to SQLite (WAL mode).
- [x] REST API: projects (seeded from `projects.json`), threads, machines, agents list.
- [x] Standalone WebSocket hub (`apps/hub`) on port 3001: accepts worker connections, handles register/heartbeat/event/state_change, routes spawn/kill/close.
- [x] Port registry logic (2 ports per thread — **migrate to 1** in Phase 6).
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

### Phase 4: Web UI — v2 design import (Days 11–14)
- [x] Import v2 design tokens and global styles (`apps/server/src/styles/taskyard.css`).
- [x] `AppShell` navigation across overview, dashboard, auto, machines.
- [x] Thread creation modal with agent dropdown (fetched from `/api/agents`).
- [x] Real-time event stream via SSE (`useEventStream`, `EventTerminal`, `ChatStream`).
- [x] Thread detail page with event filtering and kill/close actions.
- [x] Machine list page with port utilization bars.
- [x] Three-pane dashboard (`MachineDock`, `TaskRail`, center chat/task pane).
- [x] Test-data mode for UI development without live backend (`fixtures.ts`, `TestDataToggle`).
- [x] Web / RustDesk port chips on thread detail (RustDesk **to be removed** in Phase 6).
- [ ] Responsive viewport validation (see §10.5).
- [ ] Live UI smoke test with test-data off (document in README).
- [ ] Decide fate of `/auto` and dashboard task rail (wire up or defer).

### Phase 5: Multi-Machine & TUI (Days 15–17)
- [ ] Deploy `apps/cli` to 2+ remote machines (`git clone && pnpm install && pnpm worker`).
- [ ] Verify machine auto-selection algorithm.
- [ ] Build TUI with `ink`: dashboard, thread list, create flow, kill action.
- [ ] TUI uses SSE (`GET /api/events`) for real-time dashboard.
- [ ] End-to-end test: create from TUI, watch in Web UI, kill from either.

### Phase 6: SmolVM sandbox & artifacts (Days 18–22)

Replaces Docker + RustDesk. Can run in parallel with Phase 5 if needed.

**6a — Base machine & worker**
- [ ] Install/pin `smolvm` on worker machines; document KVM (Linux) / Hypervisor (macOS) prerequisites.
- [ ] Add `sandbox/build-base.sh` → produce `taskyard-base.smolmachine` (git, node, python, agent deps; no desktop stack).
- [ ] Implement `apps/cli/src/sandbox.ts`: spawn, exec agent, stream logs, stop/destroy, port-forward :8080.
- [ ] Feature flag `TASKYARD_SANDBOX=docker|smolvm` during migration; default `smolvm` when base machine exists.

**6b — Protocol & core**
- [ ] `spawn_thread.ports`: drop `rustdesk`; port registry allocates **one** port per thread.
- [ ] DB migration: `container_id` → `sandbox_id`; drop `rustdesk_port`; add `thread_artifacts` table (or JSON on thread row).
- [ ] `AgentEvent` + protocol: `artifact` type; persist on worker copy-out.

**6c — UI & docs**
- [ ] Thread detail: remove RustDesk chip; add artifacts list + download (or worker-path hint for v1 LAN).
- [ ] Update `docs/agent-authoring.md`, README (no `docker build`; `smolvm` + base machine build).
- [ ] Refresh design fixtures / dashboard mock copy away from RustDesk gates.

**6d — Validation**
- [ ] E2E: stub agent in SmolVM → events in DB → web preview link works.
- [ ] Manual: agent builds a small native binary → `artifact` → file on worker → user runs locally.
- [ ] Remove `dockerode`, `Dockerfile.base`, `docker.ts` after green E2E.

### Phase 7: Cleanup & Hardening (Days 23–24)
- [x] Worktree cleanup on thread close/kill.
- [x] Container removal verification (inspect-before-remove to avoid AutoRemove race).
- [x] Error handling: worker spawn/kill/close rejections caught and forwarded as events.
- [x] Hub control API auth (`HUB_CONTROL_TOKEN` / `X-Hub-Token`).
- [x] Root `README.md` with local dev and E2E curl examples.
- [ ] Error handling: worker disconnect, sandbox spawn failure, agent crash, git failure (partial — spawn/kill covered).
- [x] `docs/agent-authoring.md`.
- [ ] Basic auth for web UI (local-only password via env var).
- [x] Auto-load `.env` in server, hub, and CLI entrypoints (`dotenv`).

### Phase 8: Automated testing (Days 22–26)

Goal: **high confidence without AI spend or production DB risk.** See §15 for architecture.

**Phase 8a — Test harness (Day 22)**
- [x] Add **Vitest** at repo root; `pnpm test`, `pnpm test:unit`, `pnpm test:integration`, `pnpm test:coverage`.
- [x] **`packages/test-utils`**: temp DB factory, env guards, seed helpers.
- [x] Enforce **`TASKYARD_DB_PATH`** in all test runs (temp file); fail fast if path resolves to `data/taskyard.db`.
- [x] Vitest `globalSetup` + schema template copy (fast integration tests; no per-test `drizzle-kit push`).
- [x] Add **`agents/stub/`** agent: emits a deterministic JSON-line script, exits 0 — used for worker/integration tests instead of codex/cursor/kimi.

**Phase 8b — Unit tests (Days 23–24)**
- [ ] `packages/protocol` — type guards / serialization round-trips for WS + event payloads.
- [ ] `packages/core` — port registry, machine picker, vault env assembly, dead-workers, format helpers, thread state transitions (hub client **mocked**).
- [ ] `apps/cli` — log line buffer / JSON parse, manifest → `Cmd` building, config path resolution.
- [ ] `apps/hub` — message routing, duplicate register closes old socket, control API auth.
- [ ] Agent scripts — run stub/no-key paths only (missing API key → error event + exit 1, **no network**).

**Phase 8c — Integration tests (Day 25)**
- [ ] Core thread lifecycle against temp SQLite: create → pending ports → mock `hubSpawn` → state updates → close frees ports.
- [ ] Hub ↔ mock worker WebSocket: register, heartbeat, event append, spawn/kill/close command delivery.
- [ ] Next.js route handlers (`/api/threads`, `/api/vault`, SSE helpers) with injected test DB — no `next dev` required.
- [ ] SSE: emit synthetic events, assert client parser in `useEventStream` logic (extract pure function for testability).

**Phase 8d — UI tests (Day 26)**
- [ ] React Testing Library + **`useTestData` on** — dashboard, thread detail, machines, modal open/submit (fetch mocked).
- [ ] Optional Playwright smoke with test-data off against **`taskyard test-server`** (ephemeral port + temp DB + mock hub) — create thread, see SSE row appear.

**Phase 8e — Opt-in sandbox E2E (not default in CI)**
- [ ] `pnpm test:e2e:sandbox` — real worker + **`agents/stub`** in SmolVM; asserts event rows in temp DB.
- [ ] Never mount real vault keys; inject dummy `OPENAI_API_KEY=test-no-network` and assert stub agent ignores it.
- [ ] Document: safe for local dev; CI runs only when `SMOLVM_E2E=1` and KVM/Hypervisor available.
- [ ] Deprecate `DOCKER_E2E` / docker-e2e Vitest project after SmolVM path lands.

**Coverage targets (v1):**
- `packages/core`, `packages/db`, `apps/hub`, `apps/cli` (non-sandbox paths): **≥80%** lines on business logic.
- API route handlers: happy path + main error paths for each endpoint.
- UI: all primary routes render; modal + event terminal filters behave with fixtures.

---

## 13. Key Design Decisions (Final)

| Decision | Choice |
|----------|--------|
| Language | TypeScript everywhere (unified stack) |
| Package manager | pnpm workspaces |
| Sandbox | **SmolVM** micro-VMs (`.smolmachine` base); Docker path removed after Phase 6 |
| Server | Next.js + SQLite + Drizzle ORM |
| Worker | Node.js/TypeScript CLI (`smolvm` CLI, `ws`, `simple-git`) |
| TUI | Ink (React for terminals) |
| Agent system | Script-based, one folder per agent in `agents/` |
| Agent interface | Env vars in, JSON lines to stdout |
| Communication | Worker-initiated WebSocket to hub (`apps/hub`) |
| Client real-time | SSE for browsers and TUI |
| Git auth | HTTPS with PAT tokens (injected via `GIT_PAT`) |
| Worktree strategy | Bare mirror + per-thread worktree |
| Port allocation | Server-managed range per machine (**1 port: web**), atomic via SQLite transactions |
| Web preview | Guest :8080 → host `web_port` |
| Native / desktop deliverables | `artifact` event + worker copy-out; user runs binary locally |
| GUI preview (remote desktop) | **Dropped** (was RustDesk + Xvfb) |
| Real-time UI | SSE for browsers/TUI (server polls DB), WebSocket for workers |
| Hub auth | `HUB_CONTROL_TOKEN` env var + `X-Hub-Token` header |
| Approval flow | v1: autonomous (kill switch only) |
| ZED integration | v2 (TUI or ACP) |
| History storage | Append-only event stream in SQLite; closed threads also listed inline in dashboard thread rail (v2) |
| Web UI design | v2 HTML/CSS export → Next.js App Router; test-data fixtures for offline UI |
| Test runner | Vitest (unit + integration + UI); Playwright optional for full-browser smoke |
| Test isolation | `TASKYARD_DB_PATH` → temp/` :memory:` only; `agents/stub` for zero-token worker tests |
| Env var registry | `.env` file at repo root with commented placeholders for all variables |

> **Convention:** When adding a new environment variable anywhere in the codebase, always add a commented placeholder to the `.env` file at the repo root so the full configuration surface stays documented in one place.

---

## 14. Open Questions for Implementation

1. **Cursor SDK specifics:** Verified — `@cursor/sdk` npm package (TypeScript, public beta as of April 2026). Local mode with `Agent.create({ local: { cwd } })`. Authenticates via `CURSOR_API_KEY`.
2. **Kimi SDK:** Uses OpenAI-compatible Python client + Moonshot base URL (`https://api.moonshot.cn/v1`); no separate `kimi-sdk` package required.
3. **SmolVM CLI surface:** Pin version; document exact spawn/exec/port-forward/copy commands Taskyard depends on.
4. **Base `.smolmachine` size & rebuild:** Bake once per arch; agents stay mounted — avoid per-thread image rebuilds.
5. **Artifact download path:** Server proxy vs direct worker fetch for multi-machine UI users — decide in Phase 6c.
6. **Windows as worker host:** SmolVM targets Linux/macOS hypervisors; Windows dev machines use remote Linux workers or WSL2 worker (validate).
7. **Worker deployment:** For v1, workers are deployed via `git clone && pnpm install` + `smolvm` install script. Later, bundle `apps/cli` with `esbuild`.
8. **Auto-loading `.env`:** Implemented via `loadTaskyardEnv()` in server, hub, and CLI.
9. **Dashboard task rail + `/auto`:** Design includes task management and automation rules UI; persistence/API not defined for v1 — wire up, simplify nav, or defer.
10. **TUI vs web-first:** v2 web UI is the primary operator surface; Ink TUI remains Phase 5 unless deprioritized.

---

## 15. Automated testing architecture

Automated tests must be **safe by default**: no calls to OpenAI, Cursor, Moonshot, or other paid APIs; no reads/writes to `data/taskyard.db` or any path the developer uses for manual testing.

### 15.1 Safety rails

| Risk | Mitigation |
|------|------------|
| AI token spend | Never invoke `agents/codex`, `agents/cursor`, or `agents/kimi` in CI. Use **`agents/stub`** (deterministic stdout script). Unit-test real agents only for **missing-key** and **parse/emit** paths with network **mocked or blocked** (`nock`, `vi.stubGlobal('fetch', …)`). |
| Production / dev DB corruption | All tests set `process.env.TASKYARD_DB_PATH` to a **unique temp file** (deleted in `afterAll`) or SQLite **`:memory:`**. `packages/test-utils` exports `createTestDb()` that asserts the path is under `os.tmpdir()` or equals `:memory:`. Refactor `packages/core/src/db.ts` to accept an optional injected path so tests bypass the singleton cache. |
| Accidental vault use | Tests use dummy keys (`sk-test-…`). Vault round-trip tests store nonsense values only in the temp DB. |
| Hypervisor required in CI | Default CI job: **no SmolVM**. Sandbox E2E gated by `SMOLVM_E2E=1`. |
| Git / network in worker tests | Mock `simple-git` and sandbox CLI in unit tests; integration tests use temp directories and fake remote URLs only where clone is not exercised. |

**Hard guard (implement in `packages/test-utils/env-guard.ts`):**

```ts
export function assertSafeTestEnv() {
  if (process.env.NODE_ENV !== 'test') throw new Error('tests must set NODE_ENV=test');
  const db = process.env.TASKYARD_DB_PATH;
  if (!db) throw new Error('TASKYARD_DB_PATH must be set for tests');
  if (db.endsWith('data/taskyard.db')) throw new Error('refusing to run tests against dev DB');
}
```

Call `assertSafeTestEnv()` from a Vitest `setupFiles` entry loaded by every project.

### 15.2 Test pyramid

```
                    ┌─────────────────────┐
                    │  Sandbox E2E (opt-in) │  stub agent, real SmolVM
                    └──────────┬──────────┘
               ┌───────────────┴───────────────┐
               │  Integration (Vitest)          │  temp DB, mock hub, WS harness
               └───────────────┬───────────────┘
     ┌─────────────────────────┴─────────────────────────┐
     │  Unit (Vitest)                                     │  pure logic, mocked I/O
     └─────────────────────────┬─────────────────────────┘
     ┌─────────────────────────┴─────────────────────────┐
     │  UI (RTL + fixtures / Playwright smoke)            │  test-data mode or test-server
     └───────────────────────────────────────────────────┘
```

### 15.3 `agents/stub` (zero-token worker fixture)

Add under `agents/stub/`:

- `manifest.json` — `language: "typescript"`, entrypoint `run.ts`
- `run.ts` — reads `TASKYARD_PROMPT`, emits a fixed sequence (`system/start`, `thought`, optional `file_write` to a temp file under workspace, `system/complete`), **never calls fetch**

Worker integration tests set `agent_type: "stub"` and assert events land in the temp DB. This validates sandbox mounts, log parsing, and state transitions without AI.

### 15.4 Mock hub worker

`packages/test-utils/mock-worker.ts` — in-process WebSocket client that:

1. Connects to a test hub instance (ephemeral port).
2. Sends `register` + periodic `heartbeat`.
3. On `spawn_thread`, writes a fake container id, emits scripted `event` messages, sends `state_change: running` → `completed`.
4. On `kill_thread` / `close_thread`, acks and cleans up.

Allows full server + hub + core path tests without SmolVM.

### 15.5 Refactors to enable testing (small, targeted)

- **`getDb()` injection** — `createAppDb(path?: string)` for tests; keep singleton for production.
- **`hub-client` seam** — already imported by `threads.ts`; export `setHubClientForTests(mock)` or pass optional client into `createThread` / `killThread`.
- **Pure SSE parser** — extract message handling from `useEventStream` into `lib/sse-client.ts` for unit tests without JSDOM EventSource.
- **Route handler factories** — thin wrappers that accept `db` from `@taskyard/core` for supertest-style calls.

### 15.6 Scripts

Root `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:unit": "vitest run packages/**/*.unit.test.ts apps/**/*.unit.test.ts",
    "test:integration": "vitest run packages/**/*.integration.test.ts apps/**/*.integration.test.ts",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e:sandbox": "cross-env SMOLVM_E2E=1 vitest run --project sandbox-e2e"
  }
}
```

Run locally before merging: `pnpm install` → `pnpm test` → `pnpm build`. No secrets, no hypervisor in the default test run.

### 15.7 What stays manual (v1)

- Visual parity vs `design/v2` screenshots across all breakpoints (can add Playwright screenshot diff later).
- Real codex/cursor/kimi runs against live APIs (developer smoke only, never CI).
- Multi-machine LAN deployment soak tests.

### 15.8 Current testing status

- [x] Vitest at repo root (`vitest.config.ts`, `vitest.setup.ts`, `pnpm test`).
- [x] `@taskyard/test-utils` — temp DB factory, env guards, `seedOnlineMachine` / `seedThread`.
- [x] Safety rail: `assertSafeTestEnv()` in global setup; refuses `data/taskyard.db`.
- [x] Starter tests: env-guard (3), CLI log parser (4), port registry integration (3).
- [x] `agents/stub` for zero-token worker tests.
- [ ] Hub mock worker, API route tests, UI tests (RTL).
