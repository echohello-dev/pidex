import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e',
    environment: 'node',
    include: ['tests/e2e/**/*.test.ts'],
    globals: false,
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});