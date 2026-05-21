import { vault } from '@taskyard/db';
import { eq, or } from 'drizzle-orm';
import type { TaskyardDb } from '@taskyard/db';
import { readAgentManifest } from './agents.js';

export type VaultEntry = {
  id: number;
  agent_type: string;
  key_name: string;
  masked_value: string;
  created_at: string;
};

function maskValue(value: string): string {
  if (value.length <= 4) return '****';
  return `${'*'.repeat(Math.min(8, value.length - 4))}${value.slice(-4)}`;
}

export function listVault(db: TaskyardDb, agentType?: string): VaultEntry[] {
  const rows = agentType
    ? db.select().from(vault).where(eq(vault.agentType, agentType)).all()
    : db.select().from(vault).all();

  return rows.map((r) => ({
    id: r.id,
    agent_type: r.agentType,
    key_name: r.keyName,
    masked_value: maskValue(r.keyValue),
    created_at: r.createdAt?.toISOString() ?? new Date().toISOString(),
  }));
}

export function setVaultKeys(
  db: TaskyardDb,
  agentType: string,
  keys: Record<string, string>,
): void {
  for (const [keyName, keyValue] of Object.entries(keys)) {
    const existing = db
      .select()
      .from(vault)
      .where(eq(vault.agentType, agentType))
      .all()
      .find((r) => r.keyName === keyName);

    if (existing) {
      db.update(vault).set({ keyValue }).where(eq(vault.id, existing.id)).run();
    } else {
      db.insert(vault).values({ agentType, keyName, keyValue }).run();
    }
  }
}

export function deleteVaultKey(db: TaskyardDb, id: number): boolean {
  const row = db.select().from(vault).where(eq(vault.id, id)).get();
  if (!row) return false;
  db.delete(vault).where(eq(vault.id, id)).run();
  return true;
}

export function getEnvForAgent(db: TaskyardDb, agentType: string): Record<string, string> {
  const manifest = readAgentManifest(agentType);
  const env: Record<string, string> = {};

  const rows = db
    .select()
    .from(vault)
    .where(or(eq(vault.agentType, agentType), eq(vault.agentType, '_global')))
    .all();

  for (const row of rows) {
    env[row.keyName] = row.keyValue;
  }

  if (manifest) {
    for (const key of manifest.env_vars) {
      if (!env[key]) {
        const row = rows.find((r) => r.keyName === key);
        if (row) env[key] = row.keyValue;
      }
    }
  }

  const gitPat = db
    .select()
    .from(vault)
    .where(eq(vault.keyName, 'GIT_PAT'))
    .all()[0];
  if (gitPat) env.GIT_PAT = gitPat.keyValue;

  return env;
}
