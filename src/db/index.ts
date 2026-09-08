import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL fehlt. Siehe .env.example.');
}

/*
 * Die Adresse wird hier geprueft und nicht erst vom Treiber.
 *
 * Der Grund ist die Fehlermeldung, nicht die Pruefung selbst: `postgres()` legt
 * die Adresse beim Laden des Moduls an, und `next build` laedt dieses Modul,
 * um die Seitendaten einzusammeln. Eine unbrauchbare Adresse brach den Build
 * deshalb mit einem nackten `TypeError: Invalid URL` ab — aus einer
 * minimierten Datei heraus, ohne ein Wort darueber, welche Variable gemeint
 * ist. Der haeufigste Fall ist ein Passwort mit "/" oder "@" darin: beide
 * beenden den Benutzerteil und zerlegen die Adresse.
 */
try {
  new URL(url);
} catch {
  throw new Error(
    'DATABASE_URL ist keine gültige Adresse. Häufigste Ursache: ein Passwort mit ' +
      '"/", "@" oder ":" darin — diese Zeichen zerlegen die Adresse. Entweder ein ' +
      'Passwort ohne Sonderzeichen wählen oder sie prozentkodieren.',
  );
}

/**
 * Eine Verbindung pro Prozess. Next.js laedt Module im Entwicklungsmodus neu,
 * deshalb haengt der Client am globalen Objekt, statt bei jedem Reload neue
 * Verbindungen zu oeffnen.
 */
const globalForDb = globalThis as unknown as { sql?: ReturnType<typeof postgres> };
const sql = globalForDb.sql ?? postgres(url, { max: 10 });
if (process.env.NODE_ENV !== 'production') globalForDb.sql = sql;

export const db = drizzle(sql, { schema });
export { schema, sql };
