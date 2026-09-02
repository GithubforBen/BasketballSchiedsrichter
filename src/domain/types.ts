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

/**
 * Schiedsrichter-Lizenz. E ist die niedrigere, D die hoehere.
 *
 * `null` heisst: keine Lizenz. Wer keine hat, darf sich in gar kein Spiel
 * eintragen — auch nicht in eine Liga, fuer die die Qualifikation vorliegt.
 * Sehen darf er weiterhin jedes Spiel.
 */
export type License = 'E' | 'D';

export interface Referee {
  id: string;
  /** Vollstaendiger Name. Nur nach Login sichtbar. Regel 29. */
  name: string;
  /**
   * Vorname. Jede Nachricht spricht damit an — "Hallo Jonas" und nicht
   * "Hallo Jonas Keller".
   */
  firstName: string;
  /** Oeffentlich sichtbares Kuerzel, z. B. "JK". Regel 29. */
  initials: string;
  phone: string;
  role: 'referee' | 'admin';
  /** IDs der Ligen, fuer die diese Person pfeifen darf. Regel 4. */
  qualifications: readonly string[];
  /** Lizenz dieser Person, `null` wenn keine vorliegt. */
  license: License | null;
  /** Persoenliche Erinnerungen als Vorlauf in Stunden vor Anpfiff. Regel 21. */
  reminderHours: readonly number[];
  /** Zeitraum der Tagesuebersicht in Wochen. Nur fuer Admins von Belang. */
  digestWeeks: number;
  /** Ob dieser Admin die Tagesuebersicht bekommt. */
  digestEnabled: boolean;
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
  /** Lizenz, die zum Pfeifen dieses Spiels noetig ist. */
  requiredLicense: License;
  state: GameState;
  /**
   * Zaehlt, wie oft an diesem Spiel ein Schiedsrichter-Platz frei geworden ist.
   *
   * Er unterscheidet eine neue Ausschreibung von der Wiederholung einer alten:
   * ohne ihn saehe die zweite Ausschreibung desselben Spiels wie eine Doppelung
   * aus und bliebe stumm. Regeln 15 und 32.
   */
  vacancyVersion: number;
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
  /**
   * Wann sich diese Person eingetragen hat.
   *
   * Der Nachrichtenplan braucht den Zeitpunkt: wer sich zwei Stunden vor
   * Anpfiff eintraegt, darf keine Erinnerung mehr bekommen, deren Vorlauf
   * laengst verstrichen war. Regel 21.
   */
  claimedAt: Date;
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
 * Wer die Ausschreibung eines offenen Platzes bekommt.
 *
 * - `all`    alle Qualifizierten, in Rotationsreihenfolge (Regel 19)
 * - `admins` nur die aktiven Admins — sie besetzen den Platz von Hand
 * - `off`    niemand; die Luecke steht nur in der Uebersicht
 *
 * Die Ausschreibung ist die einzige Nachricht, die auf einen Schlag an viele
 * Personen geht, und bestimmt damit die Kosten fast allein (Regel 33). Deshalb
 * ist sie vollstaendig abschaltbar und nicht nur in ihren Wiederholungen.
 */
export type OpenSlotVisibility = 'all' | 'admins' | 'off';

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
  /** Wer die Ausschreibung eines offenen Platzes bekommt. Regeln 15 und 32. */
  openSlotVisibility: OpenSlotVisibility;
  /**
   * Ob die Quittung nach dem Eintragen rausgeht. Regel 31.
   *
   * Sie bestaetigt nur die eigene Handlung, die auf dem Bildschirm ohnehin
   * schon quittiert wurde — ein Verein mit knappem Nachrichtenbudget schaltet
   * sie deshalb ab, ein anderer will sie. Beides ist vertretbar, also ist es
   * eine Einstellung und keine Entscheidung im Code.
   */
  assignmentReceipt: boolean;
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
  openSlotVisibility: 'all',
  assignmentReceipt: true,
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
  | 'license-missing'
  | 'license-too-low'
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
