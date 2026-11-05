import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  serverExternalPackages: ['better-sqlite3'],
  transpilePackages: ['@taskyard/core', '@taskyard/db', '@taskyard/protocol'],
};

export default nextConfig;
