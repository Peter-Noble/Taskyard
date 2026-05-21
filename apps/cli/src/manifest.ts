import fs from 'node:fs';
import path from 'node:path';
import type { AgentManifest } from '@taskyard/protocol';
import { getAgentsDir } from './config.js';

export function readAgentManifest(agentType: string, agentsDir?: string): AgentManifest {
  const dir = getAgentsDir(agentsDir);
  const manifestPath = path.join(dir, agentType, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Agent manifest not found: ${manifestPath}`);
  }
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as AgentManifest;
}

export function buildContainerCmd(manifest: AgentManifest): string[] {
  const entry = `/agent/${manifest.entrypoint}`;
  switch (manifest.language) {
    case 'python':
      return ['python3', entry];
    case 'typescript':
    case 'javascript':
      return ['npx', 'tsx', entry];
    default:
      return ['python3', entry];
  }
}
