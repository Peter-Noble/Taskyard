import chalk from 'chalk';
import { connectToHub } from './server-ws.js';
import { getAgentsDir } from './config.js';
import { imageExists } from './docker.js';

export type WorkerOptions = {
  hub: string;
  name?: string;
  ports: string;
  id?: string;
  agentsDir?: string;
};

export async function runWorker(opts: WorkerOptions): Promise<void> {
  const [startStr, endStr] = opts.ports.split('-');
  const portRange = { start: Number(startStr), end: Number(endStr) };
  const agentsDir = getAgentsDir(opts.agentsDir);

  console.log(chalk.cyan('Taskyard worker'));
  console.log(`  Hub:    ${opts.hub}`);
  console.log(`  Name:   ${opts.name ?? '(hostname)'}`);
  console.log(`  Ports:  ${portRange.start}-${portRange.end}`);
  console.log(`  Agents: ${agentsDir}`);

  if (!(await imageExists())) {
    console.log(
      chalk.yellow(
        '  Warning: Docker image taskyard-base-image not found. Build with:\n' +
          '    docker build -f images/Dockerfile.base -t taskyard-base-image .',
      ),
    );
  }

  await connectToHub({
    hubUrl: opts.hub,
    name: opts.name,
    portRange,
    machineId: opts.id,
    agentsDir,
  });
}
