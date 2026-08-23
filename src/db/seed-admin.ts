import { randomUUID } from 'node:crypto';
import { INITIAL_LEAGUES } from '@/config/club';
import { db, schema, sql } from './index';

/**
 * Legt den ersten Admin an.
 *
 * Konten legt sonst ausschliesslich der Admin an — dieser eine muss also von
 * aussen kommen. Aufruf:
 *   npm run seed:admin -- --name "Nele Baumann" --initials NB --phone "+4915722067"
 */
const arg = (flag: string): string | undefined => {
  const index = process.argv.indexOf(`--${flag}`);
  return index === -1 ? undefined : process.argv[index + 1];
};

const run = async (): Promise<void> => {
  const name = arg('name');
  const initials = arg('initials');
  const phone = arg('phone');

  if (!name || !initials || !phone) {
    throw new Error(
      'Aufruf: npm run seed:admin -- --name "Vorname Nachname" --initials XY --phone "+49..."',
    );
  }
  if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
    throw new Error(`Telefonnummer muss in E.164 stehen, z. B. +4915123456789 — bekommen: ${phone}`);
  }

  const leagues = await db.select({ id: schema.leagues.id }).from(schema.leagues);
  if (leagues.length === 0) {
    await db
      .insert(schema.leagues)
      .values(INITIAL_LEAGUES.map((league, index) => ({ id: league, name: league, sortOrder: index })));
  }

  const id = randomUUID();
  await db.insert(schema.referees).values({ id, name, initials, phone, role: 'admin' });
  await db
    .insert(schema.qualifications)
    .values(INITIAL_LEAGUES.map((leagueId) => ({ refereeId: id, leagueId })));
  await db.insert(schema.settings).values({ id: 1 }).onConflictDoNothing();
  await db
    .insert(schema.auditLog)
    .values({ id: randomUUID(), action: 'seed-admin', subjectId: id, detail: { name } });

  console.log(`Admin "${name}" (${initials}) angelegt. Anmeldung ueber ${phone}.`);
};

run()
  .then(() => sql.end())
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    await sql.end();
    process.exit(1);
  });
