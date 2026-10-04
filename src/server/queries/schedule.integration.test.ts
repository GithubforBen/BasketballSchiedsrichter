import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensureLeagues } from '../../../test/ligen';
import { gamesWithSlotsByIds, pastMatchdays, upcomingMatchdays } from './games';

/**
 * Das seitenweise Laden des oeffentlichen Spielplans.
 *
 * Der Grund dafuer steht in Zahlen: vierundfuenfzig Spiele an dreiundzwanzig
 * Tagen ergaben 320 kB HTML, die ein Handy erst laden und dann darstellen
 * muss. Geschnitten wird nach Spieltagen, nicht nach Spielen — ein halber
 * Spieltag waere eine seltsame Grenze.
 */
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite('Spielplan seitenweise', () => {
  let sql: ReturnType<typeof postgres>;
  const prefix = `plan-test-${randomUUID().slice(0, 8)}`;

  /** Anpfiff in `days` Tagen um `hour` Uhr UTC. */
  const at = (days: number, hour: number) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + days);
    date.setUTCHours(hour, 0, 0, 0);
    return date;
  };

  const addGame = async (kickoff: Date) => {
    await sql`INSERT INTO games (id, kickoff, league_id, league_label, home, away, venue)
              VALUES (${randomUUID()}, ${kickoff}, 'U14', 'XU14Bz',
                      ${`${prefix}-heim`}, ${`${prefix}-gast`}, 'Halle')`;
  };

  beforeAll(async () => {
    sql = postgres(url ?? '', { max: 5 });
    await ensureLeagues(sql);
    /*
     * Der Spielplan zaehlt alles, was ansteht — eine Vorauswahl nach Prefix
     * gibt es dabei nicht. Fuer feste Erwartungen muss die Tabelle also leer
     * anfangen. Das ist hier gefahrlos: `fileParallelism: false` in der
     * vitest-Konfiguration laesst die Integrationstests nacheinander laufen,
     * weil sie sich eine Datenbank teilen.
     */
    await sql`DELETE FROM games`;

    // Fuenf Spieltage, der dritte mit zwei Spielen.
    for (const day of [1, 2, 3, 4, 5]) await addGame(at(day, 10));
    await addGame(at(3, 14));
  });

  afterAll(async () => {
    if (!sql) return;
    await sql`DELETE FROM games WHERE home LIKE ${`${prefix}%`}`;
    await sql.end();
  });

  it('gibt ohne Grenze alle Spieltage', async () => {
    const page = await upcomingMatchdays(new Date());
    expect(page.matchdays).toHaveLength(5);
    expect(page.total).toBe(5);
  });

  it('schneidet nach Spieltagen und meldet, wie viele es insgesamt sind', async () => {
    const page = await upcomingMatchdays(new Date(), 2);
    expect(page.matchdays).toHaveLength(2);
    // Die Gesamtzahl muss auch dann stimmen, wenn nur ein Teil geladen wurde —
    // sonst wuesste die Seite nicht, ob sie "weitere" anbieten soll.
    expect(page.total).toBe(5);
  });

  it('nimmt einen Spieltag immer ganz', async () => {
    // Der dritte Tag hat zwei Spiele. Eine Grenze von drei Spieltagen bringt
    // also vier Spiele, nicht drei.
    const page = await upcomingMatchdays(new Date(), 3);
    expect(page.matchdays).toHaveLength(3);
    expect(page.matchdays.flatMap((day) => day.games)).toHaveLength(4);
    expect(page.matchdays[2]?.games).toHaveLength(2);
  });

  it('bleibt bei einer Grenze über dem Bestand vollständig', async () => {
    const page = await upcomingMatchdays(new Date(), 99);
    expect(page.matchdays).toHaveLength(5);
  });

  it('liefert die Spieltage in der Reihenfolge des Anpfiffs', async () => {
    const page = await upcomingMatchdays(new Date(), 5);
    const keys = page.matchdays.map((day) => day.key);
    expect([...keys].sort()).toEqual(keys);
  });
});

/**
 * Die vergangenen Spieltage fuer die Spieluebersicht der Angemeldeten.
 *
 * Wer zurueckblickt, sucht fast immer das letzte Wochenende — deshalb steht
 * der juengste Spieltag vorn, und innerhalb eines Tages bleibt die Reihenfolge
 * des Anpfiffs.
 */
suite('Vergangene Spieltage', () => {
  let sql: ReturnType<typeof postgres>;
  const prefix = `rueck-test-${randomUUID().slice(0, 8)}`;
  const ids: Record<string, string> = {};

  const at = (days: number, hour: number) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + days);
    date.setUTCHours(hour, 0, 0, 0);
    return date;
  };

  const addGame = async (name: string, kickoff: Date, state = 'scheduled') => {
    const id = randomUUID();
    ids[name] = id;
    await sql`INSERT INTO games (id, kickoff, league_id, league_label, home, away, venue, state)
              VALUES (${id}, ${kickoff}, 'U14', 'XU14Bz',
                      ${`${prefix}-${name}`}, ${`${prefix}-gast`}, 'Halle', ${state})`;
  };

  beforeAll(async () => {
    sql = postgres(url ?? '', { max: 5 });
    await ensureLeagues(sql);
    await sql`DELETE FROM games`;

    await addGame('vorgestern-frueh', at(-3, 9));
    await addGame('vorgestern-spaet', at(-3, 15));
    await addGame('gestern', at(-1, 10));
    await addGame('vor-fuenf-tagen', at(-5, 10));
    await addGame('abgesagt', at(-2, 10), 'cancelled');
    await addGame('morgen', at(1, 10));
  });

  afterAll(async () => {
    if (!sql) return;
    await sql`DELETE FROM games WHERE home LIKE ${`${prefix}%`}`;
    await sql.end();
  });

  it('stellt den juengsten Spieltag nach vorn', async () => {
    const days = await pastMatchdays(new Date());
    expect(days.map((day) => day.games.map((entry) => entry.game.home))).toEqual([
      [`${prefix}-gestern`],
      [`${prefix}-vorgestern-frueh`, `${prefix}-vorgestern-spaet`],
      [`${prefix}-vor-fuenf-tagen`],
    ]);
  });

  it('laesst abgesagte und kommende Spiele draussen', async () => {
    const homes = (await pastMatchdays(new Date())).flatMap((day) =>
      day.games.map((entry) => entry.game.home),
    );
    expect(homes).not.toContain(`${prefix}-abgesagt`);
    expect(homes).not.toContain(`${prefix}-morgen`);
  });

  it('laedt fuer den Kalender genau die verlangten Spiele samt allen vier Plaetzen', async () => {
    const wanted = [ids['gestern'] ?? '', ids['morgen'] ?? ''];
    const games = await gamesWithSlotsByIds(wanted);
    expect([...games.keys()].sort()).toEqual([...wanted].sort());
    expect(games.get(ids['morgen'] ?? '')?.slots).toHaveLength(4);
    expect((await gamesWithSlotsByIds([])).size).toBe(0);
  });
});
