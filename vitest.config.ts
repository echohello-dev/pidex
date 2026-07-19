import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      './vitest.unit.config.ts',
      './vitest.integration.config.ts',
    ],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});