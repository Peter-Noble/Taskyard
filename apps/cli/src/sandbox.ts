import { spawn, type ChildProcess } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { AgentManifest } from '@taskyard/protocol';
import type { ServerMessage } from '@taskyard/protocol';
import { buildFlags, resolveBinary, type SandboxOptions } from 'zerobox';
import { getAgentsDir } from './config.js';
import { buildSandboxCmd } from './manifest.js';
import { createLineBuffer, parseLogLine } from './events.js';

const execFileAsync = promisify(execFile);

/** Domains where vault secrets are injected. Empty = all outbound hosts. */
const SECRET_HOSTS: Record<string, string[]> = {
  OPENAI_API_KEY: ['api.openai.com'],
  CURSOR_API_KEY: ['api.cursor.com', 'api2.cursor.sh'],
  KIMI_API_KEY: ['api.moonshot.cn'],
  GIT_PAT: ['github.com', 'api.github.com', 'gitlab.com'],
};

export type SpawnSandboxOptions = {
  message: Extract<ServerMessage, { type: 'spawn_thread' }>;
  worktreePath: string;
  manifest: AgentManifest;
  agentsDir?: string;
  onLog: (threadId: string, event: ReturnType<typeof parseLogLine>) => void;
  onExit: (threadId: string, exitCode: number) => void;
};

type RunningSandbox = {
  proc: ChildProcess;
};

const running = new Map<string, RunningSandbox>();

function secretHostsFor(key: string): string[] {
  return SECRET_HOSTS[key] ?? [];
}

function buildSandboxOptions(opts: SpawnSandboxOptions): SandboxOptions {
  const worktreeAbs = path.resolve(opts.worktreePath);
  const agentsRoot = path.resolve(getAgentsDir(opts.agentsDir));
  const agentDir = path.join(agentsRoot, opts.message.agent_type);
  const tmp = os.tmpdir();
  const npmCache = path.join(os.homedir(), '.npm');

  const env: Record<string, string> = {
    TASKYARD_THREAD_ID: opts.message.thread_id,
    TASKYARD_PROJECT: opts.message.project,
    TASKYARD_PROMPT: opts.message.prompt,
    TASKYARD_WORKSPACE: worktreeAbs,
    TASKYARD_WEB_PORT: String(opts.message.ports?.web ?? ''),
    TASKYARD_GIT_PAT: opts.message.env.GIT_PAT ?? '',
  };

  const secrets: NonNullable<SandboxOptions['secrets']> = {};
  for (const key of opts.manifest.env_vars) {
    const value = opts.message.env[key];
    if (value) {
      secrets[key] = { value, hosts: secretHostsFor(key) };
    }
  }

  if (
    (opts.manifest.language === 'typescript' || opts.manifest.language === 'javascript') &&
    Object.keys(secrets).length > 0
  ) {
    env.NODE_OPTIONS = '--use-env-proxy';
  }

  return {
    allowRead: [agentsRoot, agentDir, worktreeAbs],
    allowWrite: [worktreeAbs, tmp, npmCache],
    allowNet: true,
    cwd: worktreeAbs,
    env,
    secrets,
  };
}

export async function spawnSandbox(opts: SpawnSandboxOptions): Promise<string> {
  const { message: msg } = opts;
  const threadId = msg.thread_id;
  const agentsRoot = path.resolve(getAgentsDir(opts.agentsDir));
  const agentEntry = path.join(agentsRoot, msg.agent_type, opts.manifest.entrypoint);
  const flags = buildFlags(buildSandboxOptions(opts));
  const bin = resolveBinary();
  const cmd = buildSandboxCmd(opts.manifest, agentEntry);
  const argv = [...flags, '--', ...cmd];

  await stopSandbox(threadId);

  const proc = spawn(bin, argv, {
    cwd: path.resolve(opts.worktreePath),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });

  running.set(threadId, { proc });

  const onStdout = createLineBuffer((line) => {
    opts.onLog(threadId, parseLogLine(line));
  });

  proc.stdout?.on('data', onStdout);
  proc.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString('utf8').trim();
    if (text) {
      opts.onLog(threadId, { type: 'stdout', content: text });
    }
  });

  proc.on('error', (err) => {
    running.delete(threadId);
    opts.onLog(threadId, { type: 'error', message: err.message });
    opts.onExit(threadId, 1);
  });

  proc.on('close', (code) => {
    running.delete(threadId);
    opts.onExit(threadId, code ?? 1);
  });

  return threadId;
}

export async function stopSandbox(threadId: string): Promise<void> {
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

export async function removeSandbox(threadId: string): Promise<void> {
  await stopSandbox(threadId);
}

export async function sandboxAvailable(): Promise<boolean> {
  try {
    const bin = resolveBinary();
    await execFileAsync(bin, ['--version'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}
