import { slotKind } from './slots';
import { hours } from './time';
import type { ClubSettings, Game, Slot } from './types';

/**
 * Zustand der Pflichtbestaetigung eines Platzes. Regeln 10-12.
 *
 * - `not-required`  Ersatzplatz oder freier Platz — Ersatz bestaetigt nicht (Regel 12)
 * - `scheduled`     Der Vorlauf ist noch nicht erreicht, die Nachricht kommt spaeter
 * - `pending`       Angefordert, noch keine Antwort
 * - `overdue`       Angefordert und die Nachfassfrist ist verstrichen (Regel 11)
 * - `confirmed`     Beantwortet
 */
export type ConfirmationState =
  | 'not-required'
  | 'scheduled'
  | 'pending'
  | 'overdue'
  | 'confirmed';

/** Zeitpunkt, zu dem die Pflichtbestaetigung angefordert wird. Regel 10. */
export const confirmationDueAt = (game: Game, settings: ClubSettings): Date =>
  new Date(game.kickoff.getTime() - hours(settings.confirmationLeadHours));

/**
 * Wann die Frage tatsaechlich gestellt wurde.
 *
 * In aller Regel zum eingestellten Vorlauf. Traegt sich jemand aber erst
 * *innerhalb* des Vorlaufs ein, ist der Zeitpunkt laengst vorbei — die Frage
 * geht ihm erst jetzt zu. Ohne diese Unterscheidung waere seine Bestaetigung im
 * selben Augenblick "ueberfaellig", in dem er sich eingetragen hat: er bekaeme
 * Bitte und Mahnung zusammen, zu einer Frage, die ihm nie gestellt wurde.
 */
const confirmationRequestedAt = (
  claimedAt: Date,
  game: Game,
  settings: ClubSettings,
): Date => new Date(Math.max(confirmationDueAt(game, settings).getTime(), claimedAt.getTime()));

export const confirmationState = (
  slot: Slot,
  game: Game,
  settings: ClubSettings,
  now: Date,
): ConfirmationState => {
  if (slotKind(slot.index) !== 'referee') return 'not-required';
  const assignment = slot.assignment;
  if (!assignment) return 'not-required';
  if (assignment.confirmedAt) return 'confirmed';

  const requested = confirmationRequestedAt(assignment.claimedAt, game, settings);
  if (now < requested) return 'scheduled';

  const sinceRequest = now.getTime() - requested.getTime();
  return sinceRequest >= hours(settings.confirmationFollowUpHours) ? 'overdue' : 'pending';
};

/** Anzeigetexte, wie sie im Mockup stehen. */
export const CONFIRMATION_LABELS: Readonly<Record<ConfirmationState, string>> = {
  'not-required': 'keine Bestaetigung noetig',
  scheduled: 'Bestaetigung folgt',
  pending: 'Bestaetigung offen',
  overdue: 'Bestaetigung ueberfaellig',
  confirmed: 'bestaetigt',
};

/**
 * Regel 11: Ohne Antwort innerhalb der Nachfassfrist geht eine erneute
 * Erinnerung an die Person und eine Meldung an alle Admins.
 */
export const needsFollowUp = (
  slot: Slot,
  game: Game,
  settings: ClubSettings,
  now: Date,
): boolean => confirmationState(slot, game, settings, now) === 'overdue';

/** Wie viele Schiedsrichter-Plaetze eines Spiels noch nicht bestaetigt haben. */
export const openConfirmations = (
  slots: readonly Slot[],
  game: Game,
  settings: ClubSettings,
  now: Date,
): readonly Slot[] =>
  slots.filter((s) => {
    const state = confirmationState(s, game, settings, now);
    return state === 'pending' || state === 'overdue';
  });
