import os from 'node:os';
import { WebSocket } from 'ws';
import chalk from 'chalk';
import type { ServerMessage, WorkerMessage } from '@taskyard/protocol';
import { getMachineId } from './protocol.js';
import { getMachineSpecs, getUtilization } from './specs.js';
import { handleSpawn, handleKill, handleClose, handleFollowUp, handleResolvePrompt } from './thread-handler.js';

export type HubConnectionOptions = {
  hubUrl: string;
  name?: string;
  portRange: { start: number; end: number };
  machineId?: string;
  agentsDir?: string;
  local?: boolean;
  maxConcurrentThreads?: number;
};

const MAX_BACKOFF_MS = 30_000;
const HEARTBEAT_MS = 30_000;

export async function connectToHub(opts: HubConnectionOptions): Promise<never> {
  const machineId = opts.machineId ?? (await getMachineId());
  const hostname = opts.name ?? os.hostname();
  let backoff = 1000;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  let ws: WebSocket | undefined;

  const send = (msg: WorkerMessage) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  };

  const ctx = {
    send,
    agentsDir: opts.agentsDir,
    maxConcurrentThreads: opts.maxConcurrentThreads,
  };

  const handleMessage = (data: Buffer | ArrayBuffer | Buffer[]) => {
    let message: ServerMessage;
    try {
      message = JSON.parse(data.toString()) as ServerMessage;
    } catch {
      console.warn('Invalid hub message');
      return;
    }

    if (message.type === 'ping') {
      send({ type: 'pong' });
      return;
    }

    if (message.type === 'spawn_thread') {
      handleSpawn(ctx, message).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(chalk.red('Spawn failed:'), msg);
        send({
          type: 'event',
          thread_id: message.thread_id,
          payload: { type: 'error', message: `Spawn failed: ${msg}` },
        });
        send({
          type: 'state_change',
          thread_id: message.thread_id,
          state: 'error',
        });
      });
      return;
    }
    if (message.type === 'kill_thread') {
      handleKill(ctx, message).catch((err) => {
        console.error(chalk.red('Kill failed:'), err instanceof Error ? err.message : String(err));
      });
      return;
    }
    if (message.type === 'close_thread') {
      handleClose(ctx, message).catch((err) => {
        console.error(chalk.red('Close failed:'), err instanceof Error ? err.message : String(err));
      });
      return;
    }
    if (message.type === 'follow_up') {
      handleFollowUp(ctx, message).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(chalk.red('Follow-up failed:'), msg);
        send({
          type: 'event',
          thread_id: message.thread_id,
          payload: { type: 'error', message: `Follow-up failed: ${msg}` },
        });
      });
      return;
    }
    if (message.type === 'resolve_prompt') {
      handleResolvePrompt(ctx, message).catch((err) => {
        console.error(
          chalk.red('Resolve failed:'),
          err instanceof Error ? err.message : String(err),
        );
      });
      return;
    }
  };

  const register = async () => {
    const specs = await getMachineSpecs();
    send({
      type: 'register',
      id: machineId,
      hostname,
      specs,
      port_range: opts.portRange,
      is_local: opts.local ?? false,
    });
    const localTag = opts.local ? chalk.cyan(' [local]') : '';
    console.log(chalk.green(`Registered with hub as ${hostname} (${machineId})${localTag}`));
  };

  const startHeartbeat = () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(async () => {
      if (ws?.readyState !== WebSocket.OPEN) return;
      const util = await getUtilization();
      send({
        type: 'heartbeat',
        machine_id: machineId,
        cpu_percent: util.cpu_percent,
        ram_used_gb: util.ram_used_gb,
      });
    }, HEARTBEAT_MS);
  };

  const connect = () => {
    ws = new WebSocket(opts.hubUrl);

    ws.on('open', async () => {
      backoff = 1000;
      await register();
      startHeartbeat();
      const util = await getUtilization();
      send({
        type: 'heartbeat',
        machine_id: machineId,
        cpu_percent: util.cpu_percent,
        ram_used_gb: util.ram_used_gb,
      });
    });

    ws.on('message', handleMessage);

    ws.on('close', () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      console.log(chalk.yellow(`Disconnected from hub. Reconnecting in ${backoff}ms...`));
      setTimeout(connect, backoff);
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
    });

    ws.on('error', (err) => {
      console.error(chalk.red('Hub connection error:'), err.message);
    });
  };

  connect();

  return new Promise(() => {
    // Run until process exit.
  });
}
