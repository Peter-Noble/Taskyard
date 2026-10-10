import fs from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';
import type { AgentEvent } from '@taskyard/protocol';
import { NdjsonRpc } from './ndjson-rpc.js';
import {
  autoAllowPermissionResponse,
  isToolPermissionRequest,
  mapSessionUpdate,
} from './map-events.js';

export type AcpPendingKind =
  | 'session/request_permission'
  | 'cursor/ask_question'
  | 'cursor/create_plan';

export type AcpPendingRequest = {
  kind: AcpPendingKind;
  rpcId: number | string;
  payload: unknown;
};

export type AcpClientOptions = {
  command: string[];
  cwd: string;
  env: Record<string, string>;
  authMethod: string;
  onEvent: (event: AgentEvent) => void;
  onPending: (pending: AcpPendingRequest) => void;
  onExit: (code: number | null) => void;
};

export class AcpClient {
  private proc: ChildProcess | null = null;
  private rpc: NdjsonRpc | null = null;
  private sessionId: string | null = null;
  private readonly pendingUi = new Map<string, AcpPendingRequest>();
  private readonly opts: AcpClientOptions;

  constructor(opts: AcpClientOptions) {
    this.opts = opts;
  }

  async start(initialPrompt: string): Promise<void> {
    await this.spawnProcess();
    await this.rpc!.request('initialize', {
      protocolVersion: 1,
      clientCapabilities: {
        fs: { readTextFile: false, writeTextFile: false },
        terminal: false,
      },
      clientInfo: { name: 'taskyard-worker', version: '0.0.1' },
    });
    await this.rpc!.request('authenticate', { methodId: this.opts.authMethod });

    const session = (await this.rpc!.request('session/new', {
      cwd: this.opts.cwd,
      mcpServers: [],
    })) as { sessionId?: string };
    this.sessionId = session.sessionId ?? null;
    if (!this.sessionId) throw new Error('ACP session/new did not return sessionId');

    await this.prompt(initialPrompt);
  }

  async followUp(prompt: string): Promise<void> {
    if (!this.sessionId || !this.rpc) throw new Error('ACP session is not active');
    await this.prompt(prompt);
  }

  async cancel(): Promise<void> {
    if (!this.sessionId || !this.rpc) return;
    try {
      await this.rpc.request('session/cancel', { sessionId: this.sessionId });
    } catch {
      // Process may already be exiting.
    }
  }

  async kill(): Promise<void> {
    await this.cancel();
    this.rpc?.kill('SIGTERM');
    this.proc = null;
    this.rpc = null;
    this.sessionId = null;
    this.pendingUi.clear();
  }

  resolvePending(requestId: string, result: unknown): boolean {
    const entry = this.pendingUi.get(requestId);
    if (!entry || !this.rpc) return false;
    this.pendingUi.delete(requestId);
    this.rpc.respond(entry.rpcId, result);
    return true;
  }

  private async prompt(text: string): Promise<void> {
    if (!this.sessionId || !this.rpc) throw new Error('ACP session is not active');
    await this.rpc.request('session/prompt', {
      sessionId: this.sessionId,
      prompt: [{ type: 'text', text }],
    });
  }

  private async spawnProcess(): Promise<void> {
    const [bin, ...args] = this.opts.command;
    const isWin = process.platform === 'win32';
    const proc = spawn(bin, args, {
      cwd: this.opts.cwd,
      env: this.opts.env,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: isWin,
    });
    this.proc = proc;

    this.rpc = new NdjsonRpc({
      proc,
      onNotification: (method, params) => this.handleNotification(method, params),
      onRequest: (id, method, params) => this.handleRequest(id, method, params),
      onError: (message) => {
        this.opts.onEvent({ type: 'stdout', content: message });
      },
    });

    proc.on('error', (err) => {
      this.opts.onEvent({ type: 'error', message: err.message });
      this.opts.onExit(1);
    });

    proc.on('close', (code) => {
      this.opts.onExit(code);
    });
  }

  private handleNotification(method: string, params: unknown): void {
    if (method === 'session/update') {
      for (const event of mapSessionUpdate(params)) {
        this.opts.onEvent(event);
      }
      return;
    }

    if (method.startsWith('cursor/')) {
      this.opts.onEvent({
        type: 'system',
        event: 'acp_notification',
        method,
        payload: params,
      });
    }
  }

  private handleRequest(id: number | string, method: string, params: unknown): void {
    if (method === 'session/request_permission') {
      if (isToolPermissionRequest(params)) {
        this.rpc?.respond(id, autoAllowPermissionResponse());
        return;
      }
      this.enqueuePending(id, 'session/request_permission', params);
      return;
    }

    if (method === 'cursor/ask_question' || method === 'cursor/create_plan') {
      this.enqueuePending(id, method, params);
      return;
    }

    // Unknown blocking method — auto-accept with empty outcome to avoid deadlock.
    this.rpc?.respond(id, { outcome: { outcome: 'cancelled' } });
  }

  private enqueuePending(rpcId: number | string, kind: AcpPendingKind, payload: unknown): void {
    const requestId = String(rpcId);
    const pending: AcpPendingRequest = { kind, rpcId, payload };
    this.pendingUi.set(requestId, pending);
    this.opts.onPending(pending);
    this.opts.onEvent({
      type: 'system',
      event: 'acp_pending',
      request_id: requestId,
      method: kind,
      payload,
    });
  }
}

export function acpCommandAvailable(command: string[]): boolean {
  const [bin] = command;
  if (!bin) return false;
  const pathEnv = process.env.PATH ?? '';
  const sep = process.platform === 'win32' ? ';' : ':';
  const exts =
    process.platform === 'win32'
      ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';')
      : [''];

  for (const dir of pathEnv.split(sep)) {
    if (!dir) continue;
    for (const ext of exts.length ? exts : ['']) {
      const candidate = `${dir}${process.platform === 'win32' ? '\\' : '/'}${bin}${ext}`;
      try {
        if (fs.existsSync(candidate)) return true;
      } catch {
        // continue
      }
    }
  }

  // Fallback: rely on shell resolution when spawning with shell:true on Windows.
  return process.platform === 'win32';
}
