import { and, asc, gte, inArray, ne } from 'drizzle-orm';
import { db, schema } from '@/db';
import { withSlots, type GameWithSlots } from '@/domain/schedule';
import { toAssignment, toGame } from './games';

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
  /** Voller Name je Schiedsrichter-Id — der Adminbereich zeigt Klarnamen. */
  names: ReadonlyMap<string, string>;
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

  if (rows.length === 0) return { entries: [], names: new Map() };

  const assignmentRows = await db
    .select()
    .from(schema.assignments)
    .where(inArray(schema.assignments.gameId, rows.map((row) => row.id)));
  const assignments = assignmentRows.map(toAssignment);

  /*
   * Nur die Namen, die auch vorkommen. Eine Mitgliederliste hat der Verein
   * woanders; hier wird ein Spielplan ausgegeben, und wer in keinem Spiel
   * steht, gehoert nicht in die Datei — auch nicht als Nebenwirkung.
   */
  const refereeIds = [...new Set(assignments.map((assignment) => assignment.refereeId))];
  const nameRows =
    refereeIds.length === 0
      ? []
      : await db
          .select({ id: schema.referees.id, name: schema.referees.name })
          .from(schema.referees)
          .where(inArray(schema.referees.id, refereeIds));

  return {
    entries: rows.map((row) => withSlots(toGame(row), assignments)),
    names: new Map(nameRows.map((row) => [row.id, row.name])),
  };
};
