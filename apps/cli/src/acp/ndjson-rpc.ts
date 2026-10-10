import type { ChildProcess } from 'node:child_process';
import { createLineBuffer } from '../events.js';

export type JsonRpcRequest = {
  jsonrpc: '2.0';
  id?: number | string;
  method: string;
  params?: unknown;
};

export type JsonRpcResponse = {
  jsonrpc: '2.0';
  id?: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

export type PendingRequest = {
  resolve: (result: unknown) => void;
  reject: (err: Error) => void;
};

export type NdjsonRpcOptions = {
  proc: ChildProcess;
  onNotification: (method: string, params: unknown) => void;
  onRequest: (id: number | string, method: string, params: unknown) => void;
  onError?: (message: string) => void;
};

export class NdjsonRpc {
  private nextId = 1;
  private readonly pending = new Map<number | string, PendingRequest>();
  private readonly proc: ChildProcess;
  private readonly onNotification: NdjsonRpcOptions['onNotification'];
  private readonly onRequest: NdjsonRpcOptions['onRequest'];
  private readonly onError?: NdjsonRpcOptions['onError'];
  private closed = false;

  constructor(opts: NdjsonRpcOptions) {
    this.proc = opts.proc;
    this.onNotification = opts.onNotification;
    this.onRequest = opts.onRequest;
    this.onError = opts.onError;

    const onLine = createLineBuffer((line) => this.handleLine(line));
    this.proc.stdout?.on('data', onLine);
    this.proc.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8').trim();
      if (text) this.onError?.(text);
    });
    this.proc.on('close', () => {
      this.closed = true;
      for (const [id, waiter] of this.pending) {
        this.pending.delete(id);
        waiter.reject(new Error('ACP process exited'));
      }
    });
  }

  send(method: string, params?: unknown, id?: number | string): void {
    if (this.closed) throw new Error('ACP process is not running');
    const msg: JsonRpcRequest = { jsonrpc: '2.0', method, params };
    if (id !== undefined) msg.id = id;
    this.write(msg);
  }

  request(method: string, params?: unknown): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send(method, params, id);
    });
  }

  respond(id: number | string, result: unknown): void {
    this.write({ jsonrpc: '2.0', id, result });
  }

  respondError(id: number | string, code: number, message: string): void {
    this.write({ jsonrpc: '2.0', id, error: { code, message } });
  }

  close(): void {
    this.closed = true;
    this.proc.stdin?.end();
  }

  kill(signal: NodeJS.Signals = 'SIGTERM'): void {
    this.closed = true;
    if (!this.proc.killed) this.proc.kill(signal);
  }

  private write(msg: JsonRpcRequest | JsonRpcResponse): void {
    const line = `${JSON.stringify(msg)}\n`;
    this.proc.stdin?.write(line);
  }

  private handleLine(line: string): void {
    let msg: JsonRpcRequest & JsonRpcResponse;
    try {
      msg = JSON.parse(line) as JsonRpcRequest & JsonRpcResponse;
    } catch {
      this.onError?.(`Invalid JSON from ACP: ${line.slice(0, 200)}`);
      return;
    }

    if (msg.id !== undefined && (msg.result !== undefined || msg.error !== undefined)) {
      const waiter = this.pending.get(msg.id);
      if (!waiter) return;
      this.pending.delete(msg.id);
      if (msg.error) {
        waiter.reject(new Error(msg.error.message ?? 'ACP request failed'));
      } else {
        waiter.resolve(msg.result);
      }
      return;
    }

    if (msg.method && msg.id !== undefined) {
      this.onRequest(msg.id, msg.method, msg.params);
      return;
    }

    if (msg.method) {
      this.onNotification(msg.method, msg.params);
    }
  }
}
