import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e',
    environment: 'node',
    include: ['tests/e2e/**/*.test.ts'],
    globals: false,
    // Electron suites use native windows and keyboard/scroll focus. Running
    // several apps concurrently makes those interactions unreliable on macOS.
    fileParallelism: false,
    globalSetup: './tests/e2e/setup.ts',
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
