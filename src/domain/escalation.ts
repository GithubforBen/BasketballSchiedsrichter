import { refereeSlots, substituteSlots, SLOT_LABELS } from './slots';
import { hours, msUntil } from './time';
import type { ClubSettings, Game, Slot, SlotIndex } from './types';

/**
 * Die Nachrueck-Kaskade. Regeln 13-16.
 *
 * Wird ein Schiedsrichter-Platz frei, fragt das System zuerst Ersatz 1 und
 * danach Ersatz 2, jeweils mit einer Antwortfrist. Erst wenn beide abgelehnt
 * haben oder ihre Frist verstrichen ist, wird der Platz fuer alle
 * Qualifizierten ausgeschrieben.
 */

export type PromotionStep =
  /** Ersatz `substitute` wird gefragt, ob er auf `targetSlot` nachrueckt. */
  | {
      kind: 'offer';
      substitute: Slot;
      targetSlot: SlotIndex;
      respondBy: Date;
    }
  /** Kein Ersatz mehr uebrig — der Platz geht an alle Qualifizierten. */
  | {
      kind: 'announce';
      targetSlot: SlotIndex;
      reason: 'no-substitutes' | 'all-declined';
    }
  /** Es ist kein Schiedsrichter-Platz frei; nichts zu tun. */
  | { kind: 'idle' };

export interface PromotionContext {
  game: Game;
  slots: readonly Slot[];
  /**
   * Ersatzplaetze, die bereits abgelehnt haben oder deren Antwortfrist
   * verstrichen ist. Sie werden in dieser Kaskade nicht erneut gefragt.
   */
  declinedSlots: readonly SlotIndex[];
  settings: ClubSettings;
  now: Date;
}

/**
 * Antwortfrist beim Nachruecken.
 *
 * Standard ist der eingestellte Wert. Rueckt der Anpfiff naeher, waere eine
 * feste Frist von zwoelf Stunden sinnlos — deshalb wird sie auf ein Drittel
 * der verbleibenden Zeit gekuerzt, sobald weniger als das Dreifache der Frist
 * bis zum Anpfiff bleibt. Bei 12 Stunden Standard greift das ab 36 Stunden
 * Restzeit, und beide Formeln treffen sich dort stetig.
 */
export const promotionResponseWindowMs = (
  game: Game,
  settings: ClubSettings,
  now: Date,
): number => {
  const standard = hours(settings.promotionResponseHours);
  const remaining = msUntil(game.kickoff, now);
  if (remaining <= 0) return 0;
  return remaining < standard * 3 ? Math.floor(remaining / 3) : standard;
};

export const nextPromotionStep = (ctx: PromotionContext): PromotionStep => {
  const target = refereeSlots(ctx.slots).find((s) => s.assignment === null);
  if (!target) return { kind: 'idle' };

  const available = substituteSlots(ctx.slots).filter(
    (s) => s.assignment !== null && !ctx.declinedSlots.includes(s.index),
  );

  const anySubstitute = substituteSlots(ctx.slots).some((s) => s.assignment !== null);
  const candidate = available[0];
  if (!candidate) {
    return {
      kind: 'announce',
      targetSlot: target.index,
      reason: anySubstitute ? 'all-declined' : 'no-substitutes',
    };
  }

  return {
    kind: 'offer',
    substitute: candidate,
    targetSlot: target.index,
    respondBy: new Date(ctx.now.getTime() + promotionResponseWindowMs(ctx.game, ctx.settings, ctx.now)),
  };
};

export interface PromotionResult {
  /** Der Platz, auf den nachgerueckt wurde. */
  targetSlot: SlotIndex;
  /** Der Ersatzplatz, der dadurch frei geworden ist und ausgeschrieben wird. */
  vacatedSlot: SlotIndex;
  refereeId: string;
}

/**
 * Regel 16: Wer nachrueckt, belegt den Schiedsrichter-Platz. Der frei gewordene
 * Ersatzplatz wird ausgeschrieben. Es wird nichts nachgeschoben — Ersatz 2
 * bleibt Ersatz 2, damit niemand ungefragt die Rolle wechselt.
 */
export const applyPromotion = (step: Extract<PromotionStep, { kind: 'offer' }>): PromotionResult => {
  const assignment = step.substitute.assignment;
  if (!assignment) {
    throw new Error(`Ersatzplatz ${SLOT_LABELS[step.substitute.index]} ist nicht belegt.`);
  }
  return {
    targetSlot: step.targetSlot,
    vacatedSlot: step.substitute.index,
    refereeId: assignment.refereeId,
  };
};

/** Ob eine laufende Nachfrage abgelaufen ist und der naechste dran ist. Regel 14. */
export const promotionOfferExpired = (respondBy: Date, now: Date): boolean =>
  now.getTime() >= respondBy.getTime();
