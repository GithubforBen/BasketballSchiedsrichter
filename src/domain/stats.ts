import { slotKind } from './slots';
import { hasPassed } from './time';
import type { Assignment, SlotIndex } from './types';

/**
 * Einsatzzaehlung und Ranking. Regeln 25-28.
 *
 * Die Zahl ist abrechnungsrelevant — der Verein bezahlt pro gepfiffenem Spiel.
 * Deshalb zaehlt nicht die Eintragung, sondern der tatsaechliche Einsatz.
 */

/**
 * Regeln 25-27: Zaehlt dieser Eintrag als gepfiffenes Spiel?
 *
 * Ohne ausdrueckliche Angabe entscheidet der Platz: wer am Ende auf einem
 * Schiedsrichter-Platz steht, hat gepfiffen — auch wer dorthin nachgerueckt ist.
 * Ein Ersatz, der nie zum Einsatz kam, zaehlt nicht. Setzt der Admin
 * `playedAsReferee` ausdruecklich, gilt seine Korrektur.
 */
export const countsAsRefereed = (slotIndex: SlotIndex, assignment: Assignment): boolean =>
  assignment.playedAsReferee ?? slotKind(slotIndex) === 'referee';

export interface CountableEntry {
  slotIndex: SlotIndex;
  assignment: Assignment;
  kickoff: Date;
}

/** Nur angepfiffene Spiele zaehlen — kommende Eintragungen sind noch keine Einsaetze. */
export const countRefereedGames = (entries: readonly CountableEntry[], now: Date): number =>
  entries.filter((e) => hasPassed(e.kickoff, now) && countsAsRefereed(e.slotIndex, e.assignment))
    .length;

/**
 * Eintraege, bei denen der Admin nachpflegen muss: ein Ersatz, dessen Spiel
 * vorbei ist und bei dem noch niemand entschieden hat, ob er im Einsatz war.
 */
export const needsPlayedDecision = (
  entries: readonly CountableEntry[],
  now: Date,
): readonly CountableEntry[] =>
  entries.filter(
    (e) =>
      hasPassed(e.kickoff, now) &&
      slotKind(e.slotIndex) === 'substitute' &&
      e.assignment.playedAsReferee === null,
  );

export interface RankingInput {
  refereeId: string;
  name: string;
  count: number;
}

export interface RankingRow {
  rank: number;
  /** Nur die eigene Zeile traegt einen Namen. Alle anderen bleiben anonym. Regel 28. */
  label: string;
  /** Nur die eigene Zeile zeigt eine Zahl. */
  count: number | null;
  isMe: boolean;
}

/**
 * Regel 28: Das Ranking zeigt die eigene Position mit Zahl, alle anderen
 * erscheinen als "anonym" ohne Zahl. Die Reihenfolge bleibt sichtbar, damit
 * man den eigenen Platz einordnen kann.
 */
export const buildRanking = (
  entries: readonly RankingInput[],
  meId: string,
): readonly RankingRow[] =>
  [...entries]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'de'))
    .map((entry, index) => {
      const isMe = entry.refereeId === meId;
      return {
        rank: index + 1,
        label: isMe ? 'Du' : 'anonym',
        count: isMe ? entry.count : null,
        isMe,
      };
    });

export const ownRank = (rows: readonly RankingRow[]): RankingRow | null =>
  rows.find((r) => r.isMe) ?? null;
