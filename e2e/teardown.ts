import { closeDb } from './db';

/**
 * Schliesst die Datenbankverbindung am Ende des gesamten Laufs.
 *
 * Die Verbindung liegt im Modul und wird von allen Testdateien geteilt. Wuerde
 * eine Datei sie in ihrem eigenen `afterAll` schliessen, liefe die naechste
 * Datei in eine geschlossene Verbindung — der Fehler traete dann je nach
 * Reihenfolge auf und saehe aus wie ein Zufall.
 */
const globalTeardown = async (): Promise<void> => {
  await closeDb();
};

export default globalTeardown;
