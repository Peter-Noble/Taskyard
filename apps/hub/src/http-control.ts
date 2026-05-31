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

function healthPayload(port: number) {
  return {
    ok: true,
    service: 'taskyard-hub-control',
    port,
    websocket: `ws://127.0.0.1:${process.env.HUB_PORT ?? 3001}`,
    endpoints: {
      'GET /health': 'This status response',
      'POST /spawn': 'Forward spawn_thread to a worker (requires X-Hub-Token if HUB_CONTROL_TOKEN is set)',
      'POST /kill': 'Kill thread on worker',
      'POST /close': 'Close thread on worker',
      'POST /ping': 'Ping all connected workers',
    },
  };
}

export function startControlServer(port: number): http.Server {
  const server = http.createServer(async (req, res) => {
    const url = req.url ?? '/';
    const method = req.method ?? 'GET';

    if (method === 'GET' && (url === '/' || url === '/health')) {
      json(res, 200, healthPayload(port));
      return;
    }

    if (method !== 'POST') {
      json(res, 405, {
        error: 'Method not allowed',
        hint: 'Workers use WebSocket on HUB_PORT (default 3001). This HTTP API accepts POST only; try GET /health.',
      });
      return;
    }

    if (!isAuthorized(req)) {
      json(res, 401, { error: 'Unauthorized' });
      return;
    }

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
