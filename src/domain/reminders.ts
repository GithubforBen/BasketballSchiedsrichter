import { describeHours } from './time';
import type { ClubSettings } from './types';

/**
 * Persoenliche Erinnerungen. Regeln 21-24.
 *
 * Erinnerungen werden als Vorlauf in Stunden vor Anpfiff gespeichert.
 * Die Pflichtbestaetigung kommt immer zusaetzlich und zaehlt nicht mit (Regel 24).
 */

/** Die Schnellauswahl aus dem Mockup: 7 Tage, 3 Tage, 2 Tage, 1 Tag, 3 Std, 1 Std. */
export const REMINDER_PRESETS: readonly number[] = [168, 72, 48, 24, 3, 1];

export type ReminderOutcome =
  | { kind: 'added'; hoursBefore: number }
  | { kind: 'duplicate'; message: string }
  | { kind: 'out-of-range'; message: string }
  | { kind: 'limit-reached'; message: string }
  /** Regel 22: ab der eingestellten Anzahl kommt die Kostenrueckfrage. */
  | { kind: 'needs-cost-confirmation'; hoursBefore: number; current: number; message: string };

/**
 * Prueft, ob eine weitere Erinnerung angelegt werden darf.
 *
 * Die Kostenrueckfrage ist kein Fehler, sondern ein Zwischenschritt: bestaetigt
 * der Nutzer, wird `commitReminder` mit demselben Wert aufgerufen.
 */
export const evaluateReminder = (
  existing: readonly number[],
  hoursBefore: number,
  settings: ClubSettings,
): ReminderOutcome => {
  if (!Number.isInteger(hoursBefore)) {
    return { kind: 'out-of-range', message: 'Bitte volle Stunden angeben.' };
  }
  if (existing.includes(hoursBefore)) {
    return {
      kind: 'duplicate',
      message: `Eine Erinnerung ${describeHours(hoursBefore)} vor Anpfiff ist schon aktiv.`,
    };
  }
  if (hoursBefore < settings.reminderMinHours || hoursBefore > settings.reminderMaxHours) {
    return {
      kind: 'out-of-range',
      message: `Erinnerungen sind zwischen ${describeHours(settings.reminderMinHours)} und ${describeHours(settings.reminderMaxHours)} vor Anpfiff moeglich.`,
    };
  }
  if (existing.length >= settings.reminderLimit) {
    return {
      kind: 'limit-reached',
      message: `Mehr als ${settings.reminderLimit} Erinnerungen sind nicht moeglich. Entferne zuerst eine bestehende.`,
    };
  }
  if (existing.length >= settings.reminderCostWarningFrom - 1) {
    return {
      kind: 'needs-cost-confirmation',
      hoursBefore,
      current: existing.length,
      message: `Du hast schon ${existing.length} Erinnerungen. Jede Nachricht kostet den Verein Geld. Wirklich eine weitere hinzufuegen?`,
    };
  }
  return { kind: 'added', hoursBefore };
};

/**
 * Legt die Erinnerung an. Die Kostenrueckfrage ist hier bereits beantwortet;
 * Duplikat, Bereich und Hard-Limit werden trotzdem erneut geprueft, damit ein
 * direkter Aufruf die Regeln nicht umgehen kann.
 */
export const commitReminder = (
  existing: readonly number[],
  hoursBefore: number,
  settings: ClubSettings,
): { readonly ok: true; readonly reminders: readonly number[] } | { readonly ok: false; readonly message: string } => {
  const check = evaluateReminder(existing, hoursBefore, settings);
  if (check.kind === 'duplicate' || check.kind === 'out-of-range' || check.kind === 'limit-reached') {
    return { ok: false, message: check.message };
  }
  return { ok: true, reminders: sortReminders([...existing, hoursBefore]) };
};

export const removeReminder = (
  existing: readonly number[],
  hoursBefore: number,
): readonly number[] => existing.filter((h) => h !== hoursBefore);

/** Absteigend: der frueheste Vorlauf zuerst, so wie im Mockup angezeigt. */
export const sortReminders = (reminders: readonly number[]): readonly number[] =>
  [...reminders].sort((a, b) => b - a);

export const remindersLabel = (existing: readonly number[], settings: ClubSettings): string =>
  `${existing.length} von ${settings.reminderLimit} genutzt`;

/** Konkrete Sendezeitpunkte fuer ein Spiel — Grundlage des Schedulers in M5. */
export const reminderTimes = (kickoff: Date, reminders: readonly number[]): readonly Date[] =>
  sortReminders(reminders).map((h) => new Date(kickoff.getTime() - h * 60 * 60 * 1000));
