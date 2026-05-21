import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  transpilePackages: ['@taskyard/core', '@taskyard/db', '@taskyard/protocol'],
};

export default nextConfig;
