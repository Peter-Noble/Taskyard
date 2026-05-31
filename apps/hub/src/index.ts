import { WebSocketServer } from 'ws';
import { checkDeadWorkers, getDb, loadTaskyardEnv } from '@taskyard/core';
import { attachWorkerSocket } from './worker-socket.js';
import { startControlServer } from './http-control.js';
import { pingAllWorkers } from './worker-socket.js';

loadTaskyardEnv();

const WS_PORT = Number(process.env.HUB_PORT ?? 3001);
const CONTROL_PORT = Number(process.env.HUB_CONTROL_PORT ?? 3002);

const wss = new WebSocketServer({ port: WS_PORT });

wss.on('connection', (socket) => {
  attachWorkerSocket(socket);
});

startControlServer(CONTROL_PORT);

console.log(`Taskyard hub WebSocket (workers): ws://127.0.0.1:${WS_PORT}`);
console.log(`Taskyard hub control API (server): http://127.0.0.1:${CONTROL_PORT} — GET /health, POST /spawn|kill|close|ping`);

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
