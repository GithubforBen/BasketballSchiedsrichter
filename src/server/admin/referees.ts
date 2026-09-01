import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq, gte, sql as sqlRaw } from 'drizzle-orm';
import { db, schema } from '@/db';
import { firstNameSuggestion } from '@/domain/license';
import { START_PASSWORD_VALID_DAYS, hasUsableStartPassword } from '@/domain/password';
import { slotKind } from '@/domain/slots';
import type { License, SlotIndex } from '@/domain/types';
import { applyStartPassword } from '../auth/password-login';
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
  /** Anrede in jeder Nachricht. Leer heisst: das erste Wort des Namens. */
  firstName: string;
  initials: string;
  phone: string;
  role: 'referee' | 'admin';
  /** Lizenz, `null` wenn noch keine vorliegt. Ohne sie kein Eintragen. */
  license: License | null;
}

/**
 * Legt ein Konto an. Eine Selbstregistrierung gibt es bewusst nicht.
 *
 * Das Start-Passwort aus Regel 35 wird gleich mitgesetzt. Es steht **nicht** in
 * der Rueckmeldung: die geht ueber den Abfrageteil der Adresse zurueck und
 * landete damit im Verlauf des Browsers und im Zugriffsprotokoll des
 * Webservers. Ablesen laesst es sich in der Tabelle daneben, die es aus dem
 * Namen berechnet.
 */
export const createReferee = async (
  actorId: string,
  input: NewRefereeInput,
): Promise<AdminResult> => {
  const name = input.name.trim();
  const initials = input.initials.trim().toUpperCase();
  /*
   * Bleibt das Feld leer, nimmt das Anlegen das erste Wort des Namens. Das
   * trifft in den meisten Faellen zu und laesst sich in der Tabelle
   * korrigieren — besser als eine Nachricht ohne Anrede.
   */
  const firstName =
    input.firstName.trim() === '' ? firstNameSuggestion(name) : input.firstName.trim();

  if (name === '') return fail('Bitte einen Namen angeben.');
  if (!/^[A-ZÄÖÜ]{2,4}$/.test(initials)) {
    return fail('Das Kürzel besteht aus zwei bis vier Buchstaben, zum Beispiel „JK“.');
  }
  const phone = normalisePhone(input.phone);
  if (!phone.ok) return fail(phone.message);

  if (!hasUsableStartPassword(name)) {
    return fail('Aus diesem Namen lässt sich kein Start-Passwort bilden — bitte ausschreiben.');
  }

  const id = randomUUID();
  try {
    await db.insert(schema.referees).values({
      id,
      name,
      firstName,
      initials,
      phone: phone.phone,
      role: input.role,
      license: input.license,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return fail('Kürzel oder Telefonnummer sind schon vergeben.');
    }
    throw error;
  }

  await applyStartPassword(id, name);
  await audit(actorId, 'referee.create', id, {
    name,
    initials,
    role: input.role,
    lizenz: input.license,
  });
  return {
    ok: true,
    message:
      `${name} angelegt. Das Start-Passwort steht in der Tabelle oben, gilt ` +
      `${START_PASSWORD_VALID_DAYS} Tage und muss beim ersten Anmelden geändert werden.`,
  };
};

export interface RefereeUpdate {
  firstName: string;
  initials: string;
  phone: string;
  role: 'referee' | 'admin';
  license: License | null;
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
  const firstName = input.firstName.trim();
  if (firstName === '') return fail('Bitte einen Vornamen angeben — er steht in jeder Nachricht.');
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
      .set({
        firstName,
        initials,
        phone: phone.phone,
        role: input.role,
        license: input.license,
        active: input.active,
      })
      .where(eq(schema.referees.id, refereeId));
  } catch (error) {
    if (isUniqueViolation(error)) return fail('Kürzel oder Telefonnummer sind schon vergeben.');
    throw error;
  }

  await audit(actorId, 'referee.update', refereeId, {
    initials,
    role: input.role,
    lizenz: input.license,
    active: input.active,
  });
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

/**
 * Loescht ein Konto samt allem, was daran haengt. Loeschkonzept, M6.
 *
 * Was verschwindet: Name, Kuerzel, Telefonnummer, Qualifikationen, alle
 * Eintragungen — vergangene wie kuenftige —, offene Nachrueck-Anfragen und
 * wartende Nachrichten. Die Fremdschluessel raeumen das mit; im Pruefprotokoll
 * bleibt der Vorgang, aber ohne Bezug zur Person.
 *
 * Was das heisst: die Person verschwindet auch aus der Statistik und aus dem
 * Verlauf vergangener Spiele. Genau das ist gemeint, wenn jemand seine Loeschung
 * verlangt. Wer nur aufhoert und dessen Zahlen bleiben sollen, wird
 * **stillgelegt** — dafuer gibt es den Schalter daneben.
 *
 * Der heikle Teil sind kuenftige Spiele: verschwindet jemand von einem
 * Schiedsrichter-Platz, ist das Spiel unbesetzt, ohne dass es jemand merkt.
 * Deshalb zaehlt diese Aktion die Luecke hoch (Regeln 15 und 32) — der naechste
 * Nachrichtenlauf schreibt den Platz aus, so wie beim Austragen auch.
 */
export const deleteReferee = async (
  actorId: string,
  refereeId: string,
): Promise<AdminResult> => {
  if (actorId === refereeId) {
    return fail('Das eigene Konto lässt sich hier nicht löschen — bitte von einem anderen Admin.');
  }

  const rows = await db
    .select({ name: schema.referees.name, role: schema.referees.role, active: schema.referees.active })
    .from(schema.referees)
    .where(eq(schema.referees.id, refereeId))
    .limit(1);
  const referee = rows[0];
  if (!referee) return fail('Dieses Konto gibt es nicht mehr.');

  if (referee.role === 'admin' && referee.active) {
    const admins = await db
      .select({ id: schema.referees.id })
      .from(schema.referees)
      .where(and(eq(schema.referees.role, 'admin'), eq(schema.referees.active, true)));
    if (admins.length <= 1) {
      return fail('Das ist der letzte aktive Admin. Erst einen weiteren anlegen, dann löschen.');
    }
  }

  const now = new Date();
  const affected = await db
    .select({ gameId: schema.assignments.gameId, slotIndex: schema.assignments.slotIndex })
    .from(schema.assignments)
    .innerJoin(schema.games, eq(schema.assignments.gameId, schema.games.id))
    .where(and(eq(schema.assignments.refereeId, refereeId), gte(schema.games.kickoff, now)));

  const openedSlots = affected.filter((row) => slotKind(row.slotIndex as SlotIndex) === 'referee');

  await db.transaction(async (tx) => {
    for (const row of openedSlots) {
      await tx
        .update(schema.games)
        .set({ vacancyVersion: sqlRaw`${schema.games.vacancyVersion} + 1` })
        .where(eq(schema.games.id, row.gameId));
    }
    await tx.delete(schema.referees).where(eq(schema.referees.id, refereeId));
    await tx.insert(schema.auditLog).values({
      id: randomUUID(),
      actorId,
      action: 'referee.delete',
      subjectId: refereeId,
      detail: {
        kuenftigeEintragungen: affected.length,
        freigewordeneSchiriPlaetze: openedSlots.length,
      },
    });
  });

  const suffix =
    openedSlots.length === 0
      ? ''
      : ` ${openedSlots.length} Schiedsrichter-Platz/Plätze sind dadurch offen und werden ausgeschrieben.`;
  return { ok: true, message: `Konto gelöscht — alle Daten dieser Person sind entfernt.${suffix}` };
};
