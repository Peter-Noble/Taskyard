import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type CliVersionInfo = {
  sha256: string;
  version: string;
};

/** Directory holding the installed bundle and version.json. */
export function installShareDir(): string {
  if (process.env.TASKYARD_INSTALL_ROOT?.trim()) {
    return path.resolve(process.env.TASKYARD_INSTALL_ROOT.trim());
  }
  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA?.trim() || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(base, 'taskyard');
  }
  return path.join(os.homedir(), '.local', 'share', 'taskyard');
}

export function installedBundlePath(): string {
  return path.join(installShareDir(), 'taskyard.mjs');
}

export function installedVersionPath(): string {
  return path.join(installShareDir(), 'version.json');
}

export function readInstalledVersion(): CliVersionInfo | null {
  const file = installedVersionPath();
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as CliVersionInfo;
    if (!parsed?.sha256 || typeof parsed.sha256 !== 'string') return null;
    return {
      sha256: parsed.sha256,
      version: typeof parsed.version === 'string' ? parsed.version : '0.0.0',
    };
  } catch {
    return null;
  }
}

export function writeInstalledVersion(info: CliVersionInfo): void {
  fs.mkdirSync(installShareDir(), { recursive: true });
  fs.writeFileSync(installedVersionPath(), `${JSON.stringify(info, null, 2)}\n`);
}
