import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ensureLeagues } from '../../test/ligen';
import { deleteReferee } from './admin/referees';
import { applyRetention, DEFAULT_RETENTION } from './aufbewahrung';
import { applyStartPassword } from './auth/password-login';
import { buildDataExport, renderDataExport } from './auskunft';

/**
 * Loeschkonzept, Aufbewahrungsfristen und Auskunft gegen eine echte Datenbank.
 *
 * Diese drei stehen und fallen mit dem, was tatsaechlich in den Tabellen
 * passiert — eine reine Absichtserklaerung im Code hilft niemandem, der eine
 * Loeschung verlangt.
 */
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite('Datenschutz', () => {
  let sql: ReturnType<typeof postgres>;
  const prefix = `ds-test-${randomUUID().slice(0, 8)}`;
  const admin = `${prefix}-admin`;
  const zweiterAdmin = `${prefix}-admin2`;
  const person = `${prefix}-person`;

  const letter = () => String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const initials = () => `${letter()}${letter()}${letter()}${letter()}`;

  const makeReferee = async (id: string, role: 'referee' | 'admin' = 'referee') => {
    await sql`INSERT INTO referees (id, name, first_name, license, initials, phone, role, reminder_hours)
      VALUES (${id}, ${`Person ${id.slice(-6)}`}, 'Person', 'D', ${initials()},
              ${`+4915${Math.floor(Math.random() * 1e9)}`}, ${role}, '[24, 72]'::jsonb)
      ON CONFLICT (id) DO NOTHING`;
    await sql`INSERT INTO qualifications (referee_id, league_id) VALUES (${id}, 'U14')
      ON CONFLICT DO NOTHING`;
  };

  /** Ein Spiel in `hours` Stunden — negativ fuer ein vergangenes. */
  const makeGame = async (hours: number): Promise<string> => {
    const id = `${prefix}-${randomUUID().slice(0, 8)}`;
    await sql`INSERT INTO games (id, kickoff, league_id, home, away, venue)
      VALUES (${id}, now() + (${hours} * interval '1 hour'), 'U14',
              ${`${prefix} Heim`}, ${`${prefix} Gast`}, 'Halle 1')`;
    return id;
  };

  const assign = async (gameId: string, slotIndex: number, refereeId: string) =>
    sql`INSERT INTO assignments (game_id, slot_index, referee_id)
        VALUES (${gameId}, ${slotIndex}, ${refereeId})`;

  const count = async (table: string, where: string): Promise<number> => {
    const rows = await sql.unsafe<{ n: string }[]>(`SELECT count(*) AS n FROM ${table} ${where}`);
    return Number(rows[0]?.n ?? 0);
  };

  beforeAll(async () => {
    sql = postgres(url ?? '', { max: 10 });
    await ensureLeagues(sql);
  });

  beforeEach(async () => {
    await sql`DELETE FROM games WHERE home LIKE ${`${prefix}%`}`;
    await sql`DELETE FROM referees WHERE id LIKE ${`${prefix}%`}`;
    await makeReferee(admin, 'admin');
    await makeReferee(zweiterAdmin, 'admin');
    await makeReferee(person);
  });

  afterAll(async () => {
    if (!sql) return;
    await sql`DELETE FROM games WHERE home LIKE ${`${prefix}%`}`;
    await sql`DELETE FROM referees WHERE id LIKE ${`${prefix}%`}`;
    await sql.end();
  });

  describe('Löschkonzept', () => {
    it('entfernt die Person und alles, was an ihr hängt', async () => {
      const vergangen = await makeGame(-72);
      await assign(vergangen, 0, person);

      const result = await deleteReferee(admin, person);
      expect(result.ok).toBe(true);

      expect(await count('referees', `WHERE id = '${person}'`)).toBe(0);
      expect(await count('qualifications', `WHERE referee_id = '${person}'`)).toBe(0);
      expect(await count('assignments', `WHERE referee_id = '${person}'`)).toBe(0);
    });

    it('nimmt auch den vergangenen Einsatz mit — genau das heisst Löschen', async () => {
      const vergangen = await makeGame(-240);
      await assign(vergangen, 0, person);
      await sql`UPDATE assignments SET played_as_referee = true WHERE referee_id = ${person}`;

      await deleteReferee(admin, person);
      expect(await count('assignments', `WHERE game_id = '${vergangen}'`)).toBe(0);
    });

    it('schreibt einen künftig offenen Platz aus, statt ihn still zu leeren', async () => {
      const kuenftig = await makeGame(240);
      await assign(kuenftig, 0, person);

      const vorher = await sql<{ v: number }[]>`
        SELECT vacancy_version AS v FROM games WHERE id = ${kuenftig}`;
      await deleteReferee(admin, person);
      const nachher = await sql<{ v: number }[]>`
        SELECT vacancy_version AS v FROM games WHERE id = ${kuenftig}`;

      expect(nachher[0]?.v).toBe((vorher[0]?.v ?? 0) + 1);
    });

    it('zählt einen Ersatzplatz nicht als neue Lücke — für ihn wird nichts ausgeschrieben', async () => {
      const kuenftig = await makeGame(240);
      await assign(kuenftig, 2, person);

      const vorher = await sql<{ v: number }[]>`
        SELECT vacancy_version AS v FROM games WHERE id = ${kuenftig}`;
      await deleteReferee(admin, person);
      const nachher = await sql<{ v: number }[]>`
        SELECT vacancy_version AS v FROM games WHERE id = ${kuenftig}`;

      expect(nachher[0]?.v).toBe(vorher[0]?.v);
    });

    it('nennt in der Rückmeldung, wie viele Plätze dadurch offen sind', async () => {
      const kuenftig = await makeGame(240);
      await assign(kuenftig, 0, person);
      const result = await deleteReferee(admin, person);
      expect(result.message).toContain('ausgeschrieben');
    });

    it('lässt niemanden sein eigenes Konto löschen', async () => {
      const result = await deleteReferee(admin, admin);
      expect(result.ok).toBe(false);
      expect(await count('referees', `WHERE id = '${admin}'`)).toBe(1);
    });

    it('löscht einen stillgelegten Admin ohne Umstände — er zählt nicht mit', async () => {
      await sql`UPDATE referees SET active = false WHERE id = ${zweiterAdmin}`;
      expect((await deleteReferee(admin, zweiterAdmin)).ok).toBe(true);
    });

    it('schützt den letzten aktiven Admin', async () => {
      /*
       * Die Regel gilt vereinsweit, nicht nur für die Konten dieses Tests: in
       * der Datenbank stehen auch die Admins aus dem Seed. Für die Dauer der
       * Prüfung wird deshalb wirklich jeder andere stillgelegt und danach
       * genau so wiederhergestellt, wie er war.
       */
      const fremde = await sql<{ id: string }[]>`
        SELECT id FROM referees
        WHERE role = 'admin' AND active = true AND id NOT LIKE ${`${prefix}%`}`;
      await sql`UPDATE referees SET active = false
                WHERE role = 'admin' AND active = true AND id NOT LIKE ${`${prefix}%`}`;
      await sql`UPDATE referees SET active = false WHERE id = ${admin}`;

      try {
        const result = await deleteReferee(admin, zweiterAdmin);
        expect(result.ok).toBe(false);
        expect(result.message).toContain('letzte aktive Admin');
        expect(await count('referees', `WHERE id = '${zweiterAdmin}'`)).toBe(1);
      } finally {
        for (const row of fremde) {
          await sql`UPDATE referees SET active = true WHERE id = ${row.id}`;
        }
      }
    });

    it('hinterlässt den Vorgang im Prüfprotokoll, aber ohne Bezug zur Person', async () => {
      await deleteReferee(admin, person);
      const rows = await sql<{ action: string; subject_id: string | null }[]>`
        SELECT action, subject_id FROM audit_log WHERE subject_id = ${person}`;
      expect(rows[0]?.action).toBe('referee.delete');
      // Die Id bleibt, der Name nicht — sie führt ins Leere.
      expect(await count('referees', `WHERE id = '${person}'`)).toBe(0);
    });
  });

  describe('Aufbewahrungsfristen', () => {
    it('räumt abgelaufene Anmeldedaten weg', async () => {
      await sql`INSERT INTO login_tokens (id, referee_id, link_token_hash, code_hash, expires_at, created_at)
        VALUES (${`${prefix}-alt`}, ${person}, 'x', 'y', now(),
                now() - (${DEFAULT_RETENTION.loginTokensDays + 1} * interval '1 day'))`;
      await sql`INSERT INTO login_tokens (id, referee_id, link_token_hash, code_hash, expires_at, created_at)
        VALUES (${`${prefix}-neu`}, ${person}, 'x', 'y', now(), now())`;

      const result = await applyRetention(new Date());
      expect(result.loginTokens).toBeGreaterThanOrEqual(1);
      expect(await count('login_tokens', `WHERE id = '${prefix}-alt'`)).toBe(0);
      expect(await count('login_tokens', `WHERE id = '${prefix}-neu'`)).toBe(1);
    });

    it('lässt eine wartende Nachricht stehen, so alt sie auch ist', async () => {
      /*
       * Eine Zeile im Zustand `queued` ist eine Aufgabe, keine Erinnerung. Wer
       * sie mitlöscht, verliert einen Versand, statt Ballast abzuwerfen.
       */
      await sql`INSERT INTO notification_outbox (id, key, kind, channel, recipient_id, payload, state, send_after)
        VALUES (${`${prefix}-wartet`}, ${`${prefix}-k1`}, 'personal-reminder', 'dev', ${person},
                '{}'::jsonb, 'queued', now() - interval '400 days')`;

      await applyRetention(new Date());
      expect(await count('notification_outbox', `WHERE id = '${prefix}-wartet'`)).toBe(1);
    });

    it('räumt zugestellte und aufgegebene Nachrichten nach ihrer Frist weg', async () => {
      const alt = `now() - (${DEFAULT_RETENTION.outboxDays + 1} * interval '1 day')`;
      await sql.unsafe(`INSERT INTO notification_outbox
        (id, key, kind, channel, recipient_id, payload, state, send_after, sent_at)
        VALUES ('${prefix}-zu', '${prefix}-k2', 'personal-reminder', 'dev', '${person}',
                '{}'::jsonb, 'sent', ${alt}, ${alt})`);
      await sql.unsafe(`INSERT INTO notification_outbox
        (id, key, kind, channel, recipient_id, payload, state, send_after)
        VALUES ('${prefix}-auf', '${prefix}-k3', 'personal-reminder', 'dev', '${person}',
                '{}'::jsonb, 'failed', ${alt})`);

      await applyRetention(new Date());
      expect(await count('notification_outbox', `WHERE id IN ('${prefix}-zu', '${prefix}-auf')`)).toBe(0);
    });

    it('lässt eine frisch zugestellte Nachricht in Ruhe', async () => {
      await sql`INSERT INTO notification_outbox (id, key, kind, channel, recipient_id, payload, state, send_after, sent_at)
        VALUES (${`${prefix}-frisch`}, ${`${prefix}-k4`}, 'personal-reminder', 'dev', ${person},
                '{}'::jsonb, 'sent', now(), now())`;
      await applyRetention(new Date());
      expect(await count('notification_outbox', `WHERE id = '${prefix}-frisch'`)).toBe(1);
    });
  });

  describe('Auskunft', () => {
    it('nennt jede Tabelle, in der etwas zu dieser Person steht', async () => {
      const spiel = await makeGame(-48);
      await assign(spiel, 0, person);
      await sql`INSERT INTO notification_outbox (id, key, kind, channel, recipient_id, payload, state)
        VALUES (${`${prefix}-n`}, ${`${prefix}-k5`}, 'personal-reminder', 'dev', ${person},
                '{}'::jsonb, 'sent')`;
      await sql`INSERT INTO login_tokens (id, referee_id, link_token_hash, code_hash, expires_at)
        VALUES (${`${prefix}-t`}, ${person}, 'x', 'y', now())`;

      const data = await buildDataExport(person);
      expect(data).not.toBeNull();
      expect(data?.qualifikationen).toContain('U14');
      expect(data?.erinnerungen).toHaveLength(2);
      expect(data?.eintragungen).toHaveLength(1);
      expect(data?.nachrichten).toHaveLength(1);
      expect(data?.anmeldungen).toHaveLength(1);
    });

    it('nennt den Zustand des Passworts, nie das Passwort und nie seinen Hash', async () => {
      // Regel 39. Ein Auszug, der den Hash mitliefert, waere ein Auszug, aus
      // dem sich Passwoerter durchprobieren lassen — von jedem, dem die Datei
      // in die Haende faellt.
      await applyStartPassword(person, 'Test Person');
      const [row] = await sql<{ password_hash: string }[]>`
        SELECT password_hash FROM referees WHERE id = ${person}`;

      const data = await buildDataExport(person);
      expect(data?.person['Passwort']).toContain('Start-Passwort');

      const text = renderDataExport(data!);
      expect(text).not.toContain(row?.password_hash ?? 'kein-hash');
      expect(text).not.toContain('scrypt');
      expect(text).not.toContain('testperson');
    });

    it('gibt die Stammdaten vollständig heraus — auch die Telefonnummer', async () => {
      const [row] = await sql<{ phone: string; name: string }[]>`
        SELECT phone, name FROM referees WHERE id = ${person}`;
      const data = await buildDataExport(person);
      expect(data?.person['Telefonnummer']).toBe(row?.phone);
      expect(data?.person['Name']).toBe(row?.name);
    });

    it('ergibt eine lesbare Datei, in der keine Rubrik fehlt', async () => {
      const data = await buildDataExport(person);
      const text = renderDataExport(data!);
      for (const heading of [
        'Person',
        'Qualifikationen',
        'Persönliche Erinnerungen',
        'Eintragungen',
        'Nachrichten',
        'Anmeldungen',
        'Von Admins vorgenommene Änderungen',
      ]) {
        expect(text, `Rubrik "${heading}" fehlt`).toContain(heading);
      }
      expect(text).toContain('(nichts gespeichert)');
    });

    it('gibt für ein gelöschtes Konto nichts heraus', async () => {
      await deleteReferee(admin, person);
      expect(await buildDataExport(person)).toBeNull();
    });
  });
});
