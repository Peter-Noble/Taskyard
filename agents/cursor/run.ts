/** Cursor agent — uses the official @cursor/sdk TypeScript SDK. */

import { Agent } from "@cursor/sdk";
import * as path from "path";

interface Event {
  type: string;
  [key: string]: unknown;
}

function emit(event: Event): void {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    ...event,
  });
  console.log(line);
}

const API_KEY = process.env.CURSOR_API_KEY;
const WORKSPACE = process.env.TASKYARD_WORKSPACE || "/workspace";
const PROMPT = process.env.TASKYARD_PROMPT || "";
const MODEL = process.env.CURSOR_MODEL || "auto";

if (!API_KEY) {
  emit({ type: "error", message: "Missing CURSOR_API_KEY" });
  emit({ type: "system", event: "complete", status: "error" });
  process.exit(1);
}

function resolvePath(p: string): string {
  if (path.isAbsolute(p)) return p;
  return path.join(WORKSPACE, p);
}

function extractPath(args: unknown): string | undefined {
  if (args && typeof args === "object") {
    const a = args as Record<string, unknown>;
    if (typeof a.path === "string") return a.path;
    if (typeof a.file === "string") return a.file;
    if (typeof a.filePath === "string") return a.filePath;
  }
  return undefined;
}

function extractContent(args: unknown): string | undefined {
  if (args && typeof args === "object") {
    const a = args as Record<string, unknown>;
    if (typeof a.content === "string") return a.content;
    if (typeof a.code === "string") return a.code;
  }
  return undefined;
}

function extractCommand(args: unknown): string | undefined {
  if (args && typeof args === "object") {
    const a = args as Record<string, unknown>;
    if (typeof a.command === "string") return a.command;
    if (typeof a.cmd === "string") return a.cmd;
  }
  return undefined;
}

function extractExitCode(result: unknown): number {
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (typeof r.exitCode === "number") return r.exitCode;
    if (typeof r.exit_code === "number") return r.exit_code;
  }
  return 0;
}

function extractOutput(result: unknown): string {
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    let out = "";
    if (typeof r.stdout === "string") out += r.stdout;
    if (typeof r.stderr === "string") out += r.stderr;
    if (typeof r.output === "string") out += r.output;
    return out;
  }
  if (typeof result === "string") return result;
  return "";
}

async function main(): Promise<void> {
  emit({ type: "system", event: "start" });

  const agent = await Agent.create({
    apiKey: API_KEY,
    model: { id: MODEL },
    local: { cwd: WORKSPACE },
  });

  try {
    const run = await agent.send(PROMPT);
    const pendingCalls = new Map<string, { name: string; args: unknown }>();

    for await (const event of run.stream()) {
      switch (event.type) {
        case "assistant": {
          for (const block of event.message.content) {
            if (block.type === "text") {
              emit({ type: "thought", content: block.text });
            }
          }
          break;
        }
        case "thinking": {
          emit({ type: "thought", content: event.text });
          break;
        }
        case "tool_call": {
          const tc = event as any;
          if (tc.status === "running") {
            pendingCalls.set(tc.call_id, { name: tc.name, args: tc.args });
          } else if (tc.status === "completed" || tc.status === "error") {
            const pending = pendingCalls.get(tc.call_id);
            pendingCalls.delete(tc.call_id);
            const name = tc.name || pending?.name || "unknown";
            const args = pending?.args ?? tc.args;

            if (
              name === "read" ||
              name === "glob" ||
              name === "grep" ||
              name === "ls" ||
              name === "semSearch"
            ) {
              const p = extractPath(args);
              if (p) emit({ type: "file_read", path: resolvePath(p) });
            } else if (name === "write" || name === "edit") {
              const p = extractPath(args);
              if (p) {
                const content = extractContent(args) || "";
                emit({
                  type: "file_write",
                  path: resolvePath(p),
                  size_bytes: Buffer.byteLength(content, "utf-8"),
                });
              }
            } else if (name === "shell") {
              const command = extractCommand(args) || name;
              const exitCode =
                tc.status === "error" ? 1 : extractExitCode(tc.result);
              const output = extractOutput(tc.result).slice(0, 2000);
              emit({
                type: "command_run",
                command,
                exit_code: exitCode,
                output,
              });
            }
          }
          break;
        }
        case "status": {
          if (event.status === "ERROR") {
            emit({
              type: "error",
              message: event.message || "Agent run error",
            });
          }
          break;
        }
        case "request": {
          emit({
            type: "error",
            message:
              "Agent requested user input, but autonomous mode does not support interaction",
          });
          break;
        }
      }
    }

    const result = await run.wait();
    if (result.status === "error") {
      emit({ type: "error", message: result.result || "Agent run failed" });
      emit({ type: "system", event: "complete", status: "error" });
    } else {
      emit({ type: "system", event: "complete", status: "success" });
    }
  } catch (e: any) {
    emit({ type: "error", message: e?.message || String(e) });
    emit({ type: "system", event: "complete", status: "error" });
  } finally {
    const asyncDispose = (Symbol as any).asyncDispose;
    if (asyncDispose && typeof (agent as any)[asyncDispose] === "function") {
      await (agent as any)[asyncDispose]();
    } else {
      agent.close();
    }
  }
}

main().catch((e) => {
  emit({ type: "error", message: String(e) });
  emit({ type: "system", event: "complete", status: "error" });
  process.exit(1);
});
