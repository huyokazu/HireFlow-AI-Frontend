import path from 'node:path';

import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      '@app': path.resolve(import.meta.dirname, '../src'),
      '@': path.resolve(import.meta.dirname, 'src'),
      'server-only': path.resolve(import.meta.dirname, 'tests/server-only-stub.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Integration tests share one local Supabase stack.
    fileParallelism: false,
    testTimeout: 20_000,
    env: { ...loadEnv(mode, process.cwd(), ''), GOOGLE_MODE: 'simulated' },
  },
}));
