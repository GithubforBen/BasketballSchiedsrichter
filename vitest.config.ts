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
    /*
     * Die Voreinstellung sind fuenf Sekunden. Das reicht fuer die reinen
     * Fachtests reichlich, aber nicht fuer die Integrationstests: der
     * Nachrichtenlauf legt je Fall ein Dutzend Zeilen an, und auf einer
     * langsamen Maschine dauert ein einzelner Fall laenger als das. Sie
     * scheiterten dann als Zeitueberschreitung — was wie ein echter Fehler
     * aussieht und keiner ist. Dreissig Sekunden trennen das eine vom anderen:
     * was so lange braucht, haengt wirklich.
     */
    testTimeout: 30_000,
  },
});
