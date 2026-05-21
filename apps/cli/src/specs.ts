import os from 'node:os';
import si from 'systeminformation';
import type { MachineSpecs } from '@taskyard/protocol';

export async function getMachineSpecs(): Promise<MachineSpecs> {
  try {
    const [cpu, mem] = await Promise.all([si.cpu(), si.mem()]);
    return {
      cpu_cores: cpu.cores || os.cpus().length,
      ram_gb: Math.max(1, Math.round(mem.total / 1024 ** 3)),
      gpu: null,
    };
  } catch {
    return {
      cpu_cores: os.cpus().length,
      ram_gb: Math.max(1, Math.round(os.totalmem() / 1024 ** 3)),
      gpu: null,
    };
  }
}

export async function getUtilization(): Promise<{ cpu_percent: number; ram_used_gb: number }> {
  try {
    const [load, mem] = await Promise.all([si.currentLoad(), si.mem()]);
    return {
      cpu_percent: Math.round(load.currentLoad * 10) / 10,
      ram_used_gb: Math.round((mem.active / 1024 ** 3) * 10) / 10,
    };
  } catch {
    return { cpu_percent: 0, ram_used_gb: 0 };
  }
}
