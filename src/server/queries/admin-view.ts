import { asc, eq } from 'drizzle-orm';
import { CLUB } from '@/config/club';
import { db, schema } from '@/db';
import { DEFAULT_ALERT_SETTINGS, buildAdminAlerts, type AdminAlert } from '@/domain/alerts';
import {
  CONFIRMATION_LABELS,
  confirmationState,
  openConfirmations,
} from '@/domain/confirmation';
import { groupByMatchday, withSlots, type Matchday } from '@/domain/schedule';
import {
  refereeSlots,
  slotKind,
  substituteSlots,
  SLOT_LABELS,
  SLOT_LABELS_SHORT,
} from '@/domain/slots';
import type { ClubSettings, Game, Referee, SlotIndex } from '@/domain/types';
import { toAssignment, toGame } from './games';
import { loadAllReferees } from './referees';

/**
 * Die Daten des Adminbereichs: Uebersicht, Meldungen, Besetzung und die Liste
 * der nachzupflegenden Einsaetze.
 */

export interface Kpis {
  planned: number;
  filled: number;
  substituteMissing: number;
  open: number;
}

const allGames = async () =>
  db.select().from(schema.games).orderBy(asc(schema.games.kickoff));

export const adminOverview = async (
  settings: ClubSettings,
  now: Date,
): Promise<{
  matchdays: readonly Matchday[];
  kpis: Kpis;
  alerts: readonly AdminAlert[];
  referees: readonly Referee[];
}> => {
  const [rows, assignmentRows, referees] = await Promise.all([
    allGames(),
    db.select().from(schema.assignments),
    loadAllReferees(),
  ]);

  const assignments = assignmentRows.map(toAssignment);
  const upcoming = rows
    .filter((row) => row.kickoff > now && row.state !== 'cancelled')
    .map((row) => withSlots(toGame(row), assignments));

  const kpis = upcoming.reduce<Kpis>(
    (totals, entry) => {
      const refs = refereeSlots(entry.slots).filter((slot) => slot.assignment !== null).length;
      const subs = substituteSlots(entry.slots).filter((slot) => slot.assignment !== null).length;
      return {
        planned: totals.planned + 1,
        filled: totals.filled + (refs === 2 && subs === 2 ? 1 : 0),
        substituteMissing: totals.substituteMissing + (refs === 2 && subs < 2 ? 1 : 0),
        open: totals.open + (refs < 2 ? 1 : 0),
      };
    },
    { planned: 0, filled: 0, substituteMissing: 0, open: 0 },
  );

  return {
    matchdays: groupByMatchday(upcoming, CLUB.timeZone),
    kpis,
    /*
     * Der Bildschirm zeigt **alles**, was Aufmerksamkeit braucht — unabhaengig
     * davon, welche Nachrichten der Verein bestellt hat.
     *
     * Frueher standen hier die gespeicherten Schalter. Das las sich sinnvoll
     * ("wer die Meldung nicht will, sieht sie nicht") und war der schlimmste
     * Fehler dieser Seite: wer den Hinweis auf unbesetzte Spiele abschaltete,
     * um nicht bei jedem Loch eine WhatsApp zu bekommen, schaltete damit auch
     * die Liste ab, in der diese Loecher stehen. Auf dem Bildschirm stand dann
     * "Nichts zu tun: alle kommenden Spiele sind besetzt und bestaetigt",
     * waehrend 38 Spiele ohne einen einzigen Schiedsrichter dastanden.
     *
     * Ein Schalter fuer Nachrichten darf nicht heimlich die Buchfuehrung
     * abschalten. Die Schalter gelten deshalb nur noch dort, wo sie
     * hingehoeren: im Zeitplan-Lauf, der die Nachrichten verschickt.
     */
    alerts: buildAdminAlerts(upcoming, referees, settings, DEFAULT_ALERT_SETTINGS, now),
    referees,
  };
};

export interface AdminGameRow {
  game: Game;
  relocationVersion: number;
  /** Namen der eingetragenen Schiedsrichter, in Platzreihenfolge. */
  refereeNames: readonly string[];
  substituteNames: readonly string[];
  /** "bestätigt", "1 offen" oder "—". */
  confirmationLabel: string;
  confirmationColor: string;
}

