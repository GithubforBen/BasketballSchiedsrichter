import { asc, eq } from 'drizzle-orm';
import { CLUB } from '@/config/club';
import { db, schema } from '@/db';
import { confirmationState, type ConfirmationState } from '@/domain/confirmation';
import { withSlots, type GameWithSlots } from '@/domain/schedule';
import { slotKind, SLOT_LABELS } from '@/domain/slots';
import { buildRanking, countsAsRefereed, type RankingRow } from '@/domain/stats';
import type { ClubSettings, Game, SlotIndex } from '@/domain/types';
import { toAssignment, toGame } from './games';

/**
 * Die Daten der Schiedsrichter-Bildschirme.
 *
 * Alles, was eine Person ueber ihre eigenen Einsaetze sieht: kommende Spiele,
 * Verlauf, Monatszahlen und die eigene Position im Ranking.
 */

export interface MyGame {
  game: Game;
  slotIndex: SlotIndex;
  role: string;
  confirmation: ConfirmationState;
  countsForStats: boolean;
}

const myAssignments = async (refereeId: string) =>
  db
    .select({ assignment: schema.assignments, game: schema.games })
    .from(schema.assignments)
    .innerJoin(schema.games, eq(schema.games.id, schema.assignments.gameId))
    .where(eq(schema.assignments.refereeId, refereeId))
    .orderBy(asc(schema.games.kickoff));

/** Kommende und vergangene Einsaetze, getrennt am Anpfiff. */
export const myGames = async (
  refereeId: string,
  settings: ClubSettings,
  now: Date,
): Promise<{ upcoming: readonly MyGame[]; past: readonly MyGame[] }> => {
  const rows = await myAssignments(refereeId);

  const mapped: MyGame[] = rows.map((row) => {
    const game = toGame(row.game);
    const assignment = toAssignment(row.assignment);
    const slotIndex = assignment.slotIndex;
    const slot = { index: slotIndex, kind: slotKind(slotIndex), assignment };
    return {
      game,
      slotIndex,
      role: SLOT_LABELS[slotIndex],
      confirmation: confirmationState(slot, game, settings, now),
      countsForStats: countsAsRefereed(slotIndex, assignment),
    };
  });

  return {
    upcoming: mapped.filter((e) => e.game.kickoff > now && e.game.state !== 'cancelled'),
    past: mapped.filter((e) => e.game.kickoff <= now).reverse(),
  };
};

export interface MonthCount {
  /** "Aug" — Kurzform in Ortszeit. */
  label: string;
  /** "2026-08" — stabiler Schluessel. */
  key: string;
  count: number;
}

/**
 * Einsaetze der letzten Monate. Gezaehlt werden nur tatsaechliche Einsaetze
 * als Schiedsrichter (Regeln 25-27), und nur bereits angepfiffene Spiele.
 */
export const monthlyCounts = async (
  refereeId: string,
  now: Date,
  monthCount = 6,
): Promise<readonly MonthCount[]> => {
  const rows = await myAssignments(refereeId);

  const counted = new Map<string, number>();
  for (const row of rows) {
    const game = toGame(row.game);
    if (game.kickoff > now || game.state === 'cancelled') continue;
    if (!countsAsRefereed(row.assignment.slotIndex as SlotIndex, toAssignment(row.assignment))) {
      continue;
    }
    const key = monthKey(game.kickoff);
    counted.set(key, (counted.get(key) ?? 0) + 1);
  }

  return recentMonths(now, monthCount).map((month) => ({
    ...month,
    count: counted.get(month.key) ?? 0,
  }));
};

const monthKey = (date: Date): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: CLUB.timeZone,
    year: 'numeric',
    month: '2-digit',
  }).format(date);

