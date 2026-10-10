import chalk from 'chalk';
import { connectToHub } from './server-ws.js';
import { getAgentsDir } from './config.js';

export type WorkerOptions = {
  hub: string;
  name?: string;
  ports: string;
  id?: string;
  agentsDir?: string;
  local?: boolean;
  maxConcurrentThreads?: number;
};

export async function runWorker(opts: WorkerOptions): Promise<void> {
  const [startStr, endStr] = opts.ports.split('-');
  const portRange = { start: Number(startStr), end: Number(endStr) };
  const agentsDir = getAgentsDir(opts.agentsDir);
  const maxConcurrent =
    opts.maxConcurrentThreads ??
    (process.env.TASKYARD_MAX_CONCURRENT_THREADS
      ? Number(process.env.TASKYARD_MAX_CONCURRENT_THREADS)
      : 2);

  console.log(chalk.cyan('Taskyard worker'));
  console.log(`  Hub:    ${opts.hub}`);
  console.log(`  Name:   ${opts.name ?? '(hostname)'}`);
  console.log(`  Ports:  ${portRange.start}-${portRange.end}`);
  console.log(`  Agents: ${agentsDir}`);
  console.log(`  Max concurrent threads: ${maxConcurrent}`);

  await connectToHub({
    hubUrl: opts.hub,
    name: opts.name,
    portRange,
    machineId: opts.id,
    agentsDir,
    local: opts.local,
    maxConcurrentThreads: maxConcurrent,
  });
}
