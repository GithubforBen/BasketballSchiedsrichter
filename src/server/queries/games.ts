import { and, asc, gte, inArray, ne } from 'drizzle-orm';
import { CLUB } from '@/config/club';
import { db, schema } from '@/db';
import { groupByMatchday, withSlots, type Matchday } from '@/domain/schedule';
import { calendarDay } from '@/domain/time';
import type { Assignment, Game, SlotIndex } from '@/domain/types';

/**
 * Lesezugriffe auf Spiele.
 *
 * Die Umrechnung von Datenbankzeilen in die fachlichen Typen passiert hier und
 * nur hier — die Regel-Engine soll nie eine Datenbankzeile sehen.
 */

type GameRow = typeof schema.games.$inferSelect;
type AssignmentRow = typeof schema.assignments.$inferSelect;

export const toGame = (row: GameRow): Game => ({
  id: row.id,
  kickoff: row.kickoff,
  leagueId: row.leagueId,
  leagueLabel: row.leagueLabel,
  home: row.home,
  away: row.away,
  venue: row.venue,
  requiredLicense: row.requiredLicense,
  state: row.state,
  vacancyVersion: row.vacancyVersion,
  overrides: {
    withdraw: row.overrideWithdraw,
    substituteRequest: row.overrideSubstituteRequest,
    oneGamePerDay: row.overrideOneGamePerDay,
  },
});

export const toAssignment = (row: AssignmentRow): Assignment => ({
  gameId: row.gameId,
  slotIndex: row.slotIndex as SlotIndex,
  refereeId: row.refereeId,
  claimedAt: row.claimedAt,
  confirmedAt: row.confirmedAt,
  playedAsReferee: row.playedAsReferee,
});

export interface UpcomingPage {
  matchdays: readonly Matchday[];
  /** Wie viele Spieltage es insgesamt gibt — fuer "noch N weitere". */
  total: number;
}

/**
 * Die naechsten Spieltage.
 *
 * Abgesagte Spiele bleiben draussen — sie stehen niemandem zur Verfuegung.
 *
 * `limit` zaehlt **Spieltage**, nicht Spiele: die Seite ist nach Tagen
 * gegliedert, und ein halber Spieltag waere eine seltsame Grenze. Ohne `limit`
 * kommt alles.
 *
 * Geschnitten wird vor dem Laden der Eintragungen, nicht danach. Vorher holte
 * diese Funktion die Eintragungen *aller* Spiele der Datenbank, um daraus die
 * paar zu verwenden, die auf die Seite kamen.
 */
export const upcomingMatchdays = async (now: Date, limit?: number): Promise<UpcomingPage> => {
  const rows = await db
    .select()
    .from(schema.games)
    .where(and(gte(schema.games.kickoff, now), ne(schema.games.state, 'cancelled')))
    .orderBy(asc(schema.games.kickoff));

  if (rows.length === 0) return { matchdays: [], total: 0 };

  /*
   * Die Tage in der Reihenfolge des Anpfiffs. `rows` ist bereits sortiert, ein
   * Set haelt die Einfuegereihenfolge — damit steht der naechste Spieltag vorn.
   */
  const days = [...new Set(rows.map((row) => calendarDay(row.kickoff, CLUB.timeZone)))];
  const shown = limit === undefined ? days : days.slice(0, Math.max(1, limit));
  const wanted = new Set(shown);
  const games = rows.filter((row) => wanted.has(calendarDay(row.kickoff, CLUB.timeZone)));

  const assignmentRows = await db
    .select()
    .from(schema.assignments)
    .where(inArray(schema.assignments.gameId, games.map((row) => row.id)));
  const assignments = assignmentRows.map(toAssignment);

  return {
    matchdays: groupByMatchday(
      games.map((row) => withSlots(toGame(row), assignments)),
      CLUB.timeZone,
    ),
    total: days.length,
  };
};

/** Kuerzel aller Personen, nach Id. Mehr braucht die oeffentliche Ansicht nicht. */
export const initialsById = async (): Promise<ReadonlyMap<string, string>> => {
  const rows = await db
    .select({ id: schema.referees.id, initials: schema.referees.initials })
    .from(schema.referees);
  return new Map(rows.map((row) => [row.id, row.initials]));
};
