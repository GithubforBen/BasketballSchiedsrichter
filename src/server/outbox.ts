import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import { CLUB } from '@/config/club';
import { db, schema } from '@/db';
import { isNotificationKind, type NotificationIntent } from '@/domain/notifications';
import { activeChannel, isPermanent, type Channel } from '@/notifications/channel';
import { renderMessage } from '@/notifications/templates';
import { startOfLocalDay } from '@/domain/time';
import { toGame } from './queries/games';
import { env } from './env';

/**
 * Die Outbox: der einzige Weg nach draussen.
 *
 * Drei Eigenschaften traegt sie, und alle drei kosten sonst Geld (Regel 33):
 *
 * 1. Was doppelt entsteht, geht einmal raus. Der Idempotenzschluessel liegt als
 *    eindeutiger Index auf (key, recipient_id) — ein doppelter Cron-Lauf, ein
 *    Neustart mitten im Lauf oder zwei gleichzeitige Prozesse legen dieselbe
 *    Zeile schlicht kein zweites Mal an.
 * 2. Was gleichzeitig abgeholt wird, geht einmal raus. Der Versand holt seine
 *    Zeilen mit FOR UPDATE SKIP LOCKED und setzt sie im selben Zug auf
 *    `sending` — zwei parallele Laeufe teilen sich die Arbeit, statt sie zu
 *    verdoppeln.
 * 3. Was aussichtslos ist, wird nicht wiederholt, und was viel ist, wird
 *    gedeckelt.
 */

/** Hoechstzahl Versuche je Nachricht, bevor sie endgueltig aufgegeben wird. */
export const MAX_ATTEMPTS = 5;

/** Wie lange eine begonnene Zustellung laufen darf, bevor sie neu abgeholt wird. */
export const CLAIM_TIMEOUT_MINUTES = 5;

/** Hoechstzahl Nachrichten je Lauf. Eine Schleife soll nicht das Budget leeren. */
export const MAX_MESSAGES_PER_RUN = 200;

/** Hoechstzahl Nachrichteneinheiten je Kalendertag. Regel 33. */
export const DAILY_COST_LIMIT = 1000;

/**
 * Wartezeit bis zum naechsten Versuch, in Minuten: 1, 5, 25, 120.
 * Der Abstand waechst, damit eine laengere Stoerung nicht in Dauerfeuer endet.
 */
export const retryDelayMinutes = (attempts: number): number =>
  [1, 5, 25, 120][Math.min(attempts, 4) - 1] ?? 120;

type Writer = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Legt eine Absicht in die Outbox — eine Zeile je Empfaenger.
 *
 * `onConflictDoNothing` ist hier die ganze Doppelversand-Sicherung: derselbe
 * Schluessel fuer dieselbe Person entsteht kein zweites Mal.
 *
 * Zurueck kommt, wie viele Zeilen tatsaechlich entstanden sind — nicht, wie
 * viele geplant waren. Der Unterschied ist der ganze Punkt: ein zweiter
 * Cron-Lauf plant dasselbe und legt nichts an, und genau das soll die Zahl
 * zeigen, statt einen Versand vorzutaeuschen.
 */
