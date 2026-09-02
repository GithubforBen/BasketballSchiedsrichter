import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ensureLeagues } from '../../test/ligen';
import { personalReminderIntent, type NotificationIntent } from '@/domain/notifications';
import { PermanentSendError, type Channel, type OutgoingMessage } from '@/notifications/channel';
import { costUsedToday, dispatchOutbox, enqueue, retryDelayMinutes, MAX_ATTEMPTS } from './outbox';

/**
 * Die Outbox gegen eine echte Datenbank.
 *
 * Der Review-Fokus dieses Meilensteins steht hier: keine Doppelversendung bei
 * Neustart oder doppeltem Cron-Lauf, greifende Limits, und alles ohne eine
 * einzige echte Nachricht — der Kanal ist ein Zaehler.
 */
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite('Outbox', () => {
  let sql: ReturnType<typeof postgres>;
  const prefix = `outbox-test-${randomUUID().slice(0, 8)}`;
  const referee = `${prefix}-r`;
  const other = `${prefix}-o`;
  let gameId = '';

  /** Ein Kanal, der nichts verschickt, sondern mitschreibt. */
  const recorder = (): Channel & { sent: OutgoingMessage[] } => {
    const sent: OutgoingMessage[] = [];
    return {
      name: 'dev',
      sent,
      send: (message) => {
        sent.push(message);
        return Promise.resolve();
      },
    };
  };

  const failing = (error: Error): Channel => ({
    name: 'dev',
    send: () => Promise.reject(error),
  });

  const intent = (hoursBefore: number, recipient = referee): NotificationIntent => ({
    ...personalReminderIntent(gameId, recipient, hoursBefore),
  });

  const rowsOf = async (key: string) =>
    sql<
      { state: string; attempts: number; send_after: Date; last_error: string | null }[]
    >`SELECT state, attempts, send_after, last_error FROM notification_outbox WHERE key = ${key}`;

  beforeAll(async () => {
    sql = postgres(url ?? '', { max: 10 });
    await ensureLeagues(sql);
    for (const [id, initials] of [
      [referee, `${prefix.slice(-2).toUpperCase()}X`],
      [other, `${prefix.slice(-2).toUpperCase()}Y`],
    ] as const) {
      await sql`INSERT INTO referees (id, name, first_name, license, initials, phone, role)
        VALUES (${id}, ${`Person ${id}`}, 'Person', 'D', ${initials}, ${`+4915${Math.floor(Math.random() * 1e9)}`},
                'referee')`;
    }
    gameId = `${prefix}-game`;
    await sql`INSERT INTO games (id, kickoff, league_id, home, away, venue)
      VALUES (${gameId}, now() + interval '10 days', 'U14', ${`${prefix} Heim`},
              ${`${prefix} Gast`}, 'Halle 1')`;
  });

  beforeEach(async () => {
    await sql`DELETE FROM notification_outbox WHERE recipient_id IN (${referee}, ${other})`;
  });

  afterAll(async () => {
    if (!sql) return;
    await sql`DELETE FROM notification_outbox WHERE recipient_id IN (${referee}, ${other})`;
    await sql`DELETE FROM games WHERE id = ${gameId}`;
    await sql`DELETE FROM referees WHERE id IN (${referee}, ${other})`;
    await sql.end();
  });

  describe('Doppelter Cron-Lauf', () => {
    it('legt dieselbe Nachricht kein zweites Mal an', async () => {
      const { db } = await import('@/db');
      await enqueue(db, intent(24));
      await enqueue(db, intent(24));
      expect(await rowsOf(intent(24).key)).toHaveLength(1);
    });

    it('verschickt eine bereits zugestellte Nachricht nicht erneut', async () => {
      const { db } = await import('@/db');
      const channel = recorder();
      await enqueue(db, intent(24));
      await dispatchOutbox({ channel });
      await dispatchOutbox({ channel });
      expect(channel.sent).toHaveLength(1);
    });

    it('trennt zwei Empfaenger derselben Nachricht — beide sollen sie bekommen', async () => {
      const { db } = await import('@/db');
      const channel = recorder();
      await enqueue(db, { ...intent(24), recipientIds: [referee, other] });
      await dispatchOutbox({ channel });
      expect(channel.sent.map((m) => m.recipient.refereeId).sort()).toEqual(
        [referee, other].sort(),
      );
    });
  });

  describe('Zwei Laeufe gleichzeitig', () => {
    it('teilen sich die Arbeit, statt sie zu verdoppeln', async () => {
      const { db } = await import('@/db');
      for (const h of [1, 2, 3, 24, 48, 72]) await enqueue(db, intent(h));

      const first = recorder();
      const second = recorder();
      await Promise.all([
        dispatchOutbox({ channel: first }),
        dispatchOutbox({ channel: second }),
      ]);

      const keys = [...first.sent, ...second.sent].map((m) => m.key);
      expect(keys).toHaveLength(6);
      expect(new Set(keys).size).toBe(6);
    });
  });

  describe('Neustart mitten im Versand', () => {
    it('holt eine haengengebliebene Zeile nach ihrer Frist wieder ab', async () => {
      const { db } = await import('@/db');
      await enqueue(db, intent(24));
      await sql`UPDATE notification_outbox
        SET state = 'sending', attempts = 1, send_after = now() - interval '1 minute'
        WHERE key = ${intent(24).key}`;

      const channel = recorder();
      await dispatchOutbox({ channel });
      expect(channel.sent).toHaveLength(1);
    });

    it('laesst eine gerade laufende Zustellung in Ruhe', async () => {
      const { db } = await import('@/db');
      await enqueue(db, intent(24));
      await sql`UPDATE notification_outbox
        SET state = 'sending', attempts = 1, send_after = now() + interval '5 minutes'
        WHERE key = ${intent(24).key}`;

      const channel = recorder();
      await dispatchOutbox({ channel });
      expect(channel.sent).toHaveLength(0);
    });
  });

  describe('Regel 33 — was aussichtslos ist, wird nicht wiederholt', () => {
    it('legt eine voruebergehend gescheiterte Nachricht mit Abstand zurueck', async () => {
      const { db } = await import('@/db');
      await enqueue(db, intent(24));
      const result = await dispatchOutbox({ channel: failing(new Error('Netz weg')) });

      expect(result.retried).toBe(1);
      const [row] = await rowsOf(intent(24).key);
      expect(row?.state).toBe('queued');
      expect(row?.attempts).toBe(1);
      expect(row?.last_error).toContain('Netz weg');
      expect(row!.send_after.getTime()).toBeGreaterThan(Date.now());
    });

    it('gibt eine dauerhaft gescheiterte Nachricht sofort auf', async () => {
      const { db } = await import('@/db');
      await enqueue(db, intent(24));
      const result = await dispatchOutbox({
        channel: failing(new PermanentSendError('Nummer hat kein WhatsApp')),
      });

      expect(result.failed).toBe(1);
      expect((await rowsOf(intent(24).key))[0]?.state).toBe('failed');
    });

    it('gibt nach der letzten erlaubten Wiederholung auf', async () => {
      const { db } = await import('@/db');
      await enqueue(db, intent(24));
      await sql`UPDATE notification_outbox SET attempts = ${MAX_ATTEMPTS - 1}
        WHERE key = ${intent(24).key}`;

      const result = await dispatchOutbox({ channel: failing(new Error('Netz weg')) });
      expect(result.failed).toBe(1);
      expect((await rowsOf(intent(24).key))[0]?.state).toBe('failed');
    });

    it('waehlt wachsende Abstaende zwischen den Versuchen', () => {
      expect([1, 2, 3, 4, 5].map(retryDelayMinutes)).toEqual([1, 5, 25, 120, 120]);
    });
  });

  describe('Regel 33 — die Limits greifen', () => {
    it('verschickt je Lauf hoechstens so viele Nachrichten wie erlaubt', async () => {
      const { db } = await import('@/db');
      for (const h of [1, 2, 3, 24, 48]) await enqueue(db, intent(h));

      const channel = recorder();
      const result = await dispatchOutbox({ channel, maxMessages: 2 });
      expect(channel.sent).toHaveLength(2);
      expect(result.stoppedBy).toBe('run-limit');
    });

    it('haelt das Tagesbudget ein und meldet, dass es das war', async () => {
      const { db } = await import('@/db');
      for (const h of [1, 2, 3] as const) await enqueue(db, intent(h));

      /*
       * Das Budget wird vom bereits Verbrauchten aus gesetzt, nicht absolut.
       * Sonst haenge dieser Test daran, was andere Tests am selben Kalendertag
       * verschickt haben — der Zaehler laeuft ueber die ganze Datenbank.
       */
      const used = await costUsedToday(new Date());

      const channel = recorder();
      const first = await dispatchOutbox({ channel, dailyLimit: used + 1 });
      expect(channel.sent).toHaveLength(1);
      expect(first.stoppedBy).toBe('daily-limit');

      const second = await dispatchOutbox({ channel, dailyLimit: used + 1 });
      expect(channel.sent).toHaveLength(1);
      expect(second.stoppedBy).toBe('daily-limit');
    });

    it('haelt fest, ueber welchen Kanal die Nachricht ging', async () => {
      const { db } = await import('@/db');
      await enqueue(db, intent(24));
      await dispatchOutbox({ channel: { name: 'email', send: () => Promise.resolve() } });
      const [row] = await sql<{ channel: string; state: string }[]>`
        SELECT channel, state FROM notification_outbox WHERE key = ${intent(24).key}`;
      expect(row?.state).toBe('sent');
      expect(row?.channel).toBe('email');
    });

    it('zaehlt die verbrauchten Einheiten mit', async () => {
      const { db } = await import('@/db');
      await enqueue(db, { ...intent(24), recipientIds: [referee, other] });
      const result = await dispatchOutbox({ channel: recorder() });
      expect(result.cost).toBe(2);
    });
  });

  describe('Der Text entsteht erst beim Versand', () => {
    it('nennt den Termin, wie er jetzt gilt — nicht den vom Anlegen', async () => {
      const { db } = await import('@/db');
      await enqueue(db, intent(24));
      await sql`UPDATE games SET kickoff = now() + interval '20 days', venue = 'Neue Halle'
        WHERE id = ${gameId}`;

      const channel = recorder();
      await dispatchOutbox({ channel });
      expect(channel.sent[0]?.body).toContain('Neue Halle');

      await sql`UPDATE games SET kickoff = now() + interval '10 days', venue = 'Halle 1'
        WHERE id = ${gameId}`;
    });

    it('verschickt keine Nachricht einer Art, die es nicht mehr gibt', async () => {
      /*
       * Nach einem Umbau koennen alte Zeilen mit einer Art warten, die der
       * Code nicht mehr kennt. Sie einfach durchzureichen hiesse, eine
       * Nachricht ohne Betreff und ohne Inhalt zu verschicken — und die kostet
       * genauso viel wie eine gute.
       */
      const { db } = await import('@/db');
      await enqueue(db, intent(24));
      await sql`UPDATE notification_outbox SET kind = 'gibt-es-nicht-mehr'
        WHERE key = ${intent(24).key}`;

      const channel = recorder();
      const result = await dispatchOutbox({ channel });
      expect(channel.sent).toHaveLength(0);
      expect(result.failed).toBe(1);
      expect((await rowsOf(intent(24).key))[0]?.last_error).toContain('gibt-es-nicht-mehr');
    });

    it('nimmt die Nachricht mit, wenn die Person geloescht wird', async () => {
      /*
       * Die Outbox haengt per Fremdschluessel an der Person. Wer geloescht
       * wird, nimmt seine wartenden Nachrichten mit — es gibt niemanden mehr,
       * an den sie gehen koennten, und eine Nachricht an eine geloeschte Person
       * waere ein Datenschutzproblem, kein Zustellproblem.
       */
      const { db } = await import('@/db');
      const ghost = `${prefix}-ghost`;
      await sql`INSERT INTO referees (id, name, first_name, license, initials, phone)
        VALUES (${ghost}, 'Geist', 'Geist', 'D', ${`${prefix.slice(-2).toUpperCase()}Z`},
                ${`+4915${Math.floor(Math.random() * 1e9)}`})`;
      await enqueue(db, intent(24, ghost));
      expect(await rowsOf(intent(24, ghost).key)).toHaveLength(1);

      await sql`DELETE FROM referees WHERE id = ${ghost}`;
      expect(await rowsOf(intent(24, ghost).key)).toHaveLength(0);

      const channel = recorder();
      await dispatchOutbox({ channel });
      expect(channel.sent).toHaveLength(0);
    });
  });
});
