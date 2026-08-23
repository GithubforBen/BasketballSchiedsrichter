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

import { CLUB } from '@/config/club';
import { SEED_GAMES, toKickoff } from '@/db/seed-data';

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

/**
 * Setzt Besetzung **und** Spieldaten auf den Ausgangszustand des Seeds zurück.
 *
 * Die Spieldaten gehören dazu, auch wenn es zunächst nach Besetzung klingt:
 * der Adminbereich verschiebt Spiele, sagt sie ab und zählt dabei
 * `relocation_version` und `vacancy_version` hoch. Blieben diese Änderungen
 * stehen, bestünde die Suite nur beim ersten Lauf gegen einen frischen Seed —
 * beim zweiten läge das erste Spiel schon auf der Zeit, auf die ein Test es
 * erst verschieben will, und der Test schlüge fehl, ohne dass sich am Code
 * etwas geändert hat.
 */
export const resetAssignments = async (): Promise<void> => {
  await sql`DELETE FROM assignments`;
  await sql`DELETE FROM audit_log WHERE action LIKE 'assignment.%' OR action LIKE 'relocation.%'`;
  await sql`DELETE FROM notification_outbox WHERE kind <> 'login'`;
  await sql`DELETE FROM promotion_offers`;
  await sql`UPDATE referees SET reminder_hours = '[]'::jsonb`;
  await resetGames();
};

/** Stellt Anpfiff, Ort, Zustand und Zähler jedes Seed-Spiels wieder her. */
export const resetGames = async (): Promise<void> => {
  const base = new Date();
  for (const game of SEED_GAMES) {
    await sql`UPDATE games SET
        kickoff = ${toKickoff(game, CLUB.timeZone, base)},
        venue = ${game.venue},
        state = ${game.state ?? 'scheduled'},
        relocation_version = 0,
        vacancy_version = 0,
        override_withdraw = false,
        override_substitute_request = false,
        override_one_game_per_day = false
      WHERE id = ${game.id}`;
  }
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

/** Entfernt alle Spiele, die ein Test angelegt hat. */
export const dropGamesLike = async (pattern: string): Promise<void> => {
  await sql`DELETE FROM games WHERE home LIKE ${pattern} OR away LIKE ${pattern}`;
};

/** Wie viele Spiele es gibt, deren Heimmannschaft zum Muster passt. */
export const countGamesLike = async (pattern: string): Promise<number> => {
  const rows = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM games WHERE home LIKE ${pattern}`;
  return rows[0]?.n ?? 0;
};

/** Die Einträge des Prüfprotokolls zu einer Aktion. */
export const auditCount = async (action: string): Promise<number> => {
  const rows = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM audit_log WHERE action = ${action}`;
  return rows[0]?.n ?? 0;
};

/** Setzt eine Qualifikation direkt. */
export const setQualificationDirect = async (
  refereeId: string,
  leagueId: string,
  on: boolean,
): Promise<void> => {
  if (on) {
    await sql`INSERT INTO qualifications (referee_id, league_id) VALUES (${refereeId}, ${leagueId})
              ON CONFLICT DO NOTHING`;
  } else {
    await sql`DELETE FROM qualifications
              WHERE referee_id = ${refereeId} AND league_id = ${leagueId}`;
  }
};

/** Ob eine Person für eine Liga qualifiziert ist. */
export const hasQualification = async (refereeId: string, leagueId: string): Promise<boolean> => {
  const rows = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM qualifications
    WHERE referee_id = ${refereeId} AND league_id = ${leagueId}`;
  return (rows[0]?.n ?? 0) > 0;
};

/** Setzt eine Einstellung zurück. */
export const resetSettings = async (): Promise<void> => {
  await sql`UPDATE settings SET withdraw_deadline_days = 21, substitute_request_deadline_days = 3,
            confirmation_lead_hours = 72, reminder_limit = 10 WHERE id = 1`;
};

/** Die Austragefrist aus den Einstellungen. */
export const withdrawDeadline = async (): Promise<number> => {
  const rows = await sql<{ d: number }[]>`
    SELECT withdraw_deadline_days AS d FROM settings WHERE id = 1`;
  return rows[0]?.d ?? 21;
};
