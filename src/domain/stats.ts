import { slotKind } from './slots';
import { hasPassed } from './time';
import type { SlotIndex } from './types';

/**
 * Einsatzzaehlung und Ranking. Regeln 25-28.
 *
 * Die Zahl ist abrechnungsrelevant — der Verein bezahlt pro gepfiffenem Spiel.
 * Deshalb zaehlt nicht die Eintragung, sondern der tatsaechliche Einsatz.
 */

/**
 * Regeln 25-27: Zaehlt dieser Eintrag als gepfiffenes Spiel?
 *
 * Der Platz entscheidet, und zwar allein: wer zum Anpfiff auf Schiri 1 oder
 * Schiri 2 steht, hat gepfiffen — auch wer dorthin nachgerueckt ist. Ein
 * Ersatz, der auf der Bank blieb, zaehlt nicht.
 *
 * Frueher konnte der Admin das unter "Spiele nachpflegen" ueberstimmen. Der
 * Bildschirm ist weg, und zwar aus einem Grund: er verlangte nach *jedem*
 * vergangenen Spiel mit Ersatz eine Entscheidung, die fast immer "nein"
 * lautete, und bis sie getroffen war, stand die Abrechnungszahl auf
 * "ungeklaert". Die Besetzung zum Anpfiff ist die bessere Auskunft, weil sie
 * ohne Zutun stimmt. Stimmt sie ausnahmsweise nicht, aendert der Admin die
 * Besetzung des vergangenen Spiels — dort, wo sie steht.
 */
export const countsAsRefereed = (slotIndex: SlotIndex): boolean =>
  slotKind(slotIndex) === 'referee';

export interface CountableEntry {
  slotIndex: SlotIndex;
  kickoff: Date;
}

/** Nur angepfiffene Spiele zaehlen — kommende Eintragungen sind noch keine Einsaetze. */
export const countRefereedGames = (entries: readonly CountableEntry[], now: Date): number =>
  entries.filter((e) => hasPassed(e.kickoff, now) && countsAsRefereed(e.slotIndex)).length;

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
