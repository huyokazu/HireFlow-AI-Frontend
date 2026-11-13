import path from 'node:path';

import type { NextConfig } from 'next';

// The API imports the Expo app's service types from ../src (the shared contract), so the build
// root is the repository root, not backend/.
const repoRoot = path.join(import.meta.dirname, '..');

/** API-only app: every route is a JSON route handler under /api. */
const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: { root: repoRoot },
  outputFileTracingRoot: repoRoot,
};

export default nextConfig;
