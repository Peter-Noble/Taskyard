import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'taskyard');
const MACHINE_ID_FILE = path.join(CONFIG_DIR, 'machine-id');

export async function getMachineId(): Promise<string> {
  try {
    const existing = await fs.readFile(MACHINE_ID_FILE, 'utf8');
    const id = existing.trim();
    if (id) return id;
  } catch {
    // generate below
  }

  const id = randomUUID();
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(MACHINE_ID_FILE, id, 'utf8');
  return id;
}
