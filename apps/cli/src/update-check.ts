import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  installedBundlePath,
  readInstalledVersion,
  writeInstalledVersion,
  type CliVersionInfo,
} from './install-paths.js';
import { resolveProjectContext } from './project-file.js';

function normalizeBase(url: string): string {
  return url.replace(/\/+$/, '');
}

export async function fetchRemoteVersion(serverUrl: string): Promise<CliVersionInfo | null> {
  const base = normalizeBase(serverUrl);
  const res = await fetch(`${base}/cli/version.json`, {
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) return null;
  const parsed = (await res.json()) as CliVersionInfo;
  if (!parsed?.sha256 || typeof parsed.sha256 !== 'string') return null;
  return {
    sha256: parsed.sha256,
    version: typeof parsed.version === 'string' ? parsed.version : '0.0.0',
  };
}

/** Returns the server offering a different CLI artifact, or null if the check fails. */
export async function findCliUpdate(): Promise<string | null> {
  if (process.env.TASKYARD_SKIP_UPDATE_CHECK?.trim()) return null;
  const local = readInstalledVersion();
  if (!local) return null;

  const { serverUrl } = resolveProjectContext();
  try {
    const remote = await fetchRemoteVersion(serverUrl);
    return remote && remote.sha256 !== local.sha256 ? serverUrl : null;
  } catch {
    return null;
  }
}

export async function downloadCliBundle(serverUrl: string): Promise<{
  bytes: Buffer;
  version: CliVersionInfo;
}> {
  const base = normalizeBase(serverUrl);
  const [bundleRes, versionRes] = await Promise.all([
    fetch(`${base}/cli/taskyard.mjs`, { signal: AbortSignal.timeout(60_000) }),
    fetch(`${base}/cli/version.json`, { signal: AbortSignal.timeout(10_000) }),
  ]);
  if (!bundleRes.ok) {
    throw new Error(`Failed to download CLI bundle: HTTP ${bundleRes.status}`);
  }
  const bytes = Buffer.from(await bundleRes.arrayBuffer());
  const sha256 = createHash('sha256').update(bytes).digest('hex');

  let version: CliVersionInfo = { sha256, version: '0.0.0' };
  if (versionRes.ok) {
    try {
      const parsed = (await versionRes.json()) as CliVersionInfo;
      version = {
        sha256: typeof parsed.sha256 === 'string' ? parsed.sha256 : sha256,
        version: typeof parsed.version === 'string' ? parsed.version : '0.0.0',
      };
    } catch {
      // use computed hash
    }
  }
  if (version.sha256 !== sha256) {
    throw new Error(
      `CLI bundle hash mismatch (server said ${version.sha256}, got ${sha256})`,
    );
  }
  return { bytes, version };
}

export async function cmdUpdate(serverUrl?: string): Promise<{
  path: string;
  version: CliVersionInfo;
  server_url: string;
}> {
  const resolved =
    serverUrl?.trim() ||
    process.env.TASKYARD_SERVER_URL?.trim() ||
    resolveProjectContext().serverUrl;
  const { bytes, version } = await downloadCliBundle(resolved);
  const target = installedBundlePath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, bytes, { mode: 0o755 });
  fs.renameSync(tmp, target);
  try {
    fs.chmodSync(target, 0o755);
  } catch {
    // windows
  }
  writeInstalledVersion(version);
  return { path: target, version, server_url: resolved };
}

/** True when this process is the website-installed bundle (not the monorepo CLI). */
export function isInstalledBundle(): boolean {
  if (process.env.TASKYARD_INSTALL_ROOT?.trim()) return true;
  try {
    const here = fileURLToPath(import.meta.url);
    return path.resolve(here) === path.resolve(installedBundlePath());
  } catch {
    return false;
  }
}
