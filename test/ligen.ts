import type postgres from 'postgres';
import { INITIAL_LEAGUES } from '@/config/club';

/**
 * Legt die Ligen an, auf die die Integrationstests bauen.
 *
 * Jede dieser Suiten traegt Qualifikationen und Spiele ein, und beide haengen
 * per Fremdschluessel an `leagues`. Die Ligen kamen bisher aus `db:seed` — in
 * der CI laeuft der Seed aber **nach** den Tests, und die Migration allein legt
 * eine leere Tabelle an. Jede Suite scheiterte deshalb schon in ihrer
 * Vorbereitung an
 *
 *     insert or update on table "qualifications" violates foreign key
 *     constraint "qualifications_league_id_leagues_id_fk"
 *
 * und alles dahinter lief nie. Auf einem Entwicklungsrechner faellt das nicht
 * auf, weil dort einmal geseedet wurde und die Ligen seitdem stehen.
 *
 * Die Suite sorgt jetzt selbst fuer ihre Voraussetzung, statt sich auf einen
 * frueheren Lauf zu verlassen. `ON CONFLICT DO NOTHING`, damit sie neben einer
 * geseedeten Datenbank genauso funktioniert; geloescht wird nichts — die Ligen
 * gehoeren keiner Suite allein.
 */
export const ensureLeagues = async (
  sql: ReturnType<typeof postgres>,
  extra: readonly string[] = [],
): Promise<void> => {
  for (const [index, id] of [...INITIAL_LEAGUES, ...extra].entries()) {
    await sql`INSERT INTO leagues (id, name, active, sort_order)
              VALUES (${id}, ${id}, true, ${index})
              ON CONFLICT (id) DO NOTHING`;
  }
};
