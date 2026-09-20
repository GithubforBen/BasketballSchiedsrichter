import { and, asc, eq, gt, gte, inArray, lte, ne } from 'drizzle-orm';
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
  /*
   * Erst nur die Anpfiffe, eine einzige Spalte.
   *
   * Daraus ergeben sich zwei Dinge, die vor dem eigentlichen Laden feststehen
   * muessen: welche Tage es gibt und wie viele es insgesamt sind ("noch N
   * weitere"). Beides braucht jede kuenftige Zeile, aber von keiner mehr als
   * den Zeitstempel — vorher holte diese Funktion dafuer jede Spalte jedes
   * Spiels, um am Ende die Haelfte wegzuwerfen.
   */
  const kickoffs = await db
    .select({ kickoff: schema.games.kickoff })
    .from(schema.games)
    .where(and(gte(schema.games.kickoff, now), ne(schema.games.state, 'cancelled')))
    .orderBy(asc(schema.games.kickoff));

  if (kickoffs.length === 0) return { matchdays: [], total: 0 };

  /*
   * Die Tage in der Reihenfolge des Anpfiffs. Die Liste ist bereits sortiert,
   * ein Set haelt die Einfuegereihenfolge — damit steht der naechste Spieltag
   * vorn.
   */
  const days = [...new Set(kickoffs.map((row) => calendarDay(row.kickoff, CLUB.timeZone)))];
  const shown = limit === undefined ? days : days.slice(0, Math.max(1, limit));
  const wanted = new Set(shown);

  /*
   * Jetzt die vollstaendigen Zeilen — und nur bis zum letzten Anpfiff, der noch
   * auf die Seite kommt. Weil `shown` ein Anfangsstueck der nach Anpfiff
   * sortierten Tage ist, liegt alles Spaetere zwangslaeufig auf einem Tag, den
   * niemand angefordert hat. Die Grenze steht damit in der Abfrage und nicht
   * erst im Speicher.
   */
  const lastKickoff = kickoffs
    .filter((row) => wanted.has(calendarDay(row.kickoff, CLUB.timeZone)))
    .at(-1)?.kickoff;
  if (!lastKickoff) return { matchdays: [], total: days.length };

  const rows = await db
    .select()
    .from(schema.games)
    .where(
      and(
        gte(schema.games.kickoff, now),
        lte(schema.games.kickoff, lastKickoff),
        ne(schema.games.state, 'cancelled'),
      ),
    )
    .orderBy(asc(schema.games.kickoff));

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

/**
 * Spiele, fuer die gerade eine Ersatz-Anfrage laeuft. Regel 8.
 *
 * Die Oberflaeche braucht das, um den Knopf zu sperren, solange jemand noch
 * antworten kann — sonst gingen zwei Anfragen an denselben Ersatz, und beide
 * koennten angenommen werden.
 */
export const gamesWithPendingRequest = async (now: Date): Promise<ReadonlySet<string>> => {
  const rows = await db
    .select({ gameId: schema.promotionOffers.gameId })
    .from(schema.promotionOffers)
    .where(
      and(eq(schema.promotionOffers.outcome, 'pending'), gt(schema.promotionOffers.respondBy, now)),
    );
  return new Set(rows.map((row) => row.gameId));
};
