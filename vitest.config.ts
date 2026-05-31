import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

function packageSrc(name: string) {
  return path.resolve(root, 'packages', name, 'src', 'index.ts');
}

export default defineConfig({
  resolve: {
    alias: {
      '@taskyard/protocol': packageSrc('protocol'),
      '@taskyard/db': packageSrc('db'),
      '@taskyard/core': packageSrc('core'),
      '@taskyard/test-utils': packageSrc('test-utils'),
    },
  },
  test: {
    environment: 'node',
    globalSetup: [path.resolve(root, 'vitest.global-setup.ts')],
    setupFiles: [path.resolve(root, 'vitest.setup.ts')],
    include: [
      'packages/**/*.unit.test.ts',
      'packages/**/*.integration.test.ts',
      'apps/**/*.unit.test.ts',
      'apps/**/*.integration.test.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**'],
    pool: 'forks',
    fileParallelism: true,
    coverage: {
      provider: 'v8',
      include: ['packages/core/src/**', 'packages/db/src/**', 'apps/hub/src/**', 'apps/cli/src/**'],
      exclude: ['**/*.test.ts', '**/dist/**'],
    },
  },
});
