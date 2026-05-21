import type { ServerMessage } from '@taskyard/protocol';

const HUB_CONTROL_URL = process.env.HUB_CONTROL_URL ?? 'http://127.0.0.1:3002';
const HUB_CONTROL_TOKEN = process.env.HUB_CONTROL_TOKEN;

export class HubUnreachableError extends Error {
  constructor(cause?: unknown) {
    super('Hub control API unreachable');
    this.name = 'HubUnreachableError';
    this.cause = cause;
  }
}

async function hubPost(path: string, body: unknown): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (HUB_CONTROL_TOKEN) {
    headers['X-Hub-Token'] = HUB_CONTROL_TOKEN;
  }
  try {
    const res = await fetch(`${HUB_CONTROL_URL}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || res.statusText);
    }
  } catch (err) {
    if (err instanceof Error && err.message !== 'Hub control API unreachable') {
      throw new HubUnreachableError(err);
    }
    throw err;
  }
}

export async function hubSpawn(
  message: Extract<ServerMessage, { type: 'spawn_thread' }>,
  machineId: string,
) {
  await hubPost('/spawn', { ...message, machine_id: machineId });
}

export async function hubKill(threadId: string, machineId: string) {
  await hubPost('/kill', { thread_id: threadId, machine_id: machineId });
}

export async function hubClose(threadId: string, machineId: string) {
  await hubPost('/close', { thread_id: threadId, machine_id: machineId });
}

export async function hubPingWorkers(): Promise<void> {
  await hubPost('/ping', {});
}
