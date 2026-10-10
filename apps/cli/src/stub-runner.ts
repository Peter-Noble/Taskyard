import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import type { AgentManifest } from '@taskyard/protocol';
import type { ServerMessage } from '@taskyard/protocol';
import { getAgentsDir } from './config.js';
import { buildSandboxCmd } from './manifest.js';
import { createLineBuffer, parseLogLine } from './events.js';
import type { AgentEvent } from '@taskyard/protocol';
import { buildThreadAgentEnv } from './agent-env.js';

export type StubRunnerOptions = {
  message: Extract<ServerMessage, { type: 'spawn_thread' }>;
  worktreePath: string;
  manifest: AgentManifest;
  agentsDir?: string;
  onEvent: (event: AgentEvent) => void;
  onExit: (exitCode: number) => void;
};

type RunningStub = {
  proc: ChildProcess;
};

const running = new Map<string, RunningStub>();

export async function spawnStub(opts: StubRunnerOptions): Promise<void> {
  const threadId = opts.message.thread_id;
  await stopStub(threadId);

  const agentsRoot = path.resolve(getAgentsDir(opts.agentsDir));
  const agentEntry = path.join(agentsRoot, opts.message.agent_type, opts.manifest.entrypoint);
  const cmd = buildSandboxCmd(opts.manifest, agentEntry);
  const env = buildThreadAgentEnv(opts.message, opts.worktreePath);

  const isWin = process.platform === 'win32';
  const proc = spawn(cmd[0], cmd.slice(1), {
    cwd: path.resolve(opts.worktreePath),
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
    shell: isWin,
  });

  running.set(threadId, { proc });

  const onStdout = createLineBuffer((line) => {
    opts.onEvent(parseLogLine(line));
  });

  proc.stdout?.on('data', onStdout);
  proc.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString('utf8').trim();
    if (text) opts.onEvent({ type: 'stdout', content: text });
  });

  proc.on('error', (err) => {
    running.delete(threadId);
    opts.onEvent({ type: 'error', message: err.message });
    opts.onExit(1);
  });

  proc.on('close', (code) => {
    running.delete(threadId);
    opts.onExit(code ?? 1);
  });
}

export async function stopStub(threadId: string): Promise<void> {
  const entry = running.get(threadId);
  if (!entry) return;

  const { proc } = entry;
  if (proc.exitCode !== null || proc.killed) {
    running.delete(threadId);
    return;
  }

  proc.kill('SIGTERM');
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      if (!proc.killed) proc.kill('SIGKILL');
      resolve();
    }, 10_000);
    proc.once('close', () => {
      clearTimeout(timer);
      resolve();
    });
  });
  running.delete(threadId);
}

export function stubRunningCount(): number {
  return running.size;
}
