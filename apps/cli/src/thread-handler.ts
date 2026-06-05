import chalk from 'chalk';
import type { ServerMessage, ThreadState, WorkerMessage } from '@taskyard/protocol';
import type { WebSocket } from 'ws';
import { ensureMirror, createWorktree, removeWorktree } from './git.js';
import { readAgentManifest } from './manifest.js';
import { imageExists, removeContainer, spawnContainer, stopContainer } from './docker.js';
import { mirrorPath } from './config.js';

type SendFn = (msg: WorkerMessage) => void;

type ThreadMeta = {
  projectId: string;
  mirror: string;
  worktreePath: string;
};

/** Tracks threads until close/kill cleans up worktrees. */
const threadMeta = new Map<string, ThreadMeta>();

export type ThreadHandlerContext = {
  send: SendFn;
  agentsDir?: string;
};

function sendState(send: SendFn, threadId: string, state: ThreadState) {
  send({ type: 'state_change', thread_id: threadId, state });
}

function sendEvent(
  send: SendFn,
  threadId: string,
  payload: import('@taskyard/protocol').AgentEvent,
) {
  send({ type: 'event', thread_id: threadId, payload });
}

export async function handleSpawn(
  ctx: ThreadHandlerContext,
  message: Extract<ServerMessage, { type: 'spawn_thread' }>,
): Promise<void> {
  const { send } = ctx;
  const threadId = message.thread_id;

  sendState(send, threadId, 'spawning');
  console.log(chalk.cyan(`Spawning thread ${threadId} (${message.agent_type})`));

  try {
    if (!(await imageExists())) {
      throw new Error(
        `Docker image "${process.env.TASKYARD_IMAGE ?? 'taskyard-base-image'}" not found. Run: docker build -f images/Dockerfile.base -t taskyard-base-image .`,
      );
    }

    const mirror = await ensureMirror(message.project_id, message.repo_url);
    const wtPath = await createWorktree(mirror, threadId, message.branch);
    const manifest = readAgentManifest(message.agent_type, ctx.agentsDir);

    threadMeta.set(threadId, {
      projectId: message.project_id,
      mirror,
      worktreePath: wtPath,
    });

    await spawnContainer({
      message,
      worktreePath: wtPath,
      manifest,
      agentsDir: ctx.agentsDir,
      onLog: (id, payload) => sendEvent(send, id, payload),
      onExit: (id, code) => {
        const state = code === 0 ? 'completed' : 'error';
        console.log(chalk.gray(`Thread ${id} exited (${code}) → ${state}`));
        sendState(send, id, state);
        // Worktree kept until close; meta retained for cleanup.
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

export async function handleKill(
  ctx: ThreadHandlerContext,
  message: Extract<ServerMessage, { type: 'kill_thread' }>,
): Promise<void> {
  console.log(chalk.yellow(`Killing thread ${message.thread_id}`));
  await stopContainer(message.thread_id);
  await cleanupThread(message.thread_id, true);
  ctx.send({ type: 'state_change', thread_id: message.thread_id, state: 'error' });
}

export async function handleClose(
  ctx: ThreadHandlerContext,
  message: Extract<ServerMessage, { type: 'close_thread' }>,
): Promise<void> {
  console.log(chalk.yellow(`Closing thread ${message.thread_id}`));
  await removeContainer(message.thread_id);
  await cleanupThread(message.thread_id, true);
  ctx.send({ type: 'state_change', thread_id: message.thread_id, state: 'closed' });
}

async function cleanupThread(
  threadId: string,
  force: boolean,
  projectId?: string,
): Promise<void> {
  const entry = threadMeta.get(threadId);
  const mirror = entry?.mirror ?? (projectId ? mirrorPath(projectId) : null);
  if (mirror) await removeWorktree(mirror, threadId, force);
  threadMeta.delete(threadId);
}
