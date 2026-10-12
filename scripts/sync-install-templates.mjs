import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../apps/server/src/install');
const sh = fs.readFileSync(path.join(dir, 'install.sh.txt'), 'utf8');
const ps = fs.readFileSync(path.join(dir, 'install.ps1.txt'), 'utf8');
fs.writeFileSync(
  path.join(dir, 'templates.ts'),
  `/** Install script templates (edit the .txt siblings, then run node scripts/sync-install-templates.mjs). */\n\nexport const INSTALL_SH_TEMPLATE = ${JSON.stringify(sh)};\n\nexport const INSTALL_PS1_TEMPLATE = ${JSON.stringify(ps)};\n`,
);
console.log('synced templates.ts');
