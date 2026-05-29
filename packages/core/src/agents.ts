import fs from 'node:fs';
import path from 'node:path';
import type { AgentManifest } from '@taskyard/protocol';
import { agentsDir } from './paths.js';

export type AgentInfo = AgentManifest & { id: string };

export function listAgents(): AgentInfo[] {
  const dir = agentsDir();
  if (!fs.existsSync(dir)) return [];

  const manifests: AgentInfo[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifest = readAgentManifest(entry.name);
    if (manifest) manifests.push({ ...manifest, id: entry.name });
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
