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

/** Setzt die Besetzung aller Spiele auf den Ausgangszustand des Seeds zurück. */
export const resetAssignments = async (): Promise<void> => {
  await sql`DELETE FROM assignments`;
  await sql`DELETE FROM audit_log WHERE action LIKE 'assignment.%' OR action LIKE 'relocation.%'`;
  await sql`DELETE FROM notification_outbox WHERE kind <> 'login'`;
  await sql`UPDATE referees SET reminder_hours = '[]'::jsonb`;
};

/** Trägt eine Person direkt auf einem Platz ein — Aufbau, nicht Prüfung. */
export const placeReferee = async (
  gameId: string,
  slotIndex: number,
  refereeId: string,
): Promise<void> => {
  await sql`INSERT INTO assignments (game_id, slot_index, referee_id)
            VALUES (${gameId}, ${slotIndex}, ${refereeId})`;
};

/** Markiert ein Spiel als verschoben. */
export const markRelocated = async (gameId: string): Promise<void> => {
  await sql`UPDATE games SET state = 'moved', relocation_version = relocation_version + 1
            WHERE id = ${gameId}`;
};

/** Die Kürzel einer Person. */
export const initialsOf = async (refereeId: string): Promise<string> => {
  const rows = await sql<{ initials: string }[]>`
    SELECT initials FROM referees WHERE id = ${refereeId}`;
  return rows[0]?.initials ?? '';
};

/** Wie viele Erinnerungen eine Person gesetzt hat. */
export const reminderCount = async (refereeId: string): Promise<number> => {
  const rows = await sql<{ n: number }[]>`
    SELECT jsonb_array_length(reminder_hours)::int AS n FROM referees WHERE id = ${refereeId}`;
  return rows[0]?.n ?? 0;
};

/**
 * Setzt die Erinnerungen einer Person direkt.
 *
 * `sql.json` ist noetig: eine als Text uebergebene Zeichenkette landet als
 * JSON-Zeichenkette in der Spalte, nicht als Feld — die Spalte enthielte dann
 * einen Skalar statt einer Liste.
 */
export const setReminders = async (refereeId: string, hours: readonly number[]): Promise<void> => {
  await sql`UPDATE referees SET reminder_hours = ${sql.json([...hours])} WHERE id = ${refereeId}`;
};

/**
 * Legt ein Spiel mit bekanntem Abstand zum Anpfiff an.
 *
 * Tests, die von einer Frist abhaengen, duerfen sich nicht auf die Spiele des
 * Seeds verlassen: deren Abstand haengt vom heutigen Tag ab.
 */
export const createGame = async (
  id: string,
  daysAhead: number,
  league = 'U14',
): Promise<void> => {
  await sql`DELETE FROM games WHERE id = ${id}`;
  await sql`INSERT INTO games (id, kickoff, league_id, home, away, venue)
            VALUES (${id}, now() + ${`${daysAhead} days`}::interval, ${league},
                    'Testheim', 'Testgast', 'Testhalle')`;
};

export const dropGame = async (id: string): Promise<void> => {
  await sql`DELETE FROM games WHERE id = ${id}`;
};

/** Die Spiel-Ids der kommenden Spiele, nach Anpfiff sortiert. */
export const upcomingGameIds = async (): Promise<readonly string[]> => {
  const rows = await sql<{ id: string }[]>`
    SELECT id FROM games WHERE kickoff > now() AND state <> 'cancelled' ORDER BY kickoff`;
  return rows.map((row) => row.id);
};

/** Der Kalendertag eines Spiels in Vereinszeit, `YYYY-MM-DD`. */
export const dayKeyOfGame = async (gameId: string): Promise<string> => {
  const rows = await sql<{ day: string }[]>`
    SELECT to_char(kickoff AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD') AS day
    FROM games WHERE id = ${gameId}`;
  return rows[0]?.day ?? '';
};
