import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./test/server-only-ersatz.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./test/setup-env.ts'],
    include: ['src/**/*.test.ts'],
    // Integrationstests laufen nacheinander, weil sie sich eine Datenbank teilen.
    fileParallelism: false,
  },
});
