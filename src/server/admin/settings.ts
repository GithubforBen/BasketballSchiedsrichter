import 'server-only';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import type { OpenSlotVisibility, RotationWindow } from '@/domain/types';
import type { AdminResult } from './games';

/**
 * Vereinsweite Einstellungen. Regel 9: Fristen und Vorlaeufe sind einstellbar —
 * die Qualifikationspruefung bewusst nicht, sie ist Pflicht.
 */

export interface SettingsInput {
  withdrawDeadlineDays: number;
  substituteRequestDeadlineDays: number;
  confirmationLeadHours: number;
  reminderLimit: number;
  oneGamePerDay: boolean;
  rotation: boolean;
  rotationWindow: RotationWindow;
  autoNudge: boolean;
  openSlotVisibility: OpenSlotVisibility;
  assignmentReceipt: boolean;
  alertUnfilled: boolean;
  alertConfirmationOverdue: boolean;
  alertSubstituteMissing: boolean;
  alertCancellation: boolean;
  alertDailyDigest: boolean;
  alertAfterImport: boolean;
}

const CONFIRMATION_CHOICES = [24, 48, 72, 96];

const OPEN_SLOT_CHOICES: readonly OpenSlotVisibility[] = ['all', 'admins', 'off'];

export const saveSettings = async (
  actorId: string,
  input: SettingsInput,
): Promise<AdminResult> => {
  const bounded = (value: number, min: number, max: number, label: string): string | null =>
    Number.isInteger(value) && value >= min && value <= max
      ? null
      : `${label} muss zwischen ${min} und ${max} liegen.`;

  const problem =
    bounded(input.withdrawDeadlineDays, 0, 120, 'Die Austragefrist') ??
    bounded(input.substituteRequestDeadlineDays, 0, 120, 'Die Frist für Ersatzanfragen') ??
    bounded(input.reminderLimit, 1, 50, 'Das Erinnerungslimit') ??
    (CONFIRMATION_CHOICES.includes(input.confirmationLeadHours)
      ? null
      : 'Der Vorlauf der Pflichtbestätigung muss 24, 48, 72 oder 96 Stunden betragen.') ??
    (OPEN_SLOT_CHOICES.includes(input.openSlotVisibility)
      ? null
      : 'Die Ausschreibung offener Plätze kennt nur „alle“, „nur Admins“ oder „aus“.');

  if (problem) return { ok: false, message: problem };

  await db
    .insert(schema.settings)
    .values({ id: 1, ...input })
    .onConflictDoUpdate({ target: schema.settings.id, set: { ...input } });

  await db.insert(schema.auditLog).values({
    id: randomUUID(),
    actorId,
    action: 'settings.save',
    detail: { ...input },
  });

  return { ok: true, message: 'Einstellungen gespeichert.' };
};

/** Legt eine Liga an oder schaltet sie ab. */
export const setLeague = async (
  actorId: string,
  leagueId: string,
  active: boolean,
): Promise<AdminResult> => {
  const id = leagueId.trim();
  if (id === '') return { ok: false, message: 'Bitte einen Namen für die Liga angeben.' };

  const existing = await db
    .select({ id: schema.leagues.id })
    .from(schema.leagues)
    .where(eq(schema.leagues.id, id))
    .limit(1);

  if (existing.length === 0) {
    if (!active) return { ok: false, message: `Die Liga „${id}“ gibt es nicht.` };
    await db.insert(schema.leagues).values({ id, name: id, sortOrder: 100 });
  } else {
    await db.update(schema.leagues).set({ active }).where(eq(schema.leagues.id, id));
  }

  await db.insert(schema.auditLog).values({
    id: randomUUID(),
    actorId,
    action: 'league.set',
    detail: { leagueId: id, active },
  });

  return {
    ok: true,
    message: active ? `Liga „${id}“ ist aktiv.` : `Liga „${id}“ abgeschaltet.`,
  };
};
