import { WebSocketServer } from 'ws';
import { checkDeadWorkers, getDb } from '@taskyard/core';
import { attachWorkerSocket } from './worker-socket.js';
import { startControlServer } from './http-control.js';
import { pingAllWorkers } from './worker-socket.js';

const WS_PORT = Number(process.env.HUB_PORT ?? 3001);
const CONTROL_PORT = Number(process.env.HUB_CONTROL_PORT ?? 3002);

const wss = new WebSocketServer({ port: WS_PORT });

wss.on('connection', (socket) => {
  attachWorkerSocket(socket);
});

startControlServer(CONTROL_PORT);

console.log(`Taskyard hub listening on ws://0.0.0.0:${WS_PORT}`);

setInterval(() => {
  pingAllWorkers();
}, 30_000);

setInterval(() => {
  const db = getDb();
  const marked = checkDeadWorkers(db);
  for (const id of marked) {
    console.log(`Marked worker offline (missed heartbeats): ${id}`);
  }
}, 30_000);
