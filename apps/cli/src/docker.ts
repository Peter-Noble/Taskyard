import path from 'node:path';
import type { ContainerCreateOptions } from 'dockerode';
import Dockerode from 'dockerode';
import type { AgentManifest } from '@taskyard/protocol';
import type { ServerMessage } from '@taskyard/protocol';
import { RUSTDESK_CONTAINER_PORT } from '@taskyard/protocol';
import { DOCKER_IMAGE, containerName, getAgentsDir } from './config.js';
import { buildContainerCmd } from './manifest.js';
import { createLineBuffer, parseLogLine } from './events.js';

export const docker = new Dockerode();

export type SpawnContainerOptions = {
  message: Extract<ServerMessage, { type: 'spawn_thread' }>;
  worktreePath: string;
  manifest: AgentManifest;
  agentsDir?: string;
  onLog: (threadId: string, event: ReturnType<typeof parseLogLine>) => void;
  onExit: (threadId: string, exitCode: number) => void;
};

export async function spawnContainer(opts: SpawnContainerOptions): Promise<string> {
  const { message: msg } = opts;
  const name = containerName(msg.thread_id);
  const agentMount = path.resolve(getAgentsDir(opts.agentsDir), msg.agent_type);
  const worktreeAbs = path.resolve(opts.worktreePath);

  const env = [
    `TASKYARD_THREAD_ID=${msg.thread_id}`,
    `TASKYARD_PROJECT=${msg.project}`,
    `TASKYARD_PROMPT=${msg.prompt}`,
    `TASKYARD_WORKSPACE=/workspace`,
    `TASKYARD_GIT_PAT=${msg.env.GIT_PAT ?? ''}`,
    ...Object.entries(msg.env).map(([k, v]) => `${k}=${v}`),
  ];

  const createOpts: ContainerCreateOptions = {
    name,
    Image: DOCKER_IMAGE,
    Env: env,
    Cmd: buildContainerCmd(opts.manifest),
    HostConfig: {
      Binds: [`${worktreeAbs}:/workspace`, `${agentMount}:/agent:ro`],
      PortBindings: {
        [`${RUSTDESK_CONTAINER_PORT}/tcp`]: [{ HostPort: String(msg.ports.rustdesk) }],
        '8080/tcp': [{ HostPort: String(msg.ports.web) }],
      },
      AutoRemove: true,
    },
  };

  const existing = docker.getContainer(name);
  try {
    await existing.inspect();
    await existing.remove({ force: true });
  } catch {
    // not running
  }

  const container = await docker.createContainer(createOpts);
  await container.start();

  const stream = await container.logs({
    follow: true,
    stdout: true,
    stderr: true,
    tail: 0,
  });

  const onChunk = createLineBuffer((line) => {
    opts.onLog(msg.thread_id, parseLogLine(line));
  });

  stream.on('data', onChunk);

  container.wait((err, data) => {
    if (err) {
      opts.onLog(msg.thread_id, { type: 'error', message: err.message });
      opts.onExit(msg.thread_id, 1);
      return;
    }
    opts.onExit(msg.thread_id, data?.StatusCode ?? 0);
  });

  const info = await container.inspect();
  return info.Id;
}

export async function stopContainer(threadId: string): Promise<void> {
  const name = containerName(threadId);
  try {
    const container = docker.getContainer(name);
    await container.stop({ t: 10 });
    // AutoRemove: true handles removal; explicit remove() races with Docker.
  } catch {
    // already gone
  }
}

export async function removeContainer(threadId: string): Promise<void> {
  const name = containerName(threadId);
  try {
    const container = docker.getContainer(name);
    // When AutoRemove is enabled, the container may already be gone.
    // Inspect first to avoid a race with Docker's auto-cleanup.
    await container.inspect();
    await container.remove({ force: true });
  } catch {
    // not present or already removed
  }
}

export async function imageExists(): Promise<boolean> {
  try {
    await docker.getImage(DOCKER_IMAGE).inspect();
    return true;
  } catch {
    return false;
  }
}
