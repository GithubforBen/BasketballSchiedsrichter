import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import type { Viewer } from '@/domain/visibility';
import { env } from './env';
import { readSession, SESSION_COOKIE } from './session';

/**
 * Wer gerade schaut.
 *
 * Die Rolle wird aus der Datenbank nachgeladen und nicht dem Cookie geglaubt:
 * ein Konto, dem der Admin die Rolle entzogen hat, darf nicht bis zum Ablauf
 * der Sitzung weiter als Admin gelten.
 */

export interface CurrentUser {
  id: string;
  name: string;
  initials: string;
  role: 'referee' | 'admin';
  lastScreen: string | null;
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
  };
};

export const viewerOf = (user: CurrentUser | null): Viewer =>
  user === null
    ? { kind: 'anonymous' }
    : { kind: user.role === 'admin' ? 'admin' : 'referee', refereeId: user.id };
