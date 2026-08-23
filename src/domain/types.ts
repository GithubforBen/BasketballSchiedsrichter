/**
 * Fachliche Typen der Schiedsrichter-Planung.
 *
 * Diese Ebene kennt weder Datenbank noch Oberflaeche. Alles hier ist rein und
 * ohne Seiteneffekte, damit die Regeln aus PLAN.md Abschnitt 2 vollstaendig
 * testbar bleiben.
 */

/** Ein Spiel hat vier Plaetze: zwei Schiedsrichter, zwei Ersatz. Regel 1. */
export const SLOT_COUNT = 4;
export const REFEREE_SLOT_COUNT = 2;

/** 0 und 1 sind Schiedsrichter-Plaetze, 2 und 3 Ersatzplaetze. */
export type SlotIndex = 0 | 1 | 2 | 3;

export const SLOT_INDEXES: readonly SlotIndex[] = [0, 1, 2, 3];

export type SlotKind = 'referee' | 'substitute';

export interface League {
  id: string;
  name: string;
  active: boolean;
}

export interface Referee {
  id: string;
  /** Vollstaendiger Name. Nur nach Login sichtbar. Regel 29. */
  name: string;
  /** Oeffentlich sichtbares Kuerzel, z. B. "JK". Regel 29. */
  initials: string;
  phone: string;
  role: 'referee' | 'admin';
  /** IDs der Ligen, fuer die diese Person pfeifen darf. Regel 4. */
  qualifications: readonly string[];
  active: boolean;
}

export type GameState = 'scheduled' | 'moved' | 'cancelled';

export interface Game {
  id: string;
  /** Anpfiff. Alle Fristen rechnen gegen diesen Zeitpunkt. */
  kickoff: Date;
  leagueId: string;
  home: string;
  away: string;
  venue: string;
  state: GameState;
  /** Freigaben, die der Admin pro Spiel setzt. Regeln 6, 7, 8. */
  overrides: GameOverrides;
}

export interface GameOverrides {
  /** Hebt die Austragefrist fuer dieses Spiel auf. Regel 7. */
  withdraw: boolean;
  /** Hebt die Sperre fuer "Ersatz anfordern" auf. Regel 8. */
  substituteRequest: boolean;
  /** Erlaubt ein zweites Spiel am selben Tag. Regel 6. */
  oneGamePerDay: boolean;
}

export interface Assignment {
  gameId: string;
  slotIndex: SlotIndex;
  refereeId: string;
  /** Zeitpunkt der Pflichtbestaetigung, null solange offen. Regeln 10-12. */
  confirmedAt: Date | null;
  /**
   * Ob die Person tatsaechlich als Schiedsrichter auf dem Feld stand.
   * null = noch nicht entschieden. Regeln 25-27.
   */
  playedAsReferee: boolean | null;
}

/** Ein Platz mit seiner aktuellen Belegung. `assignment` ist null, wenn frei. */
export interface Slot {
  index: SlotIndex;
  kind: SlotKind;
  assignment: Assignment | null;
}

export type RotationWindow = 'week' | 'month' | 'season';

/**
 * Vereinsweite Einstellungen aus dem Adminbereich.
 * Die Qualifikationspruefung fehlt bewusst: sie ist Pflicht und nicht abschaltbar (Regel 4).
 */
export interface ClubSettings {
  /** Selbst austragen ist bis so viele Tage vor Anpfiff moeglich. Regel 7. */
  withdrawDeadlineDays: number;
  /** Ersatz anfordern ist bis so viele Tage vor Anpfiff moeglich. Regel 8. */
  substituteRequestDeadlineDays: number;
  /** Vorlauf der Pflichtbestaetigung in Stunden. Regel 10. */
  confirmationLeadHours: number;
  /** Nachfassen, wenn so viele Stunden ohne Antwort vergangen sind. Regel 11. */
  confirmationFollowUpHours: number;
  /** Hard-Limit persoenlicher Erinnerungen. Regel 23. */
  reminderLimit: number;
  /** Ab dieser Anzahl kommt die Kostenrueckfrage. Regel 22. */
  reminderCostWarningFrom: number;
  /** Zulaessiger Bereich persoenlicher Erinnerungen in Stunden. Regel 21. */
  reminderMinHours: number;
  reminderMaxHours: number;
  /** Antwortfrist beim Nachruecken in Stunden. Regeln 13-15. */
  promotionResponseHours: number;
  /** Max. 1 Spiel pro Tag und Person. Regel 6. */
  oneGamePerDay: boolean;
  /** Faire Rotation steuert nur die Anschreib-Reihenfolge. Regel 19. */
  rotation: boolean;
  rotationWindow: RotationWindow;
  /** Automatische Nachfrage, solange Plaetze offen sind. */
  autoNudge: boolean;
}

export const DEFAULT_SETTINGS: ClubSettings = {
  withdrawDeadlineDays: 21,
  substituteRequestDeadlineDays: 3,
  confirmationLeadHours: 72,
  confirmationFollowUpHours: 24,
  reminderLimit: 10,
  reminderCostWarningFrom: 4,
  reminderMinHours: 1,
  reminderMaxHours: 168,
  promotionResponseHours: 12,
  oneGamePerDay: true,
  rotation: true,
  rotationWindow: 'week',
  autoNudge: true,
};

/**
 * Ergebnis einer Regelpruefung.
 *
 * Eine Ablehnung traegt immer einen Text mit, der dem Nutzer den Grund erklaert.
 * Ein Knopf, der nur nicht reagiert, ist laut Review-Checkliste ein Fehler.
 */
export type Decision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: DenialReason; readonly message: string };

export type DenialReason =
  | 'game-cancelled'
  | 'kickoff-passed'
  | 'not-qualified'
  | 'already-assigned'
  | 'slot-taken'
  | 'slot-out-of-order'
  | 'one-game-per-day'
  | 'withdraw-deadline-passed'
  | 'substitute-request-deadline-passed'
  | 'not-assigned'
  | 'no-open-substitute-slot';

export const allow = (): Decision => ({ allowed: true });

export const deny = (reason: DenialReason, message: string): Decision => ({
  allowed: false,
  reason,
  message,
});