export const enqueue = async (writer: Writer, intent: NotificationIntent): Promise<number> => {
  if (intent.recipientIds.length === 0) return 0;
  const channel = env.channel;
  const inserted = await writer
    .insert(schema.notificationOutbox)
    .values(
      intent.recipientIds.map((recipientId) => ({
        id: randomUUID(),
        key: intent.key,
        kind: intent.kind,
        channel,
        recipientId,
        gameId: intent.gameId,
        payload: intent.payload,
        costUnits: 1,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: schema.notificationOutbox.id });
  return inserted.length;
};

export const enqueueAll = async (
  writer: Writer,
  intents: readonly NotificationIntent[],
): Promise<number> => {
  let queued = 0;
  for (const intent of intents) {
    queued += await enqueue(writer, intent);
  }
  return queued;
};

export interface DispatchResult {
  /** Erfolgreich zugestellt. */
  sent: number;
  /** Fehlgeschlagen und fuer einen weiteren Versuch zurueckgelegt. */
  retried: number;
  /** Endgueltig aufgegeben. */
  failed: number;
  /** Verbrauchte Nachrichteneinheiten. Regel 33. */
  cost: number;
  /**
   * Ob eine Grenze erreicht wurde. `run-limit` und `daily-limit` heissen: der
   * Lauf hat so viel verschickt, wie er durfte. Ob dahinter noch etwas wartet,
   * sagt erst der naechste Lauf — das nachzuzaehlen kostete eine weitere
   * Abfrage fuer eine Auskunft, auf die niemand handelt.
   */
  stoppedBy: 'nothing-due' | 'run-limit' | 'daily-limit';
}

interface ClaimedRow {
  id: string;
  key: string;
  kind: string;
  recipient_id: string;
  game_id: string | null;
  payload: Record<string, unknown>;
  attempts: number;
  cost_units: number;
}

/**
 * Verbrauchte Einheiten seit Mitternacht Vereinszeit.
 *
 * Bewusst gegen die Datenbank gezaehlt und nicht im Speicher gehalten: ein
 * Neustart darf die Tagesgrenze nicht zuruecksetzen.
 */
export const costUsedToday = async (now: Date): Promise<number> => {
  const midnight = startOfLocalDay(now, CLUB.timeZone);
  const rows = await db
    .select({ total: sql<number>`coalesce(sum(${schema.notificationOutbox.costUnits}), 0)::int` })
    .from(schema.notificationOutbox)
    .where(
      and(eq(schema.notificationOutbox.state, 'sent'), gte(schema.notificationOutbox.sentAt, midnight)),
    );
  return rows[0]?.total ?? 0;
};

/**
 * Holt faellige Zeilen und markiert sie im selben Befehl als in Zustellung.
 *
 * `SKIP LOCKED` laesst einen zweiten Lauf die bereits gegriffenen Zeilen
 * ueberspringen, statt auf sie zu warten. `send_after` wandert dabei in die
 * Zukunft: bricht der Prozess mitten im Versand ab, wird die Zeile nach dieser
 * Frist wieder abholbar, statt fuer immer in `sending` zu haengen.
 */
const claim = async (limit: number, onlyKey?: string): Promise<readonly ClaimedRow[]> => {
  const keyFilter = onlyKey === undefined ? sql`` : sql`and key = ${onlyKey}`;
  const result = await db.execute(sql`
    update notification_outbox set
      state = 'sending',
      attempts = attempts + 1,
      send_after = now() + (${CLAIM_TIMEOUT_MINUTES} * interval '1 minute')
    where id in (
      select id from notification_outbox
      where state in ('queued', 'sending') and send_after <= now() ${keyFilter}
      order by send_after asc
      limit ${limit}
      for update skip locked
    )
    returning id, key, kind, recipient_id, game_id, payload, attempts, cost_units
  `);
  return result as unknown as readonly ClaimedRow[];
};

/**
 * Haelt fest, wie die Nachricht tatsaechlich rausging.
 *
 * Der Kanal wird hier erneut geschrieben und nicht nur beim Anlegen: wird
 * zwischen Anlegen und Versand umgeschaltet, soll die Zeile den Weg nennen,
 * den sie genommen hat, statt den, der einmal geplant war.
 */
const markSent = async (id: string, channel: Channel['name'], at: Date): Promise<void> => {
  await db
    .update(schema.notificationOutbox)
    .set({ state: 'sent', sentAt: at, channel, lastError: null })
    .where(eq(schema.notificationOutbox.id, id));
};

const markFailure = async (
  row: ClaimedRow,
  error: unknown,
  giveUp: boolean,
  now: Date,
): Promise<void> => {
  const text = error instanceof Error ? error.message : String(error);
  await db
    .update(schema.notificationOutbox)
    .set(
      giveUp
        ? { state: 'failed', lastError: text }
        : {
            state: 'queued',
            lastError: text,
            sendAfter: new Date(now.getTime() + retryDelayMinutes(row.attempts) * 60_000),
          },
    )
    .where(eq(schema.notificationOutbox.id, row.id));
};

export interface DispatchOptions {
  now?: Date;
  /** Kanal fuer Tests. Ohne Angabe entscheidet NOTIFICATION_CHANNEL. */
  channel?: Channel;
  maxMessages?: number;
  dailyLimit?: number;
  /**
   * Beschraenkt den Lauf auf einen Schluessel. Die Anmeldenachricht darf nicht
   * bis zum naechsten Cron-Lauf warten — jemand steht davor und wartet auf sie.
   */
  onlyKey?: string;
}

/**
 * Arbeitet die faelligen Nachrichten ab.
 *
 * Der Text entsteht erst hier, aus dem frisch gelesenen Spiel: verschiebt sich
 * der Anpfiff zwischen Anlegen und Versand, nennt die Nachricht den neuen
 * Termin. Nur die Anmeldenachricht traegt ihren Text schon mit, weil Link und
 * Code danach nicht mehr rekonstruierbar sind.
 */
export const dispatchOutbox = async (options: DispatchOptions = {}): Promise<DispatchResult> => {
  const now = options.now ?? new Date();
  const channel = options.channel ?? activeChannel();
  const runLimit = options.maxMessages ?? MAX_MESSAGES_PER_RUN;
  const dailyLimit = options.dailyLimit ?? DAILY_COST_LIMIT;

  const result: DispatchResult = {
    sent: 0,
    retried: 0,
    failed: 0,
    cost: 0,
    stoppedBy: 'nothing-due',
  };

  const usedToday = await costUsedToday(now);
  const budget = Math.max(0, dailyLimit - usedToday);
  if (budget === 0) return { ...result, stoppedBy: 'daily-limit' };

  const limit = Math.min(runLimit, budget);
  const rows = await claim(limit, options.onlyKey);
  if (rows.length === 0) return result;
  if (rows.length >= limit) {
    result.stoppedBy = limit === budget ? 'daily-limit' : 'run-limit';
  }

  const recipients = await db
    .select({ id: schema.referees.id, name: schema.referees.name, phone: schema.referees.phone })
    .from(schema.referees)
    .where(inArray(schema.referees.id, [...new Set(rows.map((r) => r.recipient_id))]));
  const byReferee = new Map(recipients.map((r) => [r.id, r]));

  const gameIds = [...new Set(rows.flatMap((r) => (r.game_id === null ? [] : [r.game_id])))];
  const games =
    gameIds.length === 0
      ? []
      : await db.select().from(schema.games).where(inArray(schema.games.id, gameIds));
  const byGame = new Map(games.map((row) => [row.id, toGame(row)]));

  for (const row of rows) {
    const recipient = byReferee.get(row.recipient_id);
    if (!recipient) {
      /*
       * Die Person wurde geloescht, waehrend die Nachricht wartete. Es gibt
       * niemanden mehr, an den sie gehen koennte.
       */
      await markFailure(row, new Error('Empfaenger existiert nicht mehr.'), true, now);
      result.failed += 1;
      continue;
    }

    if (!isNotificationKind(row.kind)) {
      /*
       * Eine Art, die es nicht mehr gibt. Waere sie einfach durchgereicht
       * worden, ginge eine Nachricht ohne Betreff und ohne Inhalt raus — und
       * die kostet genauso viel wie eine gute.
       */
      await markFailure(row, new Error(`Unbekannte Nachrichtenart "${row.kind}".`), true, now);
      result.failed += 1;
      continue;
    }

    const rendered = renderMessage(row.kind, {
      recipientName: recipient.name,
      game: row.game_id === null ? null : (byGame.get(row.game_id) ?? null),
      payload: row.payload,
      baseUrl: env.baseUrl,
      timeZone: CLUB.timeZone,
      now,
    });

    try {
      await channel.send({
        ...rendered,
        kind: row.kind,
        key: row.key,
        recipient: { refereeId: recipient.id, name: recipient.name, phone: recipient.phone },
      });
      await markSent(row.id, channel.name, now);
      result.sent += 1;
      result.cost += row.cost_units;
    } catch (error) {
      const giveUp = isPermanent(error) || row.attempts >= MAX_ATTEMPTS;
      await markFailure(row, error, giveUp, now);
      if (giveUp) result.failed += 1;
      else result.retried += 1;
    }
  }

  return result;
};
