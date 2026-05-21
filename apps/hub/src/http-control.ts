import http from 'node:http';
import type { ServerMessage } from '@taskyard/protocol';
import { sendToWorker, pingAllWorkers } from './worker-socket.js';

const CONTROL_TOKEN = process.env.HUB_CONTROL_TOKEN;

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function json(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function isAuthorized(req: http.IncomingMessage): boolean {
  if (!CONTROL_TOKEN) return true;
  const header = req.headers['x-hub-token'];
  return header === CONTROL_TOKEN;
}

export function startControlServer(port: number): http.Server {
  const server = http.createServer(async (req, res) => {
    if (req.method !== 'POST') {
      json(res, 405, { error: 'Method not allowed' });
      return;
    }

    if (!isAuthorized(req)) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }

    const url = req.url ?? '/';
    let body: Record<string, unknown> = {};
    try {
      const raw = await readBody(req);
      if (raw) body = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      json(res, 400, { error: 'Invalid JSON' });
      return;
    }

    if (url === '/ping') {
      pingAllWorkers();
      json(res, 200, { ok: true });
      return;
    }

    const machineId = body.machine_id as string | undefined;
    const threadId = body.thread_id as string | undefined;

    if (url === '/spawn') {
      const msg = body as Extract<ServerMessage, { type: 'spawn_thread' }> & {
        machine_id?: string;
      };
      if (!machineId || !msg.thread_id || !msg.project) {
        json(res, 400, { error: 'machine_id and spawn fields required' });
        return;
      }
      const { machine_id: _mid, ...spawnMsg } = msg;
      const sent = sendToWorker(machineId, spawnMsg);
      if (!sent) {
        json(res, 503, { error: 'Worker not reachable' });
        return;
      }
      json(res, 200, { ok: true });
      return;
    }

    if (url === '/kill' || url === '/close') {
      if (!threadId || !machineId) {
        json(res, 400, { error: 'thread_id and machine_id required' });
        return;
      }
      const type = url === '/kill' ? 'kill_thread' : 'close_thread';
      const sent = sendToWorker(machineId, { type, thread_id: threadId });
      if (!sent) {
        json(res, 503, { error: 'Worker not reachable' });
        return;
      }
      json(res, 200, { ok: true });
      return;
    }

    json(res, 404, { error: 'Not found' });
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`Hub control API listening on http://127.0.0.1:${port}`);
  });

  return server;
}
