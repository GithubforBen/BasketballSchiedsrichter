import { gameStatus, type StatusView } from './status';
import { buildSlots, occupiedSlots } from './slots';
import { calendarDay } from './time';
import { SLOT_COUNT, type Assignment, type Game, type Slot } from './types';

/**
 * Gruppierung nach Spieltagen.
 *
 * Die Uebersichten trennen ueberall nach Spieltagen — oeffentlich, im
 * Schiedsrichter-Bereich und im Adminbereich. Die Einteilung gehoert deshalb
 * hierher und nicht in eine einzelne Seite.
 */

export interface GameWithSlots {
  game: Game;
  slots: readonly Slot[];
}

export interface Matchday {
  /** Kalendertag in der Vereinszeitzone, `YYYY-MM-DD`. Stabiler Schluessel. */
  key: string;
  /** "Sa 22.08.2026" — wie im Mockup. */
  label: string;
  /** "2 Spiele · 3/8 Plätze besetzt". */
  summary: string;
  games: readonly GameWithSlots[];
  /** Anpfiff des ersten Spiels — fuer Sortierung und Vorlauf-Angaben. */
  firstKickoff: Date;
}

export const withSlots = (game: Game, assignments: readonly Assignment[]): GameWithSlots => ({
  game,
  slots: buildSlots(assignments.filter((a) => a.gameId === game.id)),
});

/**
 * Fasst Spiele zu Spieltagen zusammen, aufsteigend nach Anpfiff.
 * Spiele innerhalb eines Tages stehen ebenfalls in Anpfiff-Reihenfolge.
 */
export const groupByMatchday = (
  entries: readonly GameWithSlots[],
  timeZone: string,
): readonly Matchday[] => {
  const buckets = new Map<string, GameWithSlots[]>();
  for (const entry of entries) {
    const key = calendarDay(entry.game.kickoff, timeZone);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(entry);
    else buckets.set(key, [entry]);
  }

  return [...buckets.entries()]
    .map(([key, games]) => {
      const sorted = [...games].sort(
        (a, b) => a.game.kickoff.getTime() - b.game.kickoff.getTime(),
      );
      const first = sorted[0];
      if (!first) throw new Error(`Spieltag ${key} ohne Spiele`);
      const filled = sorted.reduce((sum, g) => sum + occupiedSlots(g.slots).length, 0);
      const capacity = sorted.length * SLOT_COUNT;
      return {
        key,
        label: matchdayLabel(first.game.kickoff, timeZone),
        summary: `${sorted.length} ${sorted.length === 1 ? 'Spiel' : 'Spiele'} · ${filled}/${capacity} Plätze besetzt`,
        games: sorted,
        firstKickoff: first.game.kickoff,
      };
    })
    .sort((a, b) => a.firstKickoff.getTime() - b.firstKickoff.getTime());
};

/**
 * "Sa 22.08.2026" — Wochentag und Datum, wie im Mockup.
 *
 * Bewusst aus zwei Formatierungen zusammengesetzt: `weekday: 'short'` liefert
 * im Deutschen "Sa." mit Punkt, und ein kombiniertes Format haengt zusaetzlich
 * ein Komma dazwischen. Beides wegzuschneiden waere fragiler als es gleich
 * richtig zusammenzusetzen.
 */
export const matchdayLabel = (kickoff: Date, timeZone: string): string => {
  const weekday = new Intl.DateTimeFormat('de-DE', { timeZone, weekday: 'short' })
    .format(kickoff)
    .replace(/\.$/, '');
  return `${weekday} ${dateLabel(kickoff, timeZone)}`;
};

/** "10:30" */
export const timeLabel = (kickoff: Date, timeZone: string): string =>
  new Intl.DateTimeFormat('de-DE', { timeZone, hour: '2-digit', minute: '2-digit' }).format(
    kickoff,
  );

/** "22.08.2026" — kompakt fuer Tabellenspalten. */
export const dateLabel = (kickoff: Date, timeZone: string): string =>
  new Intl.DateTimeFormat('de-DE', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(kickoff);

export const matchTitle = (game: Game): string => `${game.home} — ${game.away}`;

export const statusOf = (entry: GameWithSlots): StatusView => gameStatus(entry.slots);
