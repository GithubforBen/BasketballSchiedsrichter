import { eq } from 'drizzle-orm';
import { db, schema, sql } from '@/db';
import { normalisePhone, formatPhone } from '@/server/auth/phone';
import {
  issueRecoveryToken,
  listRecoveryTokens,
  revokeRecoveryToken,
} from '@/server/auth/recovery';

/**
 * Notzugaenge verwalten. Regel 41.
 *
 * Bewusst auf der Kommandozeile und nicht im Adminbereich: wer den Adminbereich
 * erreicht, braucht keinen Notzugang. Ein Knopf dafuer waere ausserdem ein
 * Knopf, mit dem sich ein uebernommenes Adminkonto dauerhaft festsetzen liesse.
 *
 *   npm run notzugang -- --neu --telefon "0157 220671" --notiz "Tresor"
 *   npm run notzugang -- --liste
 *   npm run notzugang -- --widerrufen <id>
 */

const arg = (flag: string): string | undefined => {
  const index = process.argv.indexOf(`--${flag}`);
  return index === -1 ? undefined : process.argv[index + 1];
};

const has = (flag: string): boolean => process.argv.includes(`--${flag}`);

const USAGE = [
  'Aufruf:',
  '  npm run notzugang -- --neu --telefon "0157 220671" [--notiz "Tresor Geschaeftsstelle"]',
  '  npm run notzugang -- --liste',
  '  npm run notzugang -- --widerrufen <id>',
].join('\n');

const issue = async (): Promise<void> => {
  const telefon = arg('telefon');
  if (!telefon) throw new Error(USAGE);

  const parsed = normalisePhone(telefon);
  if (!parsed.ok) throw new Error(parsed.message);

  const rows = await db
    .select({ id: schema.referees.id, name: schema.referees.name })
    .from(schema.referees)
    .where(eq(schema.referees.phone, parsed.phone))
    .limit(1);

  const referee = rows[0];
  if (!referee) throw new Error(`Kein Konto mit der Nummer ${formatPhone(parsed.phone)}.`);

  const { id, token } = await issueRecoveryToken(referee.id, arg('notiz') ?? '');

  console.log(
    [
      `Notzugang fuer ${referee.name} ausgestellt.`,
      '',
      `  Id:    ${id}`,
      `  Token: ${token}`,
      '',
      'Dieser Token steht hier zum ersten und letzten Mal — gespeichert ist nur eine',
      'Ableitung. Aufschreiben und dorthin legen, wo der Vereinsschluessel liegt.',
      '',
      'Eingeloest wird er unter /notzugang. Er gilt genau einmal und danach nicht mehr;',
      'widerrufen laesst er sich jederzeit mit --widerrufen.',
    ].join('\n'),
  );
};

const list = async (): Promise<void> => {
  const entries = await listRecoveryTokens();
  if (entries.length === 0) {
    console.log('Kein Notzugang ausgestellt.');
    return;
  }

  const state = (entry: (typeof entries)[number]): string => {
    if (entry.revokedAt) return `widerrufen ${entry.revokedAt.toISOString().slice(0, 10)}`;
    if (entry.usedAt) return `benutzt ${entry.usedAt.toISOString().slice(0, 10)}`;
    return 'gueltig';
  };

  for (const entry of entries) {
    console.log(
      [
        entry.id,
        entry.name.padEnd(20),
        state(entry).padEnd(22),
        entry.createdAt.toISOString().slice(0, 10),
        entry.label,
      ].join('  '),
    );
  }
};

const revoke = async (): Promise<void> => {
  const id = arg('widerrufen');
  if (!id) throw new Error(USAGE);
  const done = await revokeRecoveryToken(id);
  console.log(done ? `Notzugang ${id} widerrufen.` : `Nichts zu widerrufen: ${id}`);
};

const run = async (): Promise<void> => {
  if (has('neu')) return issue();
  if (has('liste')) return list();
  if (has('widerrufen')) return revoke();
  throw new Error(USAGE);
};

run()
  .then(() => sql.end())
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    await sql.end();
    process.exit(1);
  });
