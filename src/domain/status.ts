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
  /** CSS-Custom-Property, aus der die Farbe kommt. Nie ein roher Hex-Wert. */
  colorVar: string;
}

const VIEWS: Readonly<Record<GameStatus, StatusView>> = {
  open: { status: 'open', label: 'offen', colorVar: 'var(--status-open)' },
  refereeMissing: {
    status: 'refereeMissing',
    label: 'Schiri fehlt',
    colorVar: 'var(--status-open)',
  },
  substituteMissing: {
    status: 'substituteMissing',
    label: 'Ersatz fehlt',
    colorVar: 'var(--status-substitute-missing)',
  },
  filled: { status: 'filled', label: 'besetzt', colorVar: 'var(--status-filled)' },
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
