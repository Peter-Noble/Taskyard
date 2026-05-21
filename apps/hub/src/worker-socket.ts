import type { WebSocket } from 'ws';
import type { ServerMessage, WorkerMessage } from '@taskyard/protocol';
import {
  appendEvent,
  getDb,
  updateMachineHeartbeat,
  updateThreadState,
  upsertMachineOnRegister,
} from '@taskyard/core';

const workers = new Map<string, WebSocket>();

function remoteIp(socket: WebSocket): string | null {
  const req = socket as WebSocket & { _socket?: { remoteAddress?: string } };
  return req._socket?.remoteAddress ?? null;
}

export function attachWorkerSocket(socket: WebSocket): void {
  let machineId: string | undefined;

  socket.on('message', (data) => {
    let message: WorkerMessage;
    try {
      message = JSON.parse(data.toString()) as WorkerMessage;
    } catch {
      console.warn('Invalid worker message');
      return;
    }

    const db = getDb();

    if (message.type === 'register') {
      const existing = workers.get(message.id);
      if (existing && existing !== socket) {
        existing.close();
      }
      machineId = message.id;
      workers.set(message.id, socket);
      upsertMachineOnRegister(db, message, remoteIp(socket));
      console.log(`Worker registered: ${message.hostname} (${message.id})`);
      return;
    }

    if (!machineId) return;

    if (message.type === 'pong') return;

    if (message.type === 'heartbeat') {
      updateMachineHeartbeat(db, message.machine_id, message.cpu_percent, message.ram_used_gb);
      return;
    }

    if (message.type === 'event') {
      appendEvent(db, message.thread_id, message.payload);
      return;
    }

    if (message.type === 'state_change') {
      updateThreadState(db, message.thread_id, message.state);
      return;
    }
  });

  socket.on('close', () => {
    if (machineId) {
      workers.delete(machineId);
      console.log(`Worker disconnected: ${machineId}`);
    }
  });
}

export function sendToWorker(machineId: string, message: ServerMessage): boolean {
  const socket = workers.get(machineId);
  if (!socket || socket.readyState !== socket.OPEN) return false;
  socket.send(JSON.stringify(message));
  return true;
}

export function pingAllWorkers(): void {
  const ping: ServerMessage = { type: 'ping' };
  for (const socket of workers.values()) {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(ping));
    }
  }
}

export function connectedMachineIds(): string[] {
  return [...workers.keys()];
}
