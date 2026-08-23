import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import type { Referee } from '@/domain/types';

/** Umrechnung von Datenbankzeilen in den fachlichen Typ. */
export interface RefereeRow {
  id: string;
  name: string;
  initials: string;
  phone: string;
  role: 'referee' | 'admin';
  active: boolean;
}

export const toReferee = (row: RefereeRow, qualifications: readonly string[]): Referee => ({
  id: row.id,
  name: row.name,
  initials: row.initials,
  phone: row.phone,
  role: row.role,
  qualifications,
  active: row.active,
});

/** Eine Person samt ihrer Qualifikationen. */
export const loadReferee = async (refereeId: string): Promise<Referee | null> => {
  const rows = await db
    .select()
    .from(schema.referees)
    .where(eq(schema.referees.id, refereeId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const quals = await db
    .select({ leagueId: schema.qualifications.leagueId })
    .from(schema.qualifications)
    .where(eq(schema.qualifications.refereeId, refereeId));

  return toReferee(row, quals.map((q) => q.leagueId));
};

/** Alle aktiven Personen samt Qualifikationen — fuer Meldungen und Listen. */
export const loadAllReferees = async (): Promise<readonly Referee[]> => {
  const rows = await db.select().from(schema.referees);
  const quals = await db.select().from(schema.qualifications);
  const byReferee = new Map<string, string[]>();
  for (const q of quals) {
    const list = byReferee.get(q.refereeId);
    if (list) list.push(q.leagueId);
    else byReferee.set(q.refereeId, [q.leagueId]);
  }
  return rows.map((row) => toReferee(row, byReferee.get(row.id) ?? []));
};

/** Persoenliche Erinnerungen einer Person, in Stunden vor Anpfiff. */
export const loadReminders = async (refereeId: string): Promise<readonly number[]> => {
  const rows = await db
    .select({ reminderHours: schema.referees.reminderHours })
    .from(schema.referees)
    .where(eq(schema.referees.id, refereeId))
    .limit(1);
  return rows[0]?.reminderHours ?? [];
};