const recentMonths = (now: Date, count: number): { key: string; label: string }[] => {
  const months: { key: string; label: string }[] = [];
  for (let back = count - 1; back >= 0; back -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 15));
    months.push({
      key: monthKey(date),
      label: new Intl.DateTimeFormat('de-DE', { timeZone: CLUB.timeZone, month: 'short' })
        .format(date)
        .replace(/\.$/, ''),
    });
  }
  return months;
};

/**
 * Das Ranking der Saison. Regel 28: nur die eigene Zeile traegt Name und Zahl,
 * alle anderen bleiben anonym.
 */
export const seasonRanking = async (
  meId: string,
  now: Date,
): Promise<readonly RankingRow[]> => {
  const rows = await db
    .select({ assignment: schema.assignments, game: schema.games, referee: schema.referees })
    .from(schema.assignments)
    .innerJoin(schema.games, eq(schema.games.id, schema.assignments.gameId))
    .innerJoin(schema.referees, eq(schema.referees.id, schema.assignments.refereeId));

  const counts = new Map<string, { name: string; count: number }>();
  for (const row of rows) {
    if (!row.referee.active) continue;
    const entry = counts.get(row.referee.id) ?? { name: row.referee.name, count: 0 };
    const game = toGame(row.game);
    const counted =
      game.kickoff <= now &&
      game.state !== 'cancelled' &&
      countsAsRefereed(row.assignment.slotIndex as SlotIndex, toAssignment(row.assignment));
    counts.set(row.referee.id, { name: entry.name, count: entry.count + (counted ? 1 : 0) });
  }

  // Auch wer noch nie gepfiffen hat, gehoert ins Ranking — sonst waere die
  // eigene Position auf dem letzten Platz nicht ablesbar.
  const allReferees = await db
    .select({ id: schema.referees.id, name: schema.referees.name, active: schema.referees.active })
    .from(schema.referees);
  for (const referee of allReferees) {
    if (!referee.active) continue;
    if (!counts.has(referee.id)) counts.set(referee.id, { name: referee.name, count: 0 });
  }

  return buildRanking(
    [...counts.entries()].map(([refereeId, value]) => ({ refereeId, ...value })),
    meId,
  );
};

/** Kommende Spiele als Spieltage, samt Belegung — fuer „Offene Spiele“. */
export const upcomingGamesWithSlots = async (now: Date): Promise<readonly GameWithSlots[]> => {
  const rows = await db
    .select()
    .from(schema.games)
    .orderBy(asc(schema.games.kickoff));
  const assignments = (await db.select().from(schema.assignments)).map(toAssignment);

  return rows
    .filter((row) => row.kickoff > now && row.state !== 'cancelled')
    .map((row) => withSlots(toGame(row), assignments));
};

export interface PendingRelocation {
  game: Game;
  slotIndex: SlotIndex;
  role: string;
  previousLabel: string;
}

/**
 * Verschiebungen, auf die diese Person noch nicht geantwortet hat. Regel 17.
 *
 * Sie stehen ganz oben und unabhaengig vom gewaehlten Spieltag: eine offene
 * Rueckfrage zu einem verschobenen Spiel ist dringender als das Blaettern
 * durch die Spieltage.
 */
export const pendingRelocations = async (
  refereeId: string,
  now: Date,
): Promise<readonly PendingRelocation[]> => {
  const rows = await db
    .select({ assignment: schema.assignments, game: schema.games })
    .from(schema.assignments)
    .innerJoin(schema.games, eq(schema.games.id, schema.assignments.gameId))
    .where(eq(schema.assignments.refereeId, refereeId))
    .orderBy(asc(schema.games.kickoff));

  return rows
    .filter(
      (row) =>
        row.game.state === 'moved' &&
        row.game.kickoff > now &&
        row.game.relocationVersion > row.assignment.acknowledgedRelocation,
    )
    .map((row) => ({
      game: toGame(row.game),
      slotIndex: row.assignment.slotIndex as SlotIndex,
      role: SLOT_LABELS[row.assignment.slotIndex as SlotIndex],
      previousLabel: 'Der Termin hat sich geändert.',
    }));
};
