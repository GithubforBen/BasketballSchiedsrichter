import { randomUUID } from 'node:crypto';
import { INITIAL_LEAGUES } from '@/config/club';
import { START_PASSWORD_VALID_DAYS, hasUsableStartPassword } from '@/domain/password';
import { applyStartPassword } from '@/server/auth/password-login';
import { normalisePhone } from '@/server/auth/phone';
import { db, schema, sql } from './index';

/**
 * Legt den ersten Admin an.
 *
 * Konten legt sonst ausschliesslich der Admin an — dieser eine muss also von
 * aussen kommen. Aufruf:
 *   npm run seed:admin -- --name "Nele Baumann" --initials NB --phone "0157 22067123"
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
      'Aufruf: npm run seed:admin -- --name "Vorname Nachname" --initials XY --phone "0151 ..."',
    );
  }
  /*
   * Regel 42: hier gilt dieselbe Nachsicht wie im Formular. Wer den ersten
   * Admin auf der Kommandozeile anlegt, soll die Nummer so eintippen duerfen,
   * wie sie im Telefonbuch steht.
   */
  const parsed = normalisePhone(phone);
  if (!parsed.ok) throw new Error(parsed.message);

  if (!hasUsableStartPassword(name)) {
    throw new Error(`Aus "${name}" laesst sich kein Start-Passwort bilden.`);
  }

  const leagues = await db.select({ id: schema.leagues.id }).from(schema.leagues);
  if (leagues.length === 0) {
    await db
      .insert(schema.leagues)
      .values(INITIAL_LEAGUES.map((league, index) => ({ id: league, name: league, sortOrder: index })));
  }

  const id = randomUUID();
  await db.insert(schema.referees).values({ id, name, initials, phone: parsed.phone, role: 'admin' });
  const start = await applyStartPassword(id, name);
  await db
    .insert(schema.qualifications)
    .values(INITIAL_LEAGUES.map((leagueId) => ({ refereeId: id, leagueId })));
  await db.insert(schema.settings).values({ id: 1 }).onConflictDoNothing();
  await db
    .insert(schema.auditLog)
    .values({ id: randomUUID(), action: 'seed-admin', subjectId: id, detail: { name } });

  console.log(
    `Admin "${name}" (${initials}) angelegt.\n` +
      `Anmeldung: ${parsed.phone} mit dem Start-Passwort "${start}".\n` +
      `Es gilt ${START_PASSWORD_VALID_DAYS} Tage und muss beim ersten Anmelden geaendert werden.`,
  );
};

run()
  .then(() => sql.end())
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    await sql.end();
    process.exit(1);
  });
