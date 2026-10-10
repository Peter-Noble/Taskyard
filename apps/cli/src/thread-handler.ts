import chalk from 'chalk';
import { isOfferedAgent } from '@taskyard/core';
import type { AgentEvent, ServerMessage, ThreadState, WorkerMessage } from '@taskyard/protocol';
import { ensureMirror, createWorktree, removeWorktree } from './git.js';
import { readAgentManifest } from './manifest.js';
import { mirrorPath } from './config.js';
import { AcpClient, acpCommandAvailable } from './acp/index.js';
import { buildThreadAgentEnv } from './agent-env.js';
import { spawnStub, stopStub } from './stub-runner.js';

type SendFn = (msg: WorkerMessage) => void;

type ThreadMeta = {
  projectId: string;
  mirror: string;
  worktreePath: string;
  agentType: string;
  runtime: 'acp' | 'process';
};

type RunningAcp = {
  client: AcpClient;
};

const threadMeta = new Map<string, ThreadMeta>();
const acpThreads = new Map<string, RunningAcp>();

const DEFAULT_MAX_CONCURRENT = 2;

export type ThreadHandlerContext = {
  send: SendFn;
  agentsDir?: string;
  maxConcurrentThreads?: number;
};

function maxConcurrent(ctx: ThreadHandlerContext): number {
  if (ctx.maxConcurrentThreads != null) return ctx.maxConcurrentThreads;
  const fromEnv = process.env.TASKYARD_MAX_CONCURRENT_THREADS;
  if (fromEnv) {
    const n = Number(fromEnv);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return DEFAULT_MAX_CONCURRENT;
}

export function runningThreadCount(): number {
  return threadMeta.size;
}

function activeThreadCount(): number {
  return threadMeta.size;
}

function sendState(send: SendFn, threadId: string, state: ThreadState) {
  send({ type: 'state_change', thread_id: threadId, state });
}

function sendEvent(send: SendFn, threadId: string, payload: AgentEvent) {
  send({ type: 'event', thread_id: threadId, payload });
}

function isAcpAgent(agentType: string, manifest: ReturnType<typeof readAgentManifest>): boolean {
  if (manifest.runtime === 'acp') return true;
  return agentType === 'cursor' || agentType === 'kimi';
}

function acpConfig(agentType: string, manifest: ReturnType<typeof readAgentManifest>) {
  if (manifest.command?.length) {
    return {
      command: manifest.command,
      authMethod: manifest.auth_method ?? `${agentType}_login`,
    };
  }
  if (agentType === 'cursor') {
    return { command: ['agent', 'acp'], authMethod: 'cursor_login' };
  }
  if (agentType === 'kimi') {
    return { command: ['kimi', 'acp'], authMethod: 'kimi_login' };
  }
  throw new Error(`No ACP command configured for agent: ${agentType}`);
}

export async function handleSpawn(
  ctx: ThreadHandlerContext,
  message: Extract<ServerMessage, { type: 'spawn_thread' }>,
): Promise<void> {
  const { send } = ctx;
  const threadId = message.thread_id;

  if (activeThreadCount() >= maxConcurrent(ctx)) {
    throw new Error(
      `Worker at thread capacity (${maxConcurrent(ctx)}). Wait for a thread to finish or increase TASKYARD_MAX_CONCURRENT_THREADS.`,
    );
  }

  sendState(send, threadId, 'spawning');
  console.log(chalk.cyan(`Spawning thread ${threadId} (${message.agent_type})`));

  try {
    const mirror = await ensureMirror(message.project_id, message.repo_url);
    const wtPath = await createWorktree(mirror, threadId, message.branch);
    const manifest = readAgentManifest(message.agent_type, ctx.agentsDir);
    if (!isOfferedAgent(message.agent_type, manifest)) {
      throw new Error(`Unknown agent type: ${message.agent_type}`);
    }
    const useAcp = isAcpAgent(message.agent_type, manifest);

    if (useAcp) {
      const { command, authMethod } = acpConfig(message.agent_type, manifest);
      if (!acpCommandAvailable(command)) {
        throw new Error(
          `ACP binary not found: ${command.join(' ')}. Install the CLI and ensure it is on PATH (e.g. agent login for Cursor).`,
        );
      }

      const env = buildThreadAgentEnv(message, wtPath);
      const client = new AcpClient({
        command,
        cwd: wtPath,
        env,
        authMethod,
        onEvent: (payload) => sendEvent(send, threadId, payload),
        onPending: () => {
          // Events emitted from client via onEvent with acp_pending.
        },
        onExit: (code) => {
          acpThreads.delete(threadId);
          if (code === 0) {
            console.log(chalk.gray(`Thread ${threadId} ACP exited cleanly`));
            sendState(send, threadId, 'completed');
          } else {
            console.log(chalk.gray(`Thread ${threadId} ACP exited (${code}) → error`));
            sendState(send, threadId, 'error');
          }
        },
      });

      threadMeta.set(threadId, {
        projectId: message.project_id,
        mirror,
        worktreePath: wtPath,
        agentType: message.agent_type,
        runtime: 'acp',
      });
      acpThreads.set(threadId, { client });

      await client.start(message.prompt);
      sendState(send, threadId, 'running');
      console.log(chalk.green(`Thread ${threadId} running (ACP)`));
      return;
    }

    // Stub / process agents — simple JSON-line runner, no sandbox.
    threadMeta.set(threadId, {
      projectId: message.project_id,
      mirror,
      worktreePath: wtPath,
      agentType: message.agent_type,
      runtime: 'process',
    });

    await spawnStub({
      message,
      worktreePath: wtPath,
      manifest,
      agentsDir: ctx.agentsDir,
      onEvent: (payload) => sendEvent(send, threadId, payload),
      onExit: (code) => {
        const state = code === 0 ? 'completed' : 'error';
        console.log(chalk.gray(`Thread ${threadId} exited (${code}) → ${state}`));
        sendState(send, threadId, state);
      },
    });

    sendState(send, threadId, 'running');
    console.log(chalk.green(`Thread ${threadId} running`));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`Spawn failed: ${msg}`));
    sendEvent(send, threadId, { type: 'error', message: msg });
    sendState(send, threadId, 'error');
    await cleanupThread(threadId, true, message.project_id).catch(() => {});
  }
}

