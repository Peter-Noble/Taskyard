import { describe, expect, it } from 'vitest';
import type { AgentManifest } from '@taskyard/protocol';
import { isOfferedAgent, listAgents, readAgentManifest } from './agents.js';

const scriptManifest: AgentManifest = {
  name: 'Script',
  description: 'Local script runner',
  version: '1.0.0',
  entrypoint: 'run.ts',
  language: 'typescript',
  env_vars: [],
};

describe('offered agents', () => {
  it('offers the stub and ACP agents, and omits other script runners', () => {
    expect(isOfferedAgent('stub', scriptManifest)).toBe(true);
    expect(isOfferedAgent('cursor', { ...scriptManifest, runtime: 'acp' })).toBe(true);
    expect(isOfferedAgent('kimi', { ...scriptManifest, runtime: 'acp' })).toBe(true);
    expect(isOfferedAgent('codex', scriptManifest)).toBe(false);
    expect(isOfferedAgent('other', scriptManifest)).toBe(false);

    const agents = listAgents();
    const ids = agents.map((agent) => agent.id);
    expect(ids).toContain('stub');
    expect(ids).not.toContain('codex');
    expect(readAgentManifest('codex')).toBeNull();
    expect(readAgentManifest('cursor')?.runtime).toBe('acp');
    expect(readAgentManifest('kimi')?.runtime).toBe('acp');
    for (const agent of agents) {
      expect(agent.id === 'stub' || agent.runtime === 'acp').toBe(true);
    }
  });
});
