# Taskyard MVP Design

Status: agreed (grilling session, 2026-07-30). Supersedes conflicting parts of `PLAN.md` for the near-term finish line (sandbox/SmolVM/zerobox/RustDesk/TUI phases).

## 1. Goal

A **single-machine** Taskyard you can dogfood on **Windows**: create a thread tied to real work, run **Cursor or Kimi via ACP**, chat multi-turn in the web UI, let the agent read/update **tasks** via a small CLI, push with host git credentials, kill/close cleanly.

## 2. Locked decisions

| Topic | Choice |
|--------|--------|
| Host | Single machine (this Windows box for first dogfood) |
| Agent runtime | **ACP** — Cursor (`agent acp`) and Kimi (`kimi acp`) behind one client abstraction |
| Custom agents | Keep **`agents/stub`** only for free tests; retire Codex / Cursor SDK / Kimi script runners from MVP path |
| Permissions | Auto-allow normal tool `request_permission`; **route question-like permissions + Cursor `ask_question` / `create_plan` to the UI** |
| Auth | Machine **CLI login** only (`agent login` / `kimi login`); no vault-backed ACP auth for MVP |
| Sandboxing | **Out of MVP and shelved** (no zerobox / SmolVM / Docker). Revisit only if dogfooding demands it |
| RustDesk / remote desktop | **Stripped** |
| Web preview / ports / artifacts | **Out of MVP** |
| Thread model | **Multi-turn** chat; ACP process + session **stay alive** while thread is open |
| Concurrency | Soft cap **2** concurrent ACP threads |
| Workspaces | Keep **bare mirror + per-thread git worktree**; ACP `cwd` = worktree |
| Git remotes | Agent may **push** using host credentials; **no PR UI** |
| UI shell | Keep **v2 chrome**; wire threads/chat/machines; leave `/auto` + mock task-rail **inert** until replaced by real tasks |
| TUI | Out |
| Multi-machine fleet | Out |
| Web UI auth | Out |
| Vault for ACP | Out (vault may remain for unrelated future use / `GIT_PAT` optional later) |

## 3. Product shape

```
┌─────────────┐     REST/SSE      ┌──────────────┐
│  Web UI     │◄─────────────────►│ Next.js API  │
│  (v2 shell) │                   │  + SQLite    │
└─────────────┘                   └──────┬───────┘
                                         │ hub control HTTP
                                         ▼
                                  ┌──────────────┐
                                  │  Hub (WS)    │
                                  └──────┬───────┘
                                         │ spawn / kill / close / follow_up*
                                         ▼
                                  ┌──────────────┐
                                  │ Worker       │
                                  │  ACP client  │──► agent acp | kimi acp
                                  │  git worktree│
                                  └──────────────┘
                                         │
                         PATH: taskyard task … ──► REST /api/tasks
```

\*Follow-up prompts and ask/plan answers are new control messages (or HTTP→hub→worker); see §6.

## 4. Task model + agent CLI (MVP addition)

Agents need structured work, not only a free-text prompt. MVP includes a **persisted task graph** and a **`taskyard task` CLI** the ACP agent can invoke inside the worktree (host PATH / same install as the worker).

### 4.1 Data model

Tasks belong to a **project**. A **thread** may reference an optional `task_id` (primary task being worked). Subtasks are tasks with `parent_id`.

```
projects 1──* tasks 1──* tasks (parent_id)
threads.task_id → tasks.id (nullable)
```

Fields (v1):

| Field | Notes |
|--------|--------|
| `id` | Stable string id (e.g. `ty-12` or uuid) |
| `project_id` | FK |
| `parent_id` | Nullable FK for subtasks |
| `title`, `description` | Markdown-friendly text |
| `status` | `backlog` \| `ready` \| `in_progress` \| `waiting` \| `completed` \| `cancelled` |
| `assignee` | Optional string |
| `created_at`, `updated_at` | Timestamps |

Activity log (append-only): status changes, comments (actor = `user` \| `agent` \| name).

### 4.2 REST API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/tasks?project_id=&status=&parent_id=` | List |
| GET | `/api/tasks/:id` | Get task + recent activity + children summary |
| POST | `/api/tasks` | Create (`title`, `project_id`, optional `parent_id`, `description`) |
| PATCH | `/api/tasks/:id` | Update title/description/status/assignee |
| POST | `/api/tasks/:id/comments` | Add comment |
| POST | `/api/threads` | Accept optional `task_id`; seed prompt from task if prompt omitted |

Replace dashboard fixture reads with these APIs when `useTestData` is off. With test-data on, fixtures may remain.

### 4.3 CLI (`taskyard task`)

Talks to `TASKYARD_SERVER_URL` (default `http://127.0.0.1:3000`). Uses `TASKYARD_THREAD_ID` / `TASKYARD_TASK_ID` from the environment when the worker spawns ACP.

```bash
taskyard task get [id]              # default: $TASKYARD_TASK_ID
taskyard task list [--project id] [--status s] [--parent id]
taskyard task create --title "..." [--parent id] [--project id] [--description "..."]
taskyard task status <id> <status>
taskyard task comment <id> "..."
taskyard task show-thread           # thread id, project, primary task (for agent orientation)
```

Output: **JSON on stdout** (stable for agents); human text only with `--pretty`.

Worker ensures the `taskyard` binary (or `pnpm exec taskyard`) is on `PATH` for the ACP child, and sets:

- `TASKYARD_SERVER_URL`
- `TASKYARD_THREAD_ID`
- `TASKYARD_TASK_ID` (if linked)
- `TASKYARD_PROJECT_ID`
- `TASKYARD_WORKSPACE` (worktree path)

### 4.4 Why this is in MVP

