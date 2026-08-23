import { days } from './time';
import type { ClubSettings, Referee, RotationWindow } from './types';

/**
 * Faire Rotation. Regel 19.
 *
 * Rotation aendert nichts daran, wer sich eintragen darf — First come, first
 * served bleibt unangetastet. Sie bestimmt ausschliesslich die Reihenfolge,
 * in der die Qualifizierten angeschrieben werden: wer im gewaehlten Zeitraum
 * am wenigsten gepfiffen hat, erfaehrt zuerst von einem offenen Platz.
 */

export const ROTATION_WINDOW_LABELS: Readonly<Record<RotationWindow, string>> = {
  week: 'pro Woche',
  month: 'pro Monat',
  season: 'pro Saison',
};

/** Beginn des Zeitraums, ueber den die Einsaetze fuer die Rotation gezaehlt werden. */
export const rotationWindowStart = (now: Date, window: RotationWindow): Date => {
  switch (window) {
    case 'week':
      return new Date(now.getTime() - days(7));
    case 'month':
      return new Date(now.getTime() - days(30));
    case 'season':
      return new Date(now.getTime() - days(365));
  }
};

export interface RotationCandidate {
  referee: Referee;
  /** Einsaetze im gewaehlten Zeitraum. */
  countInWindow: number;
}

/**
 * Reihenfolge, in der angeschrieben wird.
 *
 * Ist die Rotation aus, bleibt die uebergebene Reihenfolge erhalten und alle
 * werden gleichzeitig benachrichtigt. Ist sie an, stehen die Wenig-Pfeifer
 * vorn; bei Gleichstand entscheidet der Name, damit die Reihenfolge
 * reproduzierbar ist.
 */
export const notificationOrder = (
  candidates: readonly RotationCandidate[],
  settings: ClubSettings,
): readonly Referee[] => {
  if (!settings.rotation) return candidates.map((c) => c.referee);
  return [...candidates]
    .sort(
      (a, b) =>
        a.countInWindow - b.countInWindow ||
        a.referee.name.localeCompare(b.referee.name, 'de'),
    )
    .map((c) => c.referee);
};