/** Ein einzelnes Spiel mit allem, was der Bearbeiten-Bildschirm braucht. */
export const adminGame = async (
  gameId: string,
  settings: ClubSettings,
  now: Date,
): Promise<{
  game: Game;
  relocationVersion: number;
  slots: readonly {
    index: SlotIndex;
    role: string;
    refereeId: string | null;
    name: string;
    state: string;
    stateColor: string;
  }[];
} | null> => {
  const rows = await db.select().from(schema.games).where(eq(schema.games.id, gameId)).limit(1);
  const row = rows[0];
  if (!row) return null;

  const game = toGame(row);
  const assignmentRows = await db
    .select()
    .from(schema.assignments)
    .where(eq(schema.assignments.gameId, gameId));
  const entry = withSlots(game, assignmentRows.map(toAssignment));

  const referees = await loadAllReferees();
  const nameOf = new Map(referees.map((referee) => [referee.id, referee.name]));

  return {
    game,
    relocationVersion: row.relocationVersion,
    slots: entry.slots.map((slot) => {
      const refereeId = slot.assignment?.refereeId ?? null;
      const isReferee = slotKind(slot.index) === 'referee';
      const state = confirmationState(slot, game, settings, now);
      return {
        index: slot.index,
        /* Die Spalte daneben ist schmal — dort passt nur die kurze Form. */
        role: SLOT_LABELS_SHORT[slot.index],
        refereeId,
        name: refereeId ? (nameOf.get(refereeId) ?? '—') : 'frei',
        /*
         * Der Text kommt aus derselben Tabelle wie ueberall sonst. Vorher stand
         * hier eine eigene Kette, die "scheduled" mit "pending" in einen Topf
         * warf: eine Nachfrage, die noch gar nicht raus ist, stand damit als
         * "Bestätigung offen" da — als haette jemand nicht geantwortet.
         */
        state: refereeId ? (isReferee ? CONFIRMATION_LABELS[state] : 'Ersatz') : 'offen',
        /* Schriftvarianten der Ampel — die vollen Toene sind als Text zu blass. */
        stateColor: refereeId
          ? isReferee
            ? state === 'confirmed'
              ? 'var(--status-filled-text)'
              : state === 'overdue'
                ? 'var(--status-open-text)'
                : state === 'pending'
                  ? 'var(--status-substitute-missing-text)'
                  : 'var(--text-dim)'
            : 'var(--text-dim)'
          : 'var(--status-open-text)',
      };
    }),
  };
};

/** Die Zeilen der Uebersichtstabelle. */
export const adminRows = async (
  matchday: Matchday,
  settings: ClubSettings,
  now: Date,
): Promise<readonly AdminGameRow[]> => {
  const referees = await loadAllReferees();
  const nameOf = new Map(referees.map((referee) => [referee.id, referee.name]));

  return matchday.games.map((entry) => {
    const names = (slots: ReturnType<typeof refereeSlots>) =>
      slots.flatMap((slot) =>
        slot.assignment ? [nameOf.get(slot.assignment.refereeId) ?? '—'] : [],
      );
    const refs = names(refereeSlots(entry.slots));
    const open = openConfirmations(entry.slots, entry.game, settings, now).length;
    /*
     * Solange die Nachfrage noch nicht raus ist, steht der Platz auf
     * "scheduled" und zaehlt damit nicht als offen. Das hier trotzdem gruen
     * als "bestaetigt" auszuweisen, waere die gefaehrlichste Auskunft der
     * Uebersicht: der Admin sieht eine Zusage, die niemand gegeben hat.
     */
    const awaiting = entry.slots.filter(
      (slot) => confirmationState(slot, entry.game, settings, now) === 'scheduled',
    ).length;

    return {
      game: entry.game,
      relocationVersion: 0,
      refereeNames: refs,
      substituteNames: names(substituteSlots(entry.slots)),
      confirmationLabel:
        refs.length === 0
          ? '—'
          : open > 0
            ? `${open} offen`
            : awaiting > 0
              ? 'Bestätigung folgt'
              : 'bestätigt',
      confirmationColor:
        refs.length === 0 || (open === 0 && awaiting > 0)
          ? 'var(--text-dim)'
          : open === 0
            ? 'var(--status-filled)'
            : 'var(--status-substitute-missing)',
    };
  });
};

export interface PendingAppearance {
  game: Game;
  slotIndex: SlotIndex;
  role: string;
  refereeName: string;
}

/**
 * Ersatzleute, deren Spiel vorbei ist und bei denen noch niemand entschieden
 * hat, ob sie im Einsatz waren. Regel 27.
 */
export const pendingAppearances = async (now: Date): Promise<readonly PendingAppearance[]> => {
  const rows = await db
    .select({ assignment: schema.assignments, game: schema.games, referee: schema.referees })
    .from(schema.assignments)
    .innerJoin(schema.games, eq(schema.games.id, schema.assignments.gameId))
    .innerJoin(schema.referees, eq(schema.referees.id, schema.assignments.refereeId))
    .orderBy(asc(schema.games.kickoff));

  return rows
    .filter(
      (row) =>
        row.game.kickoff <= now &&
        row.game.state !== 'cancelled' &&
        row.assignment.slotIndex >= 2 &&
        row.assignment.playedAsReferee === null,
    )
    .map((row) => ({
      game: toGame(row.game),
      slotIndex: row.assignment.slotIndex as SlotIndex,
      role: SLOT_LABELS[row.assignment.slotIndex as SlotIndex],
      refereeName: row.referee.name,
    }));
};

export { loadLeagues } from './leagues';