Without get/status/subtask/comment, the agent only has the initial prompt and cannot coordinate real multi-step work against Taskyard’s own board. The CLI is the agent-facing API; the web task rail can gradually bind to the same store (shell stays; data becomes real).

## 5. ACP integration

### 5.1 Shared client

One module (e.g. `apps/cli/src/acp/client.ts`):

1. Spawn `agent acp` or `kimi acp` with `cwd` = worktree  
2. `initialize` → `authenticate` (Cursor: `cursor_login` after host `agent login`)  
3. `session/new` with `cwd`  
4. `session/prompt` with initial prompt (include task brief if `task_id` set)  
5. Stream `session/update` → Taskyard `AgentEvent`s → hub  
6. Auto-allow tool permissions; detect question-shaped permissions → UI  
7. Handle `cursor/ask_question` / `cursor/create_plan` → persist pending UI payloads; reply when user answers  
8. Follow-ups: another `session/prompt` on the same session  
9. Kill: `session/cancel` + process SIGTERM  

### 5.2 Event mapping ( pragmatic MVP )

| ACP | Taskyard event |
|-----|----------------|
| `agent_message_chunk` | `thought` (or `stdout` aggregate) |
| tool call start/result | `command_run` / `file_*` when paths known; else `thought` |
| errors | `error` |
| pending ask/plan | new event types or `system` payloads the UI already can render |

Exact fidelity can improve later; streaming text + tool visibility is enough to dogfood.

### 5.3 Protocol additions

Worker ← Hub:

- Existing: `spawn_thread`, `kill_thread`, `close_thread`  
- New: `follow_up` `{ thread_id, prompt }`  
- New: `permission_response` / `cursor_extension_response` for ask/plan answers  

`spawn_thread.ports`: drop `rustdesk`; **omit port allocation for MVP** (or allocate unused — prefer **stop allocating ports** and drop RustDesk columns from API responses).

Strip RustDesk from UI and fixtures.

### 5.4 Agent types

`/api/agents` returns ACP manifests, e.g.:

```json
{ "id": "cursor", "name": "Cursor ACP", "command": ["agent", "acp"], ... }
{ "id": "kimi", "name": "Kimi ACP", "command": ["kimi", "acp"], ... }
{ "id": "stub", "name": "Stub", ... }
```

Discovery: check PATH for binaries; always list `stub`.

## 6. Thread lifecycle (MVP)

1. User creates task (UI or CLI) → status `ready`  
2. User opens New Thread, picks project + agent + optional task → prompt auto-filled from task  
3. Server picks local worker (cap 2), creates worktree setup via worker, status `spawning` → `running`  
4. ACP streams; UI shows chat; user may send follow-ups  
5. Agent uses `taskyard task …` to update board  
6. Ask/plan widgets when needed  
7. Kill → cancel ACP + mark `error`; Close → teardown process + remove worktree → `closed`  

## 7. UI scope

**Wire:** New Thread, thread list/history rail, center chat stream, follow-up compose, ask/plan/question widgets, machines page (online worker), kill/close, projects as today.

**Inert / hide empty:** `/auto` rules engine; design-only task fixtures when live — prefer binding task rail to `/api/tasks` once APIs exist (same visual components, real data).

**Remove:** RustDesk chips/buttons; dead web-port emphasis if nothing listens.

## 8. Explicitly out of MVP

- TUI product surface (CLI `task` subcommands are not the Ink TUI)  
- Multi-machine scheduling soak  
- Web preview, artifacts, RustDesk  
- OS/VM sandboxing  
- Web auth  
- Vault-injected ACP keys  
- Full Codex ACP (optional later via same client)  
- Broad Phase 8 coverage as a release gate (keep stub + a few unit tests)

## 9. Implementation plan

Ordered for a working dogfood loop:

1. **Design doc** (this file) + note in README pointer  
2. **Protocol / DB:** tasks tables; thread `task_id`; drop rustdesk from types/API; follow-up + permission response messages; default `max_concurrent_threads` = 2  
3. **Core + API:** task CRUD/comments; thread create with `task_id`; follow-up endpoint  
4. **ACP worker path:** replace sandbox spawn with ACP client; env + PATH for `taskyard task`; abandon zerobox WIP on critical path  
5. **`taskyard task` CLI** in `apps/cli`  
6. **UI:** strip RustDesk; multi-turn compose; ask/plan; wire tasks API into rail when feasible  
7. **Docs:** README dogfood steps (login CLIs, hub/server/worker, create task, create thread)  
8. **Smoke:** stub or Cursor one-turn + `taskyard task get` from agent instruction  

**Existing DBs:** `pnpm db:push` may fail on SQLite alter quirks — use `pnpm db:migrate-mvp` to add `tasks` / `task_activity` / `threads.task_id` / `projects.archived*` columns.
## 10. Acceptance criteria

MVP is done when, on one Windows machine:

1. Hub + server + worker run locally  
2. `agent login` (and optionally `kimi login`) done once  
3. Create a task via API/CLI/UI; create a Cursor (or Kimi) thread linked to it  
4. See streaming output in the web UI  
5. Send a follow-up message and get a continued reply  
6. Agent (or human) can `taskyard task get/status/create/comment` against the server  
7. Answer an ask/plan (or question-permission) in the UI at least once in a manual test  
8. Kill/close cleans up ACP process and worktree  
9. No RustDesk UI; no sandbox dependency  

## 11. Relation to `PLAN.md`

`PLAN.md` remains historical architecture notes. Where it conflicts (SmolVM Phase 6, Docker, RustDesk, ZED ACP as v2-only, one-shot threads), **this document wins for MVP**. Update `PLAN.md` status tables in a follow-up commit if desired.
