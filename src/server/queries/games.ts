import { and, asc, gte, ne } from 'drizzle-orm';
import { CLUB } from '@/config/club';
import { db, schema } from '@/db';
import { groupByMatchday, withSlots, type Matchday } from '@/domain/schedule';
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
  home: row.home,
  away: row.away,
  venue: row.venue,
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

/**
 * Alle kommenden Spiele als Spieltage.
 * Abgesagte Spiele bleiben draussen — sie stehen niemandem zur Verfuegung.
 */
export const upcomingMatchdays = async (now: Date): Promise<readonly Matchday[]> => {
  const rows = await db
    .select()
    .from(schema.games)
    .where(and(gte(schema.games.kickoff, now), ne(schema.games.state, 'cancelled')))
    .orderBy(asc(schema.games.kickoff));

  if (rows.length === 0) return [];

  const assignmentRows = await db.select().from(schema.assignments);
  const assignments = assignmentRows.map(toAssignment);

  return groupByMatchday(
    rows.map((row) => withSlots(toGame(row), assignments)),
    CLUB.timeZone,
  );
};

/** Kuerzel aller Personen, nach Id. Mehr braucht die oeffentliche Ansicht nicht. */
export const initialsById = async (): Promise<ReadonlyMap<string, string>> => {
  const rows = await db
    .select({ id: schema.referees.id, initials: schema.referees.initials })
    .from(schema.referees);
  return new Map(rows.map((row) => [row.id, row.initials]));
};
