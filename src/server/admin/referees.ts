import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { normalisePhone } from '../auth/phone';
import { isUniqueViolation } from '../assignments';
import type { AdminResult } from './games';

/**
 * Schiedsrichter-Verwaltung. Regel 30: Name, Kuerzel, Telefonnummer und
 * Qualifikationen aendert ausschliesslich der Admin — und zwar hier.
 */

const fail = (message: string): AdminResult => ({ ok: false, message });

const audit = async (
  actorId: string,
  action: string,
  subjectId: string,
  detail: Record<string, unknown>,
): Promise<void> => {
  await db.insert(schema.auditLog).values({ id: randomUUID(), actorId, action, subjectId, detail });
};

export interface NewRefereeInput {
  name: string;
  initials: string;
  phone: string;
  role: 'referee' | 'admin';
}

/** Legt ein Konto an. Eine Selbstregistrierung gibt es bewusst nicht. */
export const createReferee = async (
  actorId: string,
  input: NewRefereeInput,
): Promise<AdminResult> => {
  const name = input.name.trim();
  const initials = input.initials.trim().toUpperCase();

  if (name === '') return fail('Bitte einen Namen angeben.');
  if (!/^[A-ZÄÖÜ]{2,4}$/.test(initials)) {
    return fail('Das Kürzel besteht aus zwei bis vier Buchstaben, zum Beispiel „JK“.');
  }
  const phone = normalisePhone(input.phone);
  if (!phone.ok) return fail(phone.message);

  const id = randomUUID();
  try {
    await db.insert(schema.referees).values({ id, name, initials, phone: phone.phone, role: input.role });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return fail('Kürzel oder Telefonnummer sind schon vergeben.');
    }
    throw error;
  }

  await audit(actorId, 'referee.create', id, { name, initials, role: input.role });
  return { ok: true, message: `${name} angelegt. Die Anmeldung läuft über die Telefonnummer.` };
};

export interface RefereeUpdate {
  initials: string;
  phone: string;
  role: 'referee' | 'admin';
  active: boolean;
}

/** Aendert die Stammdaten einer Person. */
export const updateReferee = async (
  actorId: string,
  refereeId: string,
  input: RefereeUpdate,
): Promise<AdminResult> => {
  const initials = input.initials.trim().toUpperCase();
  if (!/^[A-ZÄÖÜ]{2,4}$/.test(initials)) {
    return fail('Das Kürzel besteht aus zwei bis vier Buchstaben.');
  }
  const phone = normalisePhone(input.phone);
  if (!phone.ok) return fail(phone.message);

  /*
   * Der letzte Admin darf sich weder selbst herabstufen noch stilllegen —
   * sonst kaeme niemand mehr an die Verwaltung heran, und Konten legt
   * ausschliesslich ein Admin an.
   */
  if (input.role !== 'admin' || !input.active) {
    const admins = await db
      .select({ id: schema.referees.id })
      .from(schema.referees)
      .where(and(eq(schema.referees.role, 'admin'), eq(schema.referees.active, true)));
    if (admins.length <= 1 && admins[0]?.id === refereeId) {
      return fail('Das ist der letzte aktive Admin — lege zuerst einen weiteren an.');
    }
  }

  try {
    await db
      .update(schema.referees)
      .set({ initials, phone: phone.phone, role: input.role, active: input.active })
      .where(eq(schema.referees.id, refereeId));
  } catch (error) {
    if (isUniqueViolation(error)) return fail('Kürzel oder Telefonnummer sind schon vergeben.');
    throw error;
  }

  await audit(actorId, 'referee.update', refereeId, { initials, role: input.role, active: input.active });
  return { ok: true, message: 'Gespeichert.' };
};

/** Setzt eine Qualifikation. Regel 4: ohne sie geht kein Eintrag. */
export const setQualification = async (
  actorId: string,
  refereeId: string,
  leagueId: string,
  qualified: boolean,
): Promise<AdminResult> => {
  if (qualified) {
    await db
      .insert(schema.qualifications)
      .values({ refereeId, leagueId })
      .onConflictDoNothing();
  } else {
    await db
      .delete(schema.qualifications)
      .where(
        and(
          eq(schema.qualifications.refereeId, refereeId),
          eq(schema.qualifications.leagueId, leagueId),
        ),
      );
  }

  await audit(actorId, 'referee.qualification', refereeId, { leagueId, qualified });
  return {
    ok: true,
    message: qualified
      ? `Qualifikation ${leagueId} erteilt.`
      : `Qualifikation ${leagueId} entzogen. Bestehende Eintragungen bleiben bestehen.`,
  };
};
