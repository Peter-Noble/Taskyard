import type { Command } from 'commander';
import { setTimeout as delay } from 'node:timers/promises';
import { clearCliToken, credentialServerUrl, readCliToken, saveCliToken } from './credentials.js';
import { apiFetch, getServerUrl, TaskCliError, writeError } from './task-cli.js';

type LoginRequest = { code: string; secret: string; expires_in: number; interval: number };
type LoginPoll = { status: 'pending' } | { status: 'approved'; token: string; username: string };

function loginServer(value?: string): string {
  const server = credentialServerUrl(value?.trim() || getServerUrl());
  if (!server) throw new TaskCliError(1, {
    error: 'Terminal sign-in requires an HTTPS Taskyard URL. HTTP is supported on loopback for local development.',
    hint: 'Set TASKYARD_SERVER_URL to the HTTPS URL, or update server_url in your Taskyard configuration.',
  });
  return server;
}

function authRequest<T>(server: string, path: string, body?: object, token?: string): Promise<T> {
  return apiFetch<T>(path, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
    body: body && JSON.stringify(body),
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  }, server, false);
}

async function cmdLogin(serverUrl?: string): Promise<void> {
  const server = loginServer(serverUrl);
  const previousToken = readCliToken(server);
  const request = await authRequest<LoginRequest>(server, '/api/auth/cli/start');
  if (typeof request?.code !== 'string' || typeof request.secret !== 'string' ||
      !Number.isFinite(request.interval) || request.interval <= 0 ||
      !Number.isFinite(request.expires_in) || request.expires_in <= 0) {
    throw new Error('This Taskyard server returned an invalid terminal sign-in request.');
  }

  process.stderr.write(`Open ${server}/activate and enter code ${request.code}.\nWaiting for browser approval…\n`);
  const deadline = Date.now() + request.expires_in * 1_000;
  while (Date.now() < deadline) {
    await delay(Math.min(request.interval * 1_000, Math.max(0, deadline - Date.now())));
    let result: LoginPoll;
    try {
      result = await authRequest<LoginPoll>(server, '/api/auth/cli/poll', { secret: request.secret });
    } catch (err) {
      if (err instanceof TaskCliError && (err.status === 0 || err.status === 429 || err.status >= 500)) continue;
      throw err;
    }
    if (result.status === 'pending') continue;
    if (result.status !== 'approved' || !result.token || !result.username) {
      throw new Error('This Taskyard server returned an invalid terminal session.');
    }

    try {
      saveCliToken(server, result.token);
    } catch (err) {
      await authRequest(server, '/api/auth/logout', undefined, result.token).catch(() => undefined);
      throw err;
    }
    if (previousToken && previousToken !== result.token) {
      try {
        await authRequest(server, '/api/auth/logout', undefined, previousToken);
      } catch {
        process.stderr.write('Could not revoke the previous terminal session. You can sign it out from Account.\n');
      }
    }
    process.stdout.write(`Signed in to ${server} as ${result.username}.\n`);
    return;
  }
  throw new Error('Terminal sign-in expired. Run taskyard login again.');
}

async function cmdLogout(serverUrl?: string): Promise<void> {
  const server = loginServer(serverUrl);
  const token = readCliToken(server);
  if (!token) {
    process.stdout.write(`No saved terminal session for ${server}.\n`);
    return;
  }
  await authRequest(server, '/api/auth/logout', undefined, token);
  clearCliToken(server, token);
  process.stdout.write(`Signed out of ${server}.\n`);
}

export function registerAuthCommands(program: Command): void {
  program.command('login')
    .description('Sign in by approving this terminal in a browser')
    .option('--server <url>', 'Taskyard server URL (default: resolved server_url)')
    .action((opts: { server?: string }) => cmdLogin(opts.server).catch(writeError));

  program.command('logout')
    .description('Revoke and remove the saved terminal session')
    .option('--server <url>', 'Taskyard server URL (default: resolved server_url)')
    .action((opts: { server?: string }) => cmdLogout(opts.server).catch(writeError));
}
