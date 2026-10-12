import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type GlobalConfig = {
  server_url?: string;
};

export function globalConfigDir(): string {
  return path.join(os.homedir(), '.config', 'taskyard');
}

export function globalConfigPath(): string {
  return path.join(globalConfigDir(), 'config.json');
}

export function readGlobalConfig(): GlobalConfig | null {
  const file = globalConfigPath();
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as GlobalConfig;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function writeGlobalConfig(config: GlobalConfig): string {
  const dir = globalConfigDir();
  fs.mkdirSync(dir, { recursive: true });
  const target = globalConfigPath();
  const existing = readGlobalConfig() ?? {};
  const next: GlobalConfig = { ...existing, ...config };
  fs.writeFileSync(target, `${JSON.stringify(next, null, 2)}\n`);
  return target;
}

export function getGlobalServerUrl(): string | undefined {
  const url = readGlobalConfig()?.server_url?.trim();
  return url || undefined;
}
