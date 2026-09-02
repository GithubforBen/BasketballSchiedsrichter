import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ensureLeagues } from '../../test/ligen';
import { issueAnswerToken, type AnswerClaims } from '@/notifications/action-links';
import { openAnswer, readAnswer, submitAnswer } from './answers';
import { env } from './env';

/**
 * Der Weg vom Link in der Nachricht bis zur Bestaetigung — gegen eine echte
 * Datenbank.
 *
 * Der Kern ist die Eindeutigkeit: der Link bestaetigt genau das Spiel, um das
 * gebeten wurde, und beim zweiten Oeffnen sagt er, dass genau dieses Spiel
 * schon bestaetigt ist. Ein Link zu einem anderen Spiel darf dieses hier nicht
 * anfassen.
 */
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite('Antwortlinks', () => {
  let sql: ReturnType<typeof postgres>;
  const prefix = `antwort-test-${randomUUID().slice(0, 8)}`;
  const referee = `${prefix}-r`;
  const other = `${prefix}-o`;
  const gameId = `${prefix}-g`;
  const secondGameId = `${prefix}-g2`;

  const inDays = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

  const token = (over: Partial<AnswerClaims> = {}): string =>
    issueAnswerToken(
      {
        kind: 'confirm',
        gameId,
        refereeId: referee,
        reference: `confirmation:${gameId}:${referee}:initial`,
        expiresAt: inDays(30),
        ...over,
      },
      env.sessionSecret,
    );

  /** Liest den Token wieder ein — genau so, wie es die Seite tut. */
  const claimsOf = (value: string): AnswerClaims => {
    const check = readAnswer(value);
    if (!check.ok) throw new Error(check.message);
    return check.claims;
  };

  /*
   * Der Anpfiff unterscheidet die Spiele: (Anpfiff, Heim, Gast) ist der
   * natuerliche Schluessel, zwei Spiele mit denselben Angaben gibt es nicht.
   */
  const makeGame = async (id: string, days = 30) => {
    await sql`INSERT INTO games (id, kickoff, league_id, home, away, venue)
              VALUES (${id}, ${inDays(days)}, 'U14', 'Heim', 'Gast', 'Halle')`;
  };

  beforeAll(async () => {
    sql = postgres(url ?? '', { max: 5 });
    await ensureLeagues(sql);
    for (const [id, initials] of [
      [referee, `Q${prefix.slice(-2).toUpperCase()}A`],
      [other, `Q${prefix.slice(-2).toUpperCase()}B`],
    ] as const) {
      await sql`INSERT INTO referees (id, name, first_name, license, initials, phone)
                VALUES (${id}, ${`Person ${id}`}, 'Person', 'D', ${initials},
                        ${`+4915${Math.floor(Math.random() * 900000000 + 100000000)}`})`;
      await sql`INSERT INTO qualifications (referee_id, league_id) VALUES (${id}, 'U14')`;
    }
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

  const assign = async (id: string, slot: number, who = referee) => {
    await sql`INSERT INTO assignments (game_id, slot_index, referee_id)
              VALUES (${id}, ${slot}, ${who})`;
  };

  it('bestätigt genau das Spiel, um das gebeten wurde', async () => {
    await makeGame(gameId);
    await makeGame(secondGameId, 31);
    await assign(gameId, 0);
    await assign(secondGameId, 0);

    const result = await submitAnswer(claimsOf(token()), 'confirm');
    expect(result.ok).toBe(true);

    const rows = await sql<{ game_id: string; confirmed_at: Date | null }[]>`
      SELECT game_id, confirmed_at FROM assignments
      WHERE referee_id = ${referee} ORDER BY game_id`;
    const confirmed = rows.filter((row) => row.confirmed_at !== null).map((row) => row.game_id);
    expect(confirmed).toEqual([gameId]);
  });

  it('sagt beim zweiten Öffnen, dass genau dieses Spiel schon bestätigt ist', async () => {
    await makeGame(gameId);
    await assign(gameId, 0);

    const claims = claimsOf(token());
    const before = await openAnswer(claims);
    expect(before.ok && before.question.state).toBe('open');

    await submitAnswer(claims, 'confirm');

    const after = await openAnswer(claims);
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.question.state).toBe('answered');
    expect(after.question.status).toContain('bereits bestätigt');
  });

  it('hält im Prüfprotokoll fest, auf welche Nachricht hin bestätigt wurde', async () => {
    await makeGame(gameId);
    await assign(gameId, 0);
    await submitAnswer(claimsOf(token({ reference: 'confirmation:x:y:follow-up' })), 'confirm');

    const rows = await sql<{ detail: { via?: string } }[]>`
      SELECT detail FROM audit_log
      WHERE game_id = ${gameId} AND action = 'assignment.confirm'`;
    expect(rows[0]?.detail.via).toBe('confirm:confirmation:x:y:follow-up');
  });

  it('nimmt eine Antwort nicht an, die nicht zum Link gehört', async () => {
    await makeGame(gameId);
    await assign(gameId, 0);
    const result = await submitAnswer(claimsOf(token()), 'decline');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('passt nicht');
  });

  it('erklärt einen Ersatzplatz, statt eine Bestätigung vorzutäuschen', async () => {
    await makeGame(gameId);
    await assign(gameId, 2);
    const lookup = await openAnswer(claimsOf(token()));
    expect(lookup.ok).toBe(true);
    if (!lookup.ok) return;
    expect(lookup.question.state).toBe('closed');
    expect(lookup.question.status).toContain('Ersatzplatz');
  });

  it('merkt, wenn die Person gar nicht mehr eingetragen ist', async () => {
    await makeGame(gameId);
    const lookup = await openAnswer(claimsOf(token()));
    expect(lookup.ok).toBe(true);
    if (!lookup.ok) return;
    expect(lookup.question.state).toBe('closed');
    expect(lookup.question.status).toContain('nicht mehr eingetragen');
  });

  it('führt bei einem abgesagten Spiel zu nichts mehr', async () => {
    await makeGame(gameId);
    await assign(gameId, 0);
    await sql`UPDATE games SET state = 'cancelled' WHERE id = ${gameId}`;
    const lookup = await openAnswer(claimsOf(token()));
    expect(lookup.ok && lookup.question.state).toBe('closed');
  });

  it('nimmt die Rückmeldung zu einer Verschiebung genau einmal an', async () => {
    await makeGame(gameId);
    await assign(gameId, 0);
    await sql`UPDATE games SET relocation_version = 1, state = 'moved' WHERE id = ${gameId}`;

    const claims = claimsOf(
      token({ kind: 'relocation', reference: `relocation:${gameId}:1` }),
    );
    expect((await openAnswer(claims)).ok).toBe(true);
    const result = await submitAnswer(claims, 'keep');
    expect(result.ok).toBe(true);

    const after = await openAnswer(claims);
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.question.state).toBe('answered');
  });
});
