import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ensureLeagues } from '../../test/ligen';
import { saveExpenses, type ExpenseInput } from './expenses';

/**
 * Quittung: Angaben, Saetze, Gebuehren und Auswahl gegen eine echte Datenbank.
 * Laeuft nur mit TEST_DATABASE_URL (in der CI).
 */
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

const HOUR = 60 * 60 * 1000;

suite('Quittung', () => {
  let sql: ReturnType<typeof postgres>;
  const prefix = `rc-test-${randomUUID().slice(0, 8)}`;
  const anna = `${prefix}-anna`;
  const ben = `${prefix}-ben`;
  const cara = `${prefix}-cara`;
  const admin = `${prefix}-admin`;

  const asReferee = (id: string) => ({ id, role: 'referee' as const });
  const asAdmin = { id: admin, role: 'admin' as const };

  const empty: ExpenseInput = {
    travelMode: null,
    km: null,
    perDiemCents: null,
    otherCents: null,
    otherLabel: null,
  };

  const letter = () => String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const initials = () => `${letter()}${letter()}${letter()}${letter()}`;

  const makeReferee = async (id: string, role: 'referee' | 'admin' = 'referee') => {
    await sql`INSERT INTO referees (id, name, first_name, license, initials, phone, role)
              VALUES (${id}, ${`Person ${id.slice(-5)}`}, 'Person', 'D', ${initials()},
                      ${`+4915${Math.floor(Math.random() * 900000000 + 100000000)}`}, ${role})`;
  };

  /** Spiel mit Anpfiff vor `hours` Stunden (negativ: in der Zukunft). */
  const makeGame = async (hoursAgo: number, league = 'U14', state = 'scheduled') => {
    const id = `${prefix}-g-${randomUUID().slice(0, 8)}`;
    await sql`INSERT INTO games (id, kickoff, league_id, home, away, venue, state)
              VALUES (${id}, ${new Date(Date.now() - hoursAgo * HOUR)}, ${league},
                      'Heim', 'Gast', 'Halle', ${state})`;
    return id;
  };

  const assign = async (gameId: string, slot: number, refereeId: string) =>
    sql`INSERT INTO assignments (game_id, slot_index, referee_id)
        VALUES (${gameId}, ${slot}, ${refereeId})`;

  const stored = async (gameId: string, refereeId: string) => {
    const rows = await sql<{ km: number | null; travel_mode: string | null }[]>`
      SELECT km, travel_mode FROM assignment_expenses
      WHERE game_id = ${gameId} AND referee_id = ${refereeId}`;
    return rows[0] ?? null;
  };

  beforeAll(async () => {
    sql = postgres(url ?? '', { max: 5 });
    await ensureLeagues(sql);
    await makeReferee(anna);
    await makeReferee(ben);
    await makeReferee(cara);
    await makeReferee(admin, 'admin');
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

  describe('Angaben speichern', () => {
    // spec: schiri-quittung#referee-saves-travel-data
    it('speichert die eigenen Angaben eines kommenden Spiels', async () => {
      const g = await makeGame(-48);
      await assign(g, 1, anna);

      const result = await saveExpenses(asReferee(anna), g, anna, {
        ...empty,
        travelMode: 'alone',
        km: 42,
      });

      expect(result.ok).toBe(true);
      expect(await stored(g, anna)).toEqual({ km: 42, travel_mode: 'solo' });
    });

    // spec: schiri-quittung#referee-edits-after-the-game
    it('erlaubt die Aenderung nach dem Anpfiff', async () => {
      const g = await makeGame(5);
      await assign(g, 0, anna);
      await saveExpenses(asReferee(anna), g, anna, { ...empty, travelMode: 'alone', km: 10 });

      const result = await saveExpenses(asReferee(anna), g, anna, {
        ...empty,
        travelMode: 'alone',
        km: 55,
      });

      expect(result.ok).toBe(true);
      expect((await stored(g, anna))?.km).toBe(55);
    });

    // spec: schiri-quittung#substitute-slot-has-no-expense-form
    it('lehnt Angaben eines Ersatzplatzes ab', async () => {
      const g = await makeGame(5);
      await assign(g, 2, anna);

      const result = await saveExpenses(asReferee(anna), g, anna, { ...empty, km: 5 });

      expect(result.ok).toBe(false);
      expect(await stored(g, anna)).toBeNull();
    });

    it('lehnt Angaben eines abgesagten Spiels ab', async () => {
      const g = await makeGame(5, 'U14', 'cancelled');
      await assign(g, 0, anna);

      expect((await saveExpenses(asReferee(anna), g, anna, { ...empty, km: 5 })).ok).toBe(false);
    });

    // spec: schiri-quittung#invalid-input-is-rejected
    it('lehnt ungueltige Werte ab und behaelt die alten', async () => {
      const g = await makeGame(5);
      await assign(g, 0, anna);
      await saveExpenses(asReferee(anna), g, anna, { ...empty, travelMode: 'alone', km: 20 });

      const bad: ExpenseInput[] = [
        { ...empty, km: -1 },
        { ...empty, km: 2001 },
        { ...empty, km: 1.5 },
        { ...empty, perDiemCents: -100 },
        { ...empty, otherCents: 100000 },
        { ...empty, otherCents: 500, otherLabel: 'x'.repeat(41) },
      ];
      for (const input of bad) {
        const result = await saveExpenses(asReferee(anna), g, anna, input);
        expect(result.ok).toBe(false);
        expect(result.message.length).toBeGreaterThan(5);
      }
      expect(await stored(g, anna)).toEqual({ km: 20, travel_mode: 'solo' });
    });

    // spec: schiri-quittung#partner-expenses-are-read-only
    it('lehnt das Schreiben fuer den Partner ab', async () => {
      const g = await makeGame(5);
      await assign(g, 0, anna);
      await assign(g, 1, ben);
      await saveExpenses(asReferee(ben), g, ben, { ...empty, travelMode: 'alone', km: 30 });

      const result = await saveExpenses(asReferee(anna), g, ben, { ...empty, km: 99 });

      expect(result.ok).toBe(false);
      expect((await stored(g, ben))?.km).toBe(30);
    });

    // spec: schiri-quittung#admin-corrects-kilometres
    it('erlaubt einem Admin die Korrektur fremder Kilometer', async () => {
      const g = await makeGame(5);
      await assign(g, 1, ben);
      await saveExpenses(asReferee(ben), g, ben, { ...empty, travelMode: 'alone', km: 30 });

      const result = await saveExpenses(asAdmin, g, ben, {
        ...empty,
        travelMode: 'alone',
        km: 33,
      });

      expect(result.ok).toBe(true);
      expect((await stored(g, ben))?.km).toBe(33);
    });

    it('loescht die Angaben, wenn die Person das Spiel verlaesst', async () => {
      const g = await makeGame(-48);
      await assign(g, 0, cara);
      await saveExpenses(asReferee(cara), g, cara, { ...empty, travelMode: 'alone', km: 12 });
      expect(await stored(g, cara)).not.toBeNull();

      await sql`DELETE FROM assignments WHERE game_id = ${g} AND referee_id = ${cara}`;

      expect(await stored(g, cara)).toBeNull();
    });
  });
});
