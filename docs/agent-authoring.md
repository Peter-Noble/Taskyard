# Agent authoring

Taskyard runs agents as scripts inside [zerobox](https://github.com/afshinm/zerobox) sandboxes. Each agent lives in `agents/<id>/` with a `manifest.json` and an entrypoint script.

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

- **language**: `python`, `typescript`, or `javascript` — the worker builds the sandbox command from this.
- **env_vars**: keys the server must inject from the vault when spawning a thread.

## Environment inside the sandbox

| Variable | Description |
|----------|-------------|
| `TASKYARD_THREAD_ID` | Thread UUID |
| `TASKYARD_PROJECT` | Project name |
| `TASKYARD_PROMPT` | User prompt |
| `TASKYARD_WORKSPACE` | Absolute path to the git worktree |
| `TASKYARD_WEB_PORT` | Host port allocated for dev-server preview |
| `TASKYARD_GIT_PAT` | HTTPS PAT for git push (from vault `_global`) |
| Agent keys | e.g. `OPENAI_API_KEY`, injected via zerobox secrets per `env_vars` |

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

Use **`agents/stub`**: deterministic JSON lines, no network, no API keys. Set `agent_type: "stub"` in integration tests.

## Dev server port

Web apps should listen on **`TASKYARD_WEB_PORT`** (or `8080` as a fallback) so the worker's allocated `web` host port is reachable.
