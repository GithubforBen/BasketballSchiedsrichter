import { occupiedSlots, SLOT_LABELS } from './slots';
import { describeLeadTime } from './time';
import type { Game, Slot, SlotIndex } from './types';

/**
 * Verschobene und abgesagte Spiele. Regeln 17-18.
 *
 * Beim Verschieben werden Schiedsrichter und Ersatz gleich behandelt: beide
 * bekommen den neuen Termin und beide duerfen absagen. Eine Absage oeffnet den
 * Platz sofort wieder und stoesst die Nachrueck-Kaskade an (siehe escalation.ts).
 */

export interface RelocationNotice {
  refereeId: string;
  slotIndex: SlotIndex;
  slotLabel: string;
  /** Regel 17: Ersatz erhaelt dieselbe Nachricht mit derselben Absage-Option. */
  canDecline: boolean;
  headline: string;
  detail: string;
}

export interface RelocationInput {
  /** Das Spiel mit dem bereits gesetzten neuen Termin. */
  game: Game;
  slots: readonly Slot[];
  previousKickoff: Date;
  previousVenue: string;
  now: Date;
}

/**
 * Wer beim Verschieben benachrichtigt wird und was in der Nachricht steht.
 * Freie Plaetze erzeugen keine Nachricht — es gibt niemanden zu informieren.
 */
export const relocationNotices = (input: RelocationInput): readonly RelocationNotice[] =>
  occupiedSlots(input.slots).map((slot) => {
    const assignment = slot.assignment;
    if (!assignment) throw new Error('occupiedSlots hat einen freien Platz geliefert');
    const venueChanged = input.previousVenue !== input.game.venue;
    const timeChanged = input.previousKickoff.getTime() !== input.game.kickoff.getTime();
    return {
      refereeId: assignment.refereeId,
      slotIndex: slot.index,
      slotLabel: SLOT_LABELS[slot.index],
      canDecline: true,
      headline: `${input.game.home} — ${input.game.away} wurde ${describeChange(timeChanged, venueChanged)}`,
      detail: `Neuer Termin: ${formatKickoff(input.game.kickoff)} · ${input.game.venue}. Du bist als ${SLOT_LABELS[slot.index]} eingetragen, Anpfiff ${describeLeadTime(input.game.kickoff, input.now)}.`,
    };
  });

const describeChange = (timeChanged: boolean, venueChanged: boolean): string => {
  if (timeChanged && venueChanged) return 'verschoben und in eine andere Halle verlegt';
  if (timeChanged) return 'verschoben';
  if (venueChanged) return 'in eine andere Halle verlegt';
  return 'geaendert';
};

const formatKickoff = (kickoff: Date): string =>
  new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(kickoff);

export interface DeclineResult {
  /** Der Platz, der wieder offen ist. */
  vacatedSlot: SlotIndex;
  /** Regel 18: Ein frei gewordener Schiedsrichter-Platz startet die Kaskade. */
  startsPromotionCascade: boolean;
}

/**
 * Regel 18: Absage nach einer Verschiebung. Der Platz wird sofort wieder frei.
 * Gibt null zurueck, wenn die Person gar nicht eingetragen war.
 */
export const applyRelocationDecline = (
  slots: readonly Slot[],
  refereeId: string,
): DeclineResult | null => {
  const slot = slots.find((s) => s.assignment?.refereeId === refereeId);
  if (!slot) return null;
  return {
    vacatedSlot: slot.index,
    startsPromotionCascade: slot.kind === 'referee',
  };
};
