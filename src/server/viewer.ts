import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { mustChangePassword } from '@/domain/password';
import { env } from './env';
import { readSession, SESSION_COOKIE } from './session';

/**
 * Wer gerade schaut.
 *
 * Die Rolle wird aus der Datenbank nachgeladen und nicht dem Cookie geglaubt:
 * ein Konto, dem der Admin die Rolle entzogen hat, darf nicht bis zum Ablauf
 * der Sitzung weiter als Admin gelten.
 *
 * Aus demselben Grund steht auch der Passwortzustand hier und nicht im Cookie:
 * setzt ein Admin das Passwort zurueck (Regel 40), waehrend die Sitzung laeuft,
 * greift der Zwang aus Regel 37 beim naechsten Seitenaufruf — nicht erst beim
 * naechsten Anmelden.
 */

export interface CurrentUser {
  id: string;
  name: string;
  initials: string;
  role: 'referee' | 'admin';
  lastScreen: string | null;
  /** Regel 37: Es gilt noch das Start-Passwort, die App bleibt gesperrt. */
  mustChangePassword: boolean;
}

export const currentUser = async (now: Date = new Date()): Promise<CurrentUser | null> => {
  const store = await cookies();
  const session = readSession(store.get(SESSION_COOKIE)?.value, env.sessionSecret, now);
  if (!session) return null;

  const rows = await db
    .select({
      id: schema.referees.id,
      name: schema.referees.name,
      initials: schema.referees.initials,
      role: schema.referees.role,
      active: schema.referees.active,
      lastScreen: schema.referees.lastScreen,
      ownPasswordSetAt: schema.referees.ownPasswordSetAt,
      startPasswordExpiresAt: schema.referees.startPasswordExpiresAt,
    })
    .from(schema.referees)
    .where(eq(schema.referees.id, session.refereeId))
    .limit(1);

  const row = rows[0];
  if (!row || !row.active) return null;

  return {
    id: row.id,
    name: row.name,
    initials: row.initials,
    role: row.role,
    lastScreen: row.lastScreen,
    mustChangePassword: mustChangePassword(
      {
        ownPasswordSetAt: row.ownPasswordSetAt,
        startPasswordExpiresAt: row.startPasswordExpiresAt,
      },
      now,
    ),
  };
};
