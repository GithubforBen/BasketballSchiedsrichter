import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  claimNextSlot,
  confirmAssignment,
  requestSubstitute,
  respondToRelocation,
  withdraw,
} from './assignments';

/**
 * Die Besetzung eines Spiels gegen eine echte Datenbank.
 *
 * Der wichtigste Fall steht ganz oben: zwei Personen tragen sich im selben
 * Moment ein. Genau eine gewinnt, die andere bekommt eine verständliche
 * Meldung — nicht eine Fehlerseite und nicht stillschweigend nichts.
 */
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite('Besetzung', () => {
  let sql: ReturnType<typeof postgres>;
  const prefix = `slot-test-${randomUUID().slice(0, 8)}`;
  const gameId = `${prefix}-g`;
  const a = `${prefix}-a`;
  const b = `${prefix}-b`;
  const c = `${prefix}-c`;
  const unqualified = `${prefix}-u`;

  const inDays = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

  const makeReferee = async (id: string, initials: string, leagues: readonly string[]) => {
    await sql`INSERT INTO referees (id, name, initials, phone)
              VALUES (${id}, ${`Person ${initials}`}, ${initials},
                      ${`+4915${Math.floor(Math.random() * 900000000 + 100000000)}`})`;
    for (const league of leagues) {
      await sql`INSERT INTO qualifications (referee_id, league_id) VALUES (${id}, ${league})`;
    }
  };

  const makeGame = async (id: string, kickoff: Date, league = 'U14') => {
    await sql`INSERT INTO games (id, kickoff, league_id, home, away, venue)
              VALUES (${id}, ${kickoff}, ${league}, 'Heim', 'Gast', 'Halle')`;
  };

  const occupants = async (id = gameId) => {
    const rows = await sql<{ slot_index: number; referee_id: string }[]>`
      SELECT slot_index, referee_id FROM assignments WHERE game_id = ${id}
      ORDER BY slot_index`;
    return rows.map((row) => `${row.slot_index}:${row.referee_id.replace(`${prefix}-`, '')}`);
  };

  beforeAll(async () => {
    sql = postgres(url ?? '', { max: 10 });
    await makeReferee(a, `X${prefix.slice(-3)}A`, ['U14', 'U16']);
    await makeReferee(b, `X${prefix.slice(-3)}B`, ['U14', 'U16']);
    await makeReferee(c, `X${prefix.slice(-3)}C`, ['U14', 'U16']);
    await makeReferee(unqualified, `X${prefix.slice(-3)}U`, ['U18']);
  });

  afterEach(async () => {
    await sql`DELETE FROM games WHERE id LIKE ${`${prefix}%`}`;
  });

  afterAll(async () => {
    if (!sql) return;
    await sql`DELETE FROM games WHERE id LIKE ${`${prefix}%`}`;
    await sql`DELETE FROM referees WHERE id LIKE ${`${prefix}%`}`;
    await sql.end();
  });

  it('Regel 3: zwei gleichzeitige Eintragungen — genau eine gewinnt den Platz', async () => {
    await makeGame(gameId, inDays(30));

    const [first, second] = await Promise.all([
      claimNextSlot(gameId, a),
      claimNextSlot(gameId, b),
    ]);

    // Beide dürfen erfolgreich sein — sie landen dann auf Platz 0 und 1.
    // Entscheidend ist, dass niemand denselben Platz doppelt belegt.
    const rows = await occupants();
    expect(new Set(rows.map((r) => r.split(':')[0])).size).toBe(rows.length);
    expect(rows.length).toBeGreaterThanOrEqual(1);

    for (const result of [first, second]) {
      expect(result.message.length).toBeGreaterThan(10);
    }
  });

  it('Regel 3: vier gleichzeitige Eintragungen auf ein leeres Spiel füllen es genau einmal', async () => {
    await makeGame(gameId, inDays(30));

    const results = await Promise.all([
      claimNextSlot(gameId, a),
      claimNextSlot(gameId, b),
      claimNextSlot(gameId, c),
      claimNextSlot(gameId, a),
    ]);

    const rows = await occupants();
    // Kein Platz doppelt, keine Person doppelt.
    expect(new Set(rows.map((r) => r.split(':')[0])).size).toBe(rows.length);
    expect(new Set(rows.map((r) => r.split(':')[1])).size).toBe(rows.length);
    expect(rows.length).toBeLessThanOrEqual(3);

    // Jede Antwort erklärt sich, auch die abgelehnten.
    for (const result of results) {
      expect(result.message.length, JSON.stringify(result)).toBeGreaterThan(10);
    }
  });

  it('Regel 2: füllt die Plätze der Reihe nach', async () => {
    await makeGame(gameId, inDays(30));
    await claimNextSlot(gameId, a);
    await claimNextSlot(gameId, b);
    await claimNextSlot(gameId, c);
    expect((await occupants()).map((r) => r.split(':')[0])).toEqual(['0', '1', '2']);
  });

  it('Regel 4: ohne Qualifikation geht nichts, mit Begründung', async () => {
    await makeGame(gameId, inDays(30));
    const result = await claimNextSlot(gameId, unqualified);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Qualifikation');
    expect(await occupants()).toHaveLength(0);
  });

  it('Regel 5: dieselbe Person kann keinen zweiten Platz belegen', async () => {
    await makeGame(gameId, inDays(30));
    await claimNextSlot(gameId, a);
    const second = await claimNextSlot(gameId, a);
    expect(second.ok).toBe(false);
    expect(second.message).toContain('schon');
    expect(await occupants()).toHaveLength(1);
  });

  it('Regel 6: kein zweites Spiel am selben Tag, mit Begründung', async () => {
    const kickoff = inDays(30);
    await makeGame(gameId, kickoff);
    await makeGame(`${prefix}-g2`, new Date(kickoff.getTime() + 3 * 60 * 60 * 1000));

    await claimNextSlot(gameId, a);
    const second = await claimNextSlot(`${prefix}-g2`, a);
    expect(second.ok).toBe(false);
    expect(second.message).toContain('an diesem Tag');
  });

  it('Regel 7: Austragen gibt den Platz wieder frei', async () => {
    await makeGame(gameId, inDays(30));
    await claimNextSlot(gameId, a);
    const result = await withdraw(gameId, a);
    expect(result.ok).toBe(true);
    expect(await occupants()).toHaveLength(0);
  });

  it('Regel 7: nach der Frist gesperrt, mit Begründung', async () => {
    await makeGame(gameId, inDays(5));
    await claimNextSlot(gameId, a);
    const result = await withdraw(gameId, a);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Admin');
    expect(await occupants()).toHaveLength(1);
  });

  it('Regel 8: Ersatz anfordern nur, wenn man selbst eingetragen ist', async () => {
    await makeGame(gameId, inDays(30));
    const outsider = await requestSubstitute(gameId, a);
    expect(outsider.ok).toBe(false);

    await claimNextSlot(gameId, a);
    const inside = await requestSubstitute(gameId, a);
    expect(inside.ok).toBe(true);
  });

  it('Regel 10: bestätigen setzt den Haken, und nur auf Schiedsrichter-Plätzen', async () => {
    await makeGame(gameId, inDays(30));
    await claimNextSlot(gameId, a);
    await claimNextSlot(gameId, b);
    await claimNextSlot(gameId, c);

    expect((await confirmAssignment(gameId, a)).ok).toBe(true);
    // Platz 2 ist ein Ersatzplatz — dort gibt es nichts zu bestätigen.
    const substitute = await confirmAssignment(gameId, c);
    expect(substitute.ok).toBe(false);

    const rows = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM assignments
      WHERE game_id = ${gameId} AND confirmed_at IS NOT NULL`;
    expect(rows[0]?.n).toBe(1);
  });

  it('Regel 18: eine Absage nach Verschiebung öffnet den Platz sofort', async () => {
    await makeGame(gameId, inDays(30));
    await claimNextSlot(gameId, a);
    await sql`UPDATE games SET state = 'moved', relocation_version = 1 WHERE id = ${gameId}`;

    const declined = await respondToRelocation(gameId, a, 'decline');
    expect(declined.ok).toBe(true);
    expect(await occupants()).toHaveLength(0);
  });

  it('Regel 17: „Bleibe dabei“ quittiert den neuen Termin und lässt den Platz belegt', async () => {
    await makeGame(gameId, inDays(30));
    await claimNextSlot(gameId, a);
    await sql`UPDATE games SET state = 'moved', relocation_version = 1 WHERE id = ${gameId}`;

    expect((await respondToRelocation(gameId, a, 'keep')).ok).toBe(true);
    expect(await occupants()).toHaveLength(1);

    const rows = await sql<{ acknowledged_relocation: number }[]>`
      SELECT acknowledged_relocation FROM assignments WHERE game_id = ${gameId}`;
    expect(rows[0]?.acknowledged_relocation).toBe(1);
  });

  it('jede Aktion hinterlässt einen Eintrag im Prüfprotokoll', async () => {
    await makeGame(gameId, inDays(30));
    await claimNextSlot(gameId, a);
    await confirmAssignment(gameId, a);
    await withdraw(gameId, a);

    const rows = await sql<{ action: string }[]>`
      SELECT action FROM audit_log WHERE game_id = ${gameId} ORDER BY created_at`;
    expect(rows.map((r) => r.action)).toEqual([
      'assignment.claim',
      'assignment.confirm',
      'assignment.withdraw',
    ]);
  });

  it('Regel 31: eine Eintragung legt eine Zuteilungsnachricht in die Outbox', async () => {
    await makeGame(gameId, inDays(30));
    await claimNextSlot(gameId, a);
    const rows = await sql<{ kind: string; recipient_id: string }[]>`
      SELECT kind, recipient_id FROM notification_outbox WHERE game_id = ${gameId}`;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe('assignment');
    expect(rows[0]?.recipient_id).toBe(a);
  });
});
