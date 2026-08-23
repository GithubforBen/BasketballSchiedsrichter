import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Integrationstests gegen eine echte Datenbank.
 *
 * Sie pruefen, was die Regel-Engine allein nicht garantieren kann: dass die
 * Datenbank First come, first served auch unter gleichzeitigem Zugriff haelt.
 * Ohne `TEST_DATABASE_URL` werden sie uebersprungen, damit `npm test` auch
 * ohne laufenden Postgres durchlaeuft.
 */
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite('Datenbank-Zusicherungen', () => {
  let sql: ReturnType<typeof postgres>;
  const gameId = `test-${randomUUID()}`;

  beforeAll(async () => {
    sql = postgres(url ?? '', { max: 5 });
    await sql`INSERT INTO leagues (id, name) VALUES ('TESTLIGA', 'Testliga')
              ON CONFLICT (id) DO NOTHING`;
    await sql`INSERT INTO games (id, kickoff, league_id, home, away, venue)
              VALUES (${gameId}, now() + interval '30 days', 'TESTLIGA', 'A', 'B', 'Halle')`;
    for (const suffix of ['a', 'b']) {
      await sql`INSERT INTO referees (id, name, initials, phone)
                VALUES (${`${gameId}-${suffix}`}, ${`Person ${suffix}`},
                        ${`T${suffix.toUpperCase()}${gameId.slice(-4)}`},
                        ${`+49${Date.now()}${suffix === 'a' ? 1 : 2}`})`;
    }
  });

  afterAll(async () => {
    await sql`DELETE FROM games WHERE id = ${gameId}`;
    await sql`DELETE FROM referees WHERE id LIKE ${`${gameId}%`}`;
    await sql.end();
  });

  it('Regel 3: zwei gleichzeitige Eintragungen auf denselben Platz — genau eine gewinnt', async () => {
    const claim = (refereeId: string) =>
      sql`INSERT INTO assignments (game_id, slot_index, referee_id)
          VALUES (${gameId}, 0, ${refereeId})`;

    const results = await Promise.allSettled([
      claim(`${gameId}-a`),
      claim(`${gameId}-b`),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);

    const rows = await sql`SELECT referee_id FROM assignments
                           WHERE game_id = ${gameId} AND slot_index = 0`;
    expect(rows).toHaveLength(1);
  });

  it('Regel 5: dieselbe Person kann keinen zweiten Platz im selben Spiel belegen', async () => {
    const holder = await sql`SELECT referee_id FROM assignments
                             WHERE game_id = ${gameId} AND slot_index = 0`;
    const refereeId = holder[0]?.referee_id as string;

    await expect(
      sql`INSERT INTO assignments (game_id, slot_index, referee_id)
          VALUES (${gameId}, 1, ${refereeId})`,
    ).rejects.toThrow();
  });

  it('Duplikaterkennung: dasselbe Spiel laesst sich nicht zweimal importieren', async () => {
    const row = await sql`SELECT kickoff, home, away FROM games WHERE id = ${gameId}`;
    const game = row[0];
    await expect(
      sql`INSERT INTO games (id, kickoff, league_id, home, away, venue)
          VALUES (${`${gameId}-dup`}, ${game?.kickoff as Date}, 'TESTLIGA',
                  ${game?.home as string}, ${game?.away as string}, 'Andere Halle')`,
    ).rejects.toThrow();
  });

  it('Outbox: dieselbe Nachricht geht nicht zweimal an dieselbe Person', async () => {
    const recipient = `${gameId}-a`;
    const insert = () =>
      sql`INSERT INTO notification_outbox (id, key, kind, channel, recipient_id, game_id, payload)
          VALUES (${randomUUID()}, ${`confirmation:${gameId}:x:initial`}, 'confirmation-request',
                  'dev', ${recipient}, ${gameId}, '{}'::jsonb)`;

    await insert();
    await expect(insert()).rejects.toThrow();
  });
});
