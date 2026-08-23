/**
 * Umgebung fuer die Tests, gesetzt bevor irgendein Modul geladen wird.
 *
 * `src/db/index.ts` prueft DATABASE_URL beim Laden — ohne diese Vorbereitung
 * muessten Integrationstests ihre Module dynamisch nachladen, nur um die
 * Reihenfolge hinzubiegen.
 */
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
process.env.SESSION_SECRET ??= 'test-schluessel-nur-fuer-tests';
process.env.NOTIFICATION_CHANNEL ??= 'dev';
process.env.PUBLIC_BASE_URL ??= 'https://schiriplan.test';
