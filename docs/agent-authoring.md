# Agent authoring

Taskyard runs agents as scripts inside Docker containers. Each agent lives in `agents/<id>/` with a `manifest.json` and an entrypoint script.

## Manifest (`manifest.json`)

```json
{
  "name": "My Agent",
  "description": "Short description",
  "version": "1.0.0",
  "entrypoint": "run.ts",
  "language": "typescript",
  "env_vars": ["OPENAI_API_KEY"]
}
```

- **language**: `python`, `typescript`, or `javascript` — the worker builds the container command from this.
- **env_vars**: keys the server must inject from the vault when spawning a thread.

## Environment inside the container

| Variable | Description |
|----------|-------------|
| `TASKYARD_THREAD_ID` | Thread UUID |
| `TASKYARD_PROJECT` | Project name |
| `TASKYARD_PROMPT` | User prompt |
| `TASKYARD_WORKSPACE` | Git worktree mount (usually `/workspace`) |
| `TASKYARD_GIT_PAT` | HTTPS PAT for git push (from vault `_global`) |
| Agent keys | e.g. `OPENAI_API_KEY`, from vault per `env_vars` |

## Output protocol

Emit **one JSON object per line** on stdout. Include ISO 8601 `timestamp` on each line.

```json
{"type":"system","event":"start","timestamp":"2026-05-30T12:00:00.000Z"}
{"type":"thought","content":"Planning next step.","timestamp":"..."}
{"type":"file_read","path":"/workspace/src/foo.ts","timestamp":"..."}
{"type":"file_write","path":"/workspace/src/foo.ts","size_bytes":120,"timestamp":"..."}
{"type":"command_run","command":"pnpm test","exit_code":0,"output":"...","timestamp":"..."}
{"type":"system","event":"complete","status":"success","timestamp":"..."}
{"type":"error","message":"Something failed","timestamp":"..."}
```

Invalid lines are stored as raw stdout events.

## Requirements

- Write files only under `TASKYARD_WORKSPACE`.
- Emit `file_write` after a successful write; emit `command_run` after the command finishes.
- On failure, emit `error` then exit with a non-zero code.
- Run autonomously in v1 (no stdin protocol).

## Testing without AI

Use **`agents/stub`**: deterministic JSON lines, no network, no API keys. Set `agent_type: "stub"` in integration or Docker E2E tests.

## Remote desktop (RustDesk)

The base image includes RustDesk for GUI preview. Agents that launch GUI apps should use `DISPLAY=:99` (Xvfb). Users connect with the RustDesk client to the host-mapped `rustdesk_port` (container port `21116`). Configure your self-hosted `hbbs` / `hbbr` servers via container env when you enable Phase 6 runtime startup.

## Dev server port

Web apps should listen on **8080** inside the container so the worker can map the allocated `web` host port.
