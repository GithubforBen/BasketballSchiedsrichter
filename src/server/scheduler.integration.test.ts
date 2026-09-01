import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ensureLeagues } from '../../test/ligen';
import { runScheduler, previewScheduler } from './scheduler';

/**
 * Der ganze Lauf gegen eine echte Datenbank.
 *
 * Hier steht der Review-Fokus dieses Meilensteins: ein doppelter Cron-Lauf
 * bleibt folgenlos, die Nachrueck-Kaskade dreht sich von allein weiter, und
 * der Trockenlauf sagt vorher, was passieren wuerde — ohne dass eine Nachricht
 * rausgeht. Der Kanal steht in den Tests auf "dev" und verschickt nichts.
 */
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite('Nachrichtenlauf', () => {
  let sql: ReturnType<typeof postgres>;
  const prefix = `sched-test-${randomUUID().slice(0, 8)}`;
  const admin = `${prefix}-admin`;
  const r1 = `${prefix}-r1`;
  const r2 = `${prefix}-r2`;
  const sub = `${prefix}-sub`;
  const spare = `${prefix}-spare`;

  const letter = () => String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const initials = () => `${letter()}${letter()}${letter()}${letter()}`;

  const makeReferee = async (id: string, role: 'referee' | 'admin', reminders: number[] = []) => {
    await sql`INSERT INTO referees (id, name, first_name, license, initials, phone, role, reminder_hours)
      VALUES (${id}, ${`Person ${id.slice(-4)}`}, 'Person', 'D', ${initials()},
              ${`+4915${Math.floor(Math.random() * 1e9)}`}, ${role},
              ${JSON.stringify(reminders)}::jsonb)`;
    await sql`INSERT INTO qualifications (referee_id, league_id) VALUES (${id}, 'U14')`;
  };

  /** Ein Spiel mit Anpfiff in `hours` Stunden. */
  const makeGame = async (hours: number): Promise<string> => {
    const id = `${prefix}-${randomUUID().slice(0, 8)}`;
    await sql`INSERT INTO games (id, kickoff, league_id, home, away, venue)
      VALUES (${id}, now() + (${hours} * interval '1 hour'), 'U14',
              ${`${prefix} Heim`}, ${`${prefix} Gast`}, 'Halle 1')`;
    return id;
  };

  const assign = async (gameId: string, slotIndex: number, refereeId: string, claimedHoursAgo = 240) =>
    sql`INSERT INTO assignments (game_id, slot_index, referee_id, claimed_at)
      VALUES (${gameId}, ${slotIndex}, ${refereeId},
              now() - (${claimedHoursAgo} * interval '1 hour'))`;

  const outbox = async (gameId: string) =>
    sql<{ kind: string; recipient_id: string; key: string }[]>`
      SELECT kind, recipient_id, key FROM notification_outbox
      WHERE game_id = ${gameId} ORDER BY kind, recipient_id`;

  const offers = async (gameId: string) =>
    sql<{ id: string; referee_id: string; outcome: string; substitute_slot: number }[]>`
      SELECT id, referee_id, outcome, substitute_slot FROM promotion_offers
      WHERE game_id = ${gameId} ORDER BY created_at`;

  beforeAll(async () => {
    sql = postgres(url ?? '', { max: 10 });
    await ensureLeagues(sql);
    await makeReferee(admin, 'admin');
    await makeReferee(r1, 'referee', [24]);
    await makeReferee(r2, 'referee');
    await makeReferee(sub, 'referee');
    await makeReferee(spare, 'referee');
  });

  beforeEach(async () => {
    await sql`DELETE FROM games WHERE home LIKE ${`${prefix}%`}`;
  });

  afterAll(async () => {
    if (!sql) return;
    await sql`DELETE FROM games WHERE home LIKE ${`${prefix}%`}`;
    await sql`DELETE FROM notification_outbox WHERE recipient_id LIKE ${`${prefix}%`}`;
    await sql`DELETE FROM qualifications WHERE referee_id LIKE ${`${prefix}%`}`;
    await sql`DELETE FROM referees WHERE id LIKE ${`${prefix}%`}`;
    await sql.end();
  });

  describe('Ein doppelter Lauf bleibt folgenlos', () => {
    it('legt beim zweiten Mal keine einzige Nachricht mehr an', async () => {
      const game = await makeGame(70);
      await assign(game, 0, r1);
      await assign(game, 1, r2);

      await runScheduler();
      const after = await outbox(game);
      expect(after.length).toBeGreaterThan(0);

      const second = await runScheduler();
      expect(second.queued).toBe(0);
      expect(await outbox(game)).toHaveLength(after.length);
    });

    it('legt auch bei zwei gleichzeitigen Laeufen jede Nachricht nur einmal an', async () => {
      const game = await makeGame(70);
      await assign(game, 0, r1);
      await assign(game, 1, r2);

      await Promise.all([runScheduler(), runScheduler()]);

      const rows = await outbox(game);
      const keys = rows.map((row) => `${row.key}|${row.recipient_id}`);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });

  describe('Regel 10 — die Pflichtbestaetigung geht zum Vorlauf raus', () => {
    it('fragt beide Schiedsrichter, sobald der Vorlauf erreicht ist', async () => {
      const game = await makeGame(70);
      await assign(game, 0, r1);
      await assign(game, 1, r2);

      await runScheduler();
      const requests = (await outbox(game)).filter((r) => r.kind === 'confirmation-request');
      expect(requests.map((r) => r.recipient_id).sort()).toEqual([r1, r2].sort());
    });

    it('fragt vor dem Vorlauf noch niemanden', async () => {
      const game = await makeGame(200);
      await assign(game, 0, r1);
      await assign(game, 1, r2);

      await runScheduler();
      expect((await outbox(game)).filter((r) => r.kind === 'confirmation-request')).toHaveLength(0);
    });

    it('mahnt niemanden, der sich gerade erst eingetragen hat', async () => {
      /*
       * Anpfiff in 40 Stunden, Vorlauf 72: der Zeitpunkt der Anfrage liegt
       * zurueck. Wer sich jetzt eintraegt, darf trotzdem nur die Bitte
       * bekommen — nicht Bitte und Mahnung im selben Lauf.
       */
      const game = await makeGame(40);
      await assign(game, 0, r1, 0);

      await runScheduler();
      const kinds = (await outbox(game)).map((r) => r.kind);
      expect(kinds).toContain('confirmation-request');
      expect(kinds).not.toContain('confirmation-follow-up');
    });

    it('fasst nach, sobald die eigene Frist verstrichen ist', async () => {
      const game = await makeGame(40);
      await assign(game, 0, r1, 25);

      await runScheduler();
      const kinds = (await outbox(game)).map((r) => r.kind);
      expect(kinds).toContain('confirmation-follow-up');
    });

    it('schweigt, sobald bestaetigt wurde', async () => {
      const game = await makeGame(70);
      await assign(game, 0, r1);
      await assign(game, 1, r2);
      await sql`UPDATE assignments SET confirmed_at = now() WHERE game_id = ${game}`;

      await runScheduler();
      expect((await outbox(game)).filter((r) => r.kind === 'confirmation-request')).toHaveLength(0);
    });
  });

  describe('Regel 21 — die persoenliche Erinnerung', () => {
    it('geht raus, sobald ihr Vorlauf erreicht ist', async () => {
      const game = await makeGame(20);
      await assign(game, 0, r1);

      await runScheduler();
      const reminders = (await outbox(game)).filter((r) => r.kind === 'personal-reminder');
      expect(reminders).toHaveLength(1);
      expect(reminders[0]?.recipient_id).toBe(r1);
    });

    it('geht nicht raus, wenn sich die Person erst danach eingetragen hat', async () => {
      const game = await makeGame(20);
      await assign(game, 0, r1, 1);

      await runScheduler();
      expect((await outbox(game)).filter((r) => r.kind === 'personal-reminder')).toHaveLength(0);
    });
  });

  describe('Regeln 13 bis 15 — die Nachrueck-Kaskade dreht sich von allein', () => {
    it('fragt Ersatz 1, wenn ein Schiedsrichter-Platz offen ist', async () => {
      const game = await makeGame(70);
      await assign(game, 1, r2);
      await assign(game, 2, sub);

      const run = await runScheduler();
      expect(run.offered).toBe(1);

      const [offer] = await offers(game);
      expect(offer?.referee_id).toBe(sub);
      expect(offer?.outcome).toBe('pending');
      expect((await outbox(game)).filter((r) => r.kind === 'promotion-offer')).toHaveLength(1);
    });

    it('fragt waehrend der laufenden Frist niemanden zusaetzlich', async () => {
      const game = await makeGame(70);
      await assign(game, 1, r2);
      await assign(game, 2, sub);
      await assign(game, 3, spare);

      await runScheduler();
      await runScheduler();
      expect(await offers(game)).toHaveLength(1);
    });

    it('geht nach Fristablauf zu Ersatz 2 weiter', async () => {
      const game = await makeGame(70);
      await assign(game, 1, r2);
      await assign(game, 2, sub);
      await assign(game, 3, spare);

      await runScheduler();
      await sql`UPDATE promotion_offers SET respond_by = now() - interval '1 minute'
        WHERE game_id = ${game}`;

      const run = await runScheduler();
      expect(run.expired).toBe(1);

      const all = await offers(game);
      expect(all).toHaveLength(2);
      expect(all[0]?.outcome).toBe('expired');
      expect(all[1]?.referee_id).toBe(spare);
    });

    it('schreibt aus, wenn kein Ersatz mehr uebrig ist', async () => {
      const game = await makeGame(70);
      await assign(game, 1, r2);

      await runScheduler();
      const announcements = (await outbox(game)).filter(
        (r) => r.kind === 'open-slot-announcement',
      );
      expect(announcements.length).toBeGreaterThan(0);
      // Wer schon im Spiel steht, wird nicht angeschrieben.
      expect(announcements.map((r) => r.recipient_id)).not.toContain(r2);
    });

    it('gibt einer zweiten Luecke desselben Spiels eine eigene Ausschreibung', async () => {
      const game = await makeGame(70);
      await assign(game, 1, r2);
      await runScheduler();
      const first = (await outbox(game)).filter((r) => r.kind === 'open-slot-announcement');

      // Der Platz wird besetzt und wieder frei — eine neue Luecke.
      await assign(game, 0, r1);
      await sql`DELETE FROM assignments WHERE game_id = ${game} AND slot_index = 0`;
      await sql`UPDATE games SET vacancy_version = vacancy_version + 1 WHERE id = ${game}`;

      await runScheduler();
      const second = (await outbox(game)).filter((r) => r.kind === 'open-slot-announcement');
      expect(second.length).toBeGreaterThan(first.length);
    });
  });

  describe('Der Trockenlauf sagt vorher, was passieren wuerde', () => {
    it('nennt dieselben Nachrichten, legt aber keine an', async () => {
      const game = await makeGame(70);
      await assign(game, 0, r1);
      await assign(game, 1, r2);

      const preview = await previewScheduler();
      const mine = preview.filter((intent) => intent.gameId === game);
      expect(mine.length).toBeGreaterThan(0);
      expect(await outbox(game)).toHaveLength(0);

      await runScheduler();
      expect((await outbox(game)).length).toBeGreaterThan(0);
    });
  });

  describe('Abgesagte Spiele loesen nichts aus', () => {
    it('schweigt vollstaendig', async () => {
      const game = await makeGame(20);
      await assign(game, 0, r1);
      await sql`UPDATE games SET state = 'cancelled' WHERE id = ${game}`;

      await runScheduler();
      expect(await outbox(game)).toHaveLength(0);
    });
  });
});
