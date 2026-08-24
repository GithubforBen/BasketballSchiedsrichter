import { refereeSlots, substituteSlots } from './slots';
import type { Slot } from './types';

/**
 * Statuszustaende eines Spiels. Die Farben stammen aus dem Mockup und sind in
 * PLAN.md Abschnitt 2 festgehalten. `open` und `refereeMissing` teilen sich die
 * Akzentfarbe, weil beide dasselbe bedeuten: es fehlt ein Schiedsrichter.
 */
export type GameStatus = 'open' | 'refereeMissing' | 'substituteMissing' | 'filled';

export interface StatusView {
  status: GameStatus;
  /** Anzeigetext wie im Mockup. */
  label: string;
  /**
   * Die Farbe als Flaeche — Punkt, Rahmen, Tint. Nie ein roher Hex-Wert.
   * Flaechen brauchen 3:1, deshalb bleibt hier der volle Ton aus dem Mockup.
   */
  colorVar: string;
  /**
   * Dieselbe Farbe als Schrift. Text braucht 4,5:1, und Amber kommt als
   * Schrift nur auf 2,68:1 — es waere neben dem Punkt kaum zu lesen. Deshalb
   * gibt es zwei Werte statt einem: der Punkt bleibt kraeftig, die Schrift
   * daneben wird lesbar. Die Toene stehen in app.css.
   */
  textColorVar: string;
}

const VIEWS: Readonly<Record<GameStatus, StatusView>> = {
  open: {
    status: 'open',
    label: 'offen',
    colorVar: 'var(--status-open)',
    textColorVar: 'var(--status-open-text)',
  },
  refereeMissing: {
    status: 'refereeMissing',
    label: 'Schiri fehlt',
    colorVar: 'var(--status-open)',
    textColorVar: 'var(--status-open-text)',
  },
  substituteMissing: {
    status: 'substituteMissing',
    label: 'Ersatz fehlt',
    colorVar: 'var(--status-substitute-missing)',
    textColorVar: 'var(--status-substitute-missing-text)',
  },
  filled: {
    status: 'filled',
    label: 'besetzt',
    colorVar: 'var(--status-filled)',
    textColorVar: 'var(--status-filled-text)',
  },
};

export const gameStatus = (slots: readonly Slot[]): StatusView => {
  const referees = refereeSlots(slots).filter((s) => s.assignment !== null).length;
  if (referees === 0) return VIEWS.open;
  if (referees < refereeSlots(slots).length) return VIEWS.refereeMissing;
  const substitutes = substituteSlots(slots).filter((s) => s.assignment !== null).length;
  return substitutes < substituteSlots(slots).length ? VIEWS.substituteMissing : VIEWS.filled;
};

/** "1/2 Schiris · 0/2 Ersatz" — die Kurzfassung fuer Listen und Mobile. */
export const occupancyLabel = (slots: readonly Slot[]): string => {
  const refs = refereeSlots(slots);
  const subs = substituteSlots(slots);
  const filled = (list: readonly Slot[]) => list.filter((s) => s.assignment !== null).length;
  return `${filled(refs)}/${refs.length} Schiris · ${filled(subs)}/${subs.length} Ersatz`;
};
