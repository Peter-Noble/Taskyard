import fs from 'node:fs';
import path from 'node:path';
import type { AgentManifest } from '@taskyard/protocol';
import { agentsDir } from './paths.js';

export type AgentInfo = AgentManifest & { id: string; available?: boolean };

function commandOnPath(command: string[]): boolean {
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
      const candidate = path.join(dir, `${bin}${ext}`);
      if (fs.existsSync(candidate)) return true;
    }
  }
  return process.platform === 'win32';
}

/** Stub and ACP agents are startable. Other script folders are not offered. */
export function isOfferedAgent(id: string, manifest: AgentManifest): boolean {
  if (id === 'stub') return true;
  return manifest.runtime === 'acp' || id === 'cursor' || id === 'kimi';
}

function isAgentAvailable(id: string, manifest: AgentManifest): boolean {
  if (!isOfferedAgent(id, manifest)) return false;
  if (id === 'stub') return true;
  const command =
    manifest.command ??
    (id === 'cursor' ? ['agent', 'acp'] : id === 'kimi' ? ['kimi', 'acp'] : null);
  if (!command) return false;
  return commandOnPath(command);
}

export function listAgents(): AgentInfo[] {
  const dir = agentsDir();
  if (!fs.existsSync(dir)) return [];

  const manifests: AgentInfo[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifest = readAgentManifest(entry.name);
    if (!manifest) continue;
    if (!isOfferedAgent(entry.name, manifest)) continue;
    const available = isAgentAvailable(entry.name, manifest);
    if (available) {
      manifests.push({ ...manifest, id: entry.name, available });
    }
  }
  return manifests;
}

export function readAgentManifest(agentType: string): AgentManifest | null {
  const manifestPath = path.join(agentsDir(), agentType, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as AgentManifest;
  } catch {
    return null;
  }
}
