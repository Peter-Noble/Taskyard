#!/usr/bin/env python3
"""Kimi agent — uses Moonshot AI API with tool calling to autonomously edit code.

Moonshot's API is OpenAI-compatible, so we use the openai Python client with a
custom base_url.
"""

import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

try:
    from openai import OpenAI
except ImportError as e:
    print(json.dumps({"type": "error", "message": f"openai package not installed: {e}"}))
    raise SystemExit(1)


def emit(event: dict) -> None:
    event.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
    print(json.dumps(event), flush=True)


WORKSPACE = os.environ.get("TASKYARD_WORKSPACE", "/workspace")
PROMPT = os.environ.get("TASKYARD_PROMPT", "")
API_KEY = os.environ.get("KIMI_API_KEY")
MODEL = os.environ.get("KIMI_MODEL", "kimi-latest")
BASE_URL = os.environ.get("KIMI_BASE_URL", "https://api.moonshot.cn/v1")
MAX_ITERATIONS = int(os.environ.get("KIMI_MAX_ITERATIONS", "50"))

if not API_KEY:
    emit({"type": "error", "message": "Missing KIMI_API_KEY"})
    emit({"type": "system", "event": "complete", "status": "error"})
    raise SystemExit(1)

client = OpenAI(api_key=API_KEY, base_url=BASE_URL)


def resolve_path(p: str) -> Path:
    if Path(p).is_absolute():
        return Path(p)
    return Path(WORKSPACE) / p


def read_file(file_path: str) -> str:
    full = resolve_path(file_path)
    try:
        content = full.read_text(encoding="utf-8")
        emit({"type": "file_read", "path": str(full)})
        return content
    except Exception as e:
        emit({"type": "file_read", "path": str(full)})
        return f"Error reading file: {e}"


def write_file(file_path: str, content: str) -> str:
    full = resolve_path(file_path)
    full.parent.mkdir(parents=True, exist_ok=True)
    full.write_text(content, encoding="utf-8")
    emit({"type": "file_write", "path": str(full), "size_bytes": len(content.encode("utf-8"))})
    return f"Wrote {len(content)} characters to {file_path}"


def run_command(command: str) -> str:
    result = subprocess.run(
        command,
        shell=True,
        capture_output=True,
        text=True,
        cwd=WORKSPACE,
    )
    output = (result.stdout or "") + (result.stderr or "")
    emit({
        "type": "command_run",
        "command": command,
        "exit_code": result.returncode,
        "output": output[:2000],
    })
    return f"Exit code: {result.returncode}\n{output[:2000]}"


TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read the contents of a file in the workspace",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Relative or absolute file path"},
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Write content to a file in the workspace",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Relative or absolute file path"},
                    "content": {"type": "string", "description": "Full file content to write"},
                },
                "required": ["path", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_command",
            "description": "Run a shell command in the workspace",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "Shell command to execute"},
                },
                "required": ["command"],
            },
        },
    },
]


def main() -> None:
    emit({"type": "system", "event": "start"})

    messages = [
        {
            "role": "system",
            "content": (
                "You are a Kimi coding agent running in an isolated environment. "
                "You have access to tools to read files, write files, and run shell commands. "
                "Use these tools to complete the user's task. Think step by step. "
                "When you are done, do not call any more tools."
            ),
        },
        {"role": "user", "content": PROMPT},
    ]

    for _ in range(MAX_ITERATIONS):
        response = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            tools=TOOLS,
        )

        msg = response.choices[0].message

        if msg.content:
            emit({"type": "thought", "content": msg.content})

        if not msg.tool_calls:
            break

        messages.append(msg.model_dump())

        for tc in msg.tool_calls:
            name = tc.function.name
            args = json.loads(tc.function.arguments)
            result = ""

            if name == "read_file":
                result = read_file(args["path"])
            elif name == "write_file":
                result = write_file(args["path"], args["content"])
            elif name == "run_command":
                result = run_command(args["command"])
            else:
                result = f"Unknown tool: {name}"

            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": result,
            })

    emit({"type": "system", "event": "complete", "status": "success"})


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        emit({"type": "error", "message": str(e)})
        emit({"type": "system", "event": "complete", "status": "error"})
        raise SystemExit(1)
