import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    name: 'integration',
    environment: 'jsdom',
    include: ['tests/integration/**/*.test.tsx', 'tests/integration/**/*.test.ts'],
    globals: false,
    setupFiles: ['./tests/integration/setup.ts'],
  },
});