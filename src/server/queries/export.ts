import { and, asc, gte, inArray, ne } from 'drizzle-orm';
import { db, schema } from '@/db';
import { withSlots, type GameWithSlots } from '@/domain/schedule';
import { initialsById, toAssignment, toGame } from './games';

/**
 * Die Zeilen fuer den CSV-Export.
 *
 * Getrennt von `upcomingMatchdays`, obwohl beide Spiele mit Besetzung laden:
 * die Uebersicht schneidet nach Spieltagen und gruppiert, der Export will eine
 * flache, durchgehend nach Anpfiff sortierte Liste und wahlweise auch die
 * Vergangenheit. Eine gemeinsame Funktion mit zwei Schaltern waere an beiden
 * Stellen schwerer zu lesen als zwei kurze.
 */

/** Welche Spiele in die Datei kommen. */
export type ExportScope = 'kommende' | 'alle';

export const isExportScope = (value: string | undefined): value is ExportScope =>
  value === 'kommende' || value === 'alle';

export interface GameExport {
  entries: readonly GameWithSlots[];
  /**
   * Kuerzel je Schiedsrichter-Id.
   *
   * Kuerzel und nicht Namen: das Kuerzel steht im oeffentlichen Spielplan
   * ohnehin an jedem Spiel, die Datei verraet damit nichts, was nicht schon
   * jeder sehen kann. Regel 29.
   */
  initials: ReadonlyMap<string, string>;
}

/**
 * Spiele mit ihrer Besetzung, nach Anpfiff sortiert.
 *
 * Abgesagte Spiele bleiben draussen. Die Spalten der Datei sagen nichts ueber
 * den Zustand eines Spiels — eine abgesagte Begegnung saehe darin aus wie eine
 * angesetzte, und wer die Datei weiterreicht, schickte damit Leute in eine
 * Halle, in der nicht gespielt wird.
 */
export const gamesForExport = async (scope: ExportScope, now: Date): Promise<GameExport> => {
  const notCancelled = ne(schema.games.state, 'cancelled');
  const rows = await db
    .select()
    .from(schema.games)
    .where(scope === 'alle' ? notCancelled : and(gte(schema.games.kickoff, now), notCancelled))
    .orderBy(asc(schema.games.kickoff));

  if (rows.length === 0) return { entries: [], initials: new Map() };

  const assignmentRows = await db
    .select()
    .from(schema.assignments)
    .where(inArray(schema.assignments.gameId, rows.map((row) => row.id)));
  const assignments = assignmentRows.map(toAssignment);

  return {
    entries: rows.map((row) => withSlots(toGame(row), assignments)),
    initials: await initialsById(),
  };
};
