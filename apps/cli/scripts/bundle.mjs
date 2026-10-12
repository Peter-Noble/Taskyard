#!/usr/bin/env node
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const cliRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(cliRoot, '../..');
const entry = path.join(cliRoot, 'src/bin-task.ts');
const outDir = path.join(repoRoot, 'apps/server/public/cli');
const outFile = path.join(outDir, 'taskyard.mjs');
const versionFile = path.join(outDir, 'version.json');
const pkg = JSON.parse(fs.readFileSync(path.join(cliRoot, 'package.json'), 'utf8'));

fs.mkdirSync(outDir, { recursive: true });

await esbuild.build({
  entryPoints: [entry],
  outfile: outFile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  packages: 'bundle',
  // Commander (CJS) needs createRequire when bundled into ESM.
  banner: {
    js: `import { createRequire as __taskyardCreateRequire } from 'node:module';
const require = __taskyardCreateRequire(import.meta.url);`,
  },
  logLevel: 'info',
});

const bundled = fs.readFileSync(outFile, 'utf8');
const withShebang = `#!/usr/bin/env node\n${bundled}`;
fs.writeFileSync(outFile, withShebang);
const bytes = Buffer.from(withShebang);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const version = {
  sha256,
  version: typeof pkg.version === 'string' ? pkg.version : '0.0.1',
};
fs.writeFileSync(versionFile, `${JSON.stringify(version, null, 2)}\n`);
try {
  fs.chmodSync(outFile, 0o755);
} catch {
  // ignore
}

console.log(`bundled ${outFile}`);
console.log(`version ${versionFile} sha256=${sha256.slice(0, 16)}…`);
