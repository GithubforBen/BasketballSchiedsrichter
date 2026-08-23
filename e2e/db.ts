import postgres from 'postgres';

/**
 * Direkter Datenbankzugriff für die E2E-Tests.
 *
 * Die Nachricht wird hier aus der Outbox gelesen und nicht über /dev/outbox:
 * diese Seite ist im Produktionsbetrieb bewusst nicht erreichbar, und die
 * E2E-Suite läuft gegen genau den Produktionsbuild, der auch ausgeliefert wird.
 *
 * Das Zurücksetzen der Rate-Limits ist Testaufbau, keine Abschwächung: die
 * Anmeldung erlaubt drei Anfragen je Nummer in fünfzehn Minuten, und eine Suite
 * mit mehreren Anmeldungen würde sonst an der eigenen Schutzmaßnahme scheitern.
 */

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL fehlt — die E2E-Tests brauchen dieselbe Datenbank wie die App.');

const sql = postgres(url, { max: 2 });

export const resetLoginState = async (): Promise<void> => {
  await sql`DELETE FROM rate_limits WHERE key LIKE 'login:%'`;
  await sql`DELETE FROM login_tokens`;
  await sql`DELETE FROM notification_outbox WHERE kind = 'login'`;
};

export interface LoginMessage {
  link: string;
  code: string;
}

/** Link und Code aus der zuletzt abgelegten Anmeldenachricht. */
export const latestLoginMessage = async (): Promise<LoginMessage> => {
  const rows = await sql<{ body: string | null }[]>`
    SELECT payload->>'body' AS body FROM notification_outbox
    WHERE kind = 'login' ORDER BY send_after DESC LIMIT 1`;
  const body = rows[0]?.body ?? '';
  const link = /https?:\/\/\S+/.exec(body)?.[0] ?? '';
  const code = /Code ein: (\d{6})/.exec(body)?.[1] ?? '';
  if (!link || !code) {
    throw new Error(`Anmeldenachricht ohne Link oder Code:\n${body || '(keine Nachricht)'}`);
  }
  return { link, code };
};

/** Ob überhaupt eine Anmeldenachricht abgelegt wurde. */
export const loginMessageCount = async (): Promise<number> => {
  const rows = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM notification_outbox WHERE kind = 'login'`;
  return rows[0]?.n ?? 0;
};

export const closeDb = async (): Promise<void> => {
  await sql.end();
};
