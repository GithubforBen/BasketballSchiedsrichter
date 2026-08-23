import 'server-only';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import {
  commitReminder,
  evaluateReminder,
  removeReminder,
  sortReminders,
} from '@/domain/reminders';
import { describeHours } from '@/domain/time';
import { loadSettings } from './queries/settings';
import { loadReminders } from './queries/referees';

/**
 * Persoenliche Erinnerungen. Regeln 21-24.
 *
 * Die Kostenrueckfrage ist kein Fehler, sondern ein Zwischenschritt: die
 * Oberflaeche fragt nach und ruft dieselbe Aktion noch einmal auf, diesmal mit
 * ausdruecklicher Zustimmung.
 */

export type ReminderResult =
  | { readonly kind: 'saved'; readonly message: string }
  | { readonly kind: 'rejected'; readonly message: string }
  | { readonly kind: 'needs-confirmation'; readonly hoursBefore: number; readonly message: string };

const store = async (refereeId: string, reminders: readonly number[]): Promise<void> => {
  await db
    .update(schema.referees)
    .set({ reminderHours: [...reminders] })
    .where(eq(schema.referees.id, refereeId));
  await db.insert(schema.auditLog).values({
    id: randomUUID(),
    actorId: refereeId,
    action: 'reminders.update',
    subjectId: refereeId,
    detail: { reminders },
  });
};

/**
 * Legt eine Erinnerung an. `confirmed` ueberspringt nur die Kostenrueckfrage —
 * Duplikat, Bereich und Hard-Limit werden weiterhin geprueft.
 */
export const addReminder = async (
  refereeId: string,
  hoursBefore: number,
  confirmed = false,
): Promise<ReminderResult> => {
  const [existing, settings] = await Promise.all([loadReminders(refereeId), loadSettings()]);
  const check = evaluateReminder(existing, hoursBefore, settings);

  if (check.kind === 'duplicate' || check.kind === 'out-of-range' || check.kind === 'limit-reached') {
    return { kind: 'rejected', message: check.message };
  }
  if (check.kind === 'needs-cost-confirmation' && !confirmed) {
    return { kind: 'needs-confirmation', hoursBefore, message: check.message };
  }

  const result = commitReminder(existing, hoursBefore, settings);
  if (!result.ok) return { kind: 'rejected', message: result.message };

  await store(refereeId, result.reminders);
  return {
    kind: 'saved',
    message: `Erinnerung ${describeHours(hoursBefore)} vor Anpfiff gesetzt.`,
  };
};

export const dropReminder = async (
  refereeId: string,
  hoursBefore: number,
): Promise<ReminderResult> => {
  const existing = await loadReminders(refereeId);
  if (!existing.includes(hoursBefore)) {
    return { kind: 'rejected', message: 'Diese Erinnerung war nicht gesetzt.' };
  }
  await store(refereeId, sortReminders(removeReminder(existing, hoursBefore)));
  return {
    kind: 'saved',
    message: `Erinnerung ${describeHours(hoursBefore)} vor Anpfiff entfernt.`,
  };
};