export async function handleFollowUp(
  ctx: ThreadHandlerContext,
  message: Extract<ServerMessage, { type: 'follow_up' }>,
): Promise<void> {
  const entry = acpThreads.get(message.thread_id);
  if (!entry) {
    throw new Error(`No active ACP session for thread ${message.thread_id}`);
  }
  console.log(chalk.cyan(`Follow-up on thread ${message.thread_id}`));
  await entry.client.followUp(message.prompt);
}

export async function handleResolvePrompt(
  ctx: ThreadHandlerContext,
  message: Extract<ServerMessage, { type: 'resolve_prompt' }>,
): Promise<void> {
  const entry = acpThreads.get(message.thread_id);
  if (!entry) {
    throw new Error(`No active ACP session for thread ${message.thread_id}`);
  }
  const ok = entry.client.resolvePending(message.request_id, message.result);
  if (!ok) {
    throw new Error(`Unknown pending request: ${message.request_id}`);
  }
  console.log(chalk.cyan(`Resolved ${message.request_id} on thread ${message.thread_id}`));
}

export async function handleKill(
  ctx: ThreadHandlerContext,
  message: Extract<ServerMessage, { type: 'kill_thread' }>,
): Promise<void> {
  console.log(chalk.yellow(`Killing thread ${message.thread_id}`));
  const acp = acpThreads.get(message.thread_id);
  if (acp) {
    await acp.client.kill();
    acpThreads.delete(message.thread_id);
  } else {
    await stopStub(message.thread_id);
  }
  await cleanupThread(message.thread_id, true);
  ctx.send({ type: 'state_change', thread_id: message.thread_id, state: 'error' });
}

export async function handleClose(
  ctx: ThreadHandlerContext,
  message: Extract<ServerMessage, { type: 'close_thread' }>,
): Promise<void> {
  console.log(chalk.yellow(`Closing thread ${message.thread_id}`));
  const acp = acpThreads.get(message.thread_id);
  if (acp) {
    await acp.client.kill();
    acpThreads.delete(message.thread_id);
  } else {
    await stopStub(message.thread_id);
  }
  await cleanupThread(message.thread_id, true);
  ctx.send({ type: 'state_change', thread_id: message.thread_id, state: 'closed' });
}

async function cleanupThread(
  threadId: string,
  force: boolean,
  projectId?: string,
): Promise<void> {
  const acp = acpThreads.get(threadId);
  if (acp) {
    await acp.client.kill().catch(() => {});
    acpThreads.delete(threadId);
  }
  await stopStub(threadId).catch(() => {});
  const entry = threadMeta.get(threadId);
  const mirror = entry?.mirror ?? (projectId ? mirrorPath(projectId) : null);
  if (mirror) await removeWorktree(mirror, threadId, force);
  threadMeta.delete(threadId);
}
