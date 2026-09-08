import 'server-only';
import { and, desc, eq, inArray, lt, or, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { salutationName } from '@/domain/license';
import { NOTIFICATION_KINDS, type NotificationKind } from '@/domain/notifications';

/**
 * Das Nachrichten-Protokoll: was tatsaechlich rausgegangen ist.
 *
 * Gelesen wird nur, was schon versucht wurde — `sent` und `failed`. Wartende
 * Zeilen gehoeren nicht hierher: sie sind eine Aufgabe, kein Beleg, und stehen
 * mit ihrem geplanten Termin ohnehin in der Uebersicht des Zeitgebers.
 *
 * Der Text kommt aus der Zeile und wird **nicht** neu erzeugt. Genau das ist
 * der Sinn: ein Spiel, das nach der Nachricht verlegt wurde, darf den Beleg
 * nicht nachtraeglich veraendern.
 */

/** Wie viele Eintraege eine Seite traegt. */
export const PAGE_SIZE = 50;

export interface LogEntry {
  id: string;
  kind: string;
  channel: string;
  state: 'sent' | 'failed';
  /** Der Zeitpunkt des Versuchs. Bei einer aufgegebenen Zeile die Faelligkeit. */
  at: Date;
  attempts: number;
  recipientName: string;
  subject: string | null;
  body: string | null;
  templateName: string | null;
  /** Die Werte der Vorlage, in ihrer Reihenfolge. Leer ohne Vorlage. */
  templateParameters: readonly string[];
  lastError: string | null;
}

export interface LogPage {
  entries: readonly LogEntry[];
  /** Der Zeitpunkt, ab dem die naechste Seite weiterliest. `null` am Ende. */
  nextBefore: string | null;
  counts: { sent: number; failed: number };
}

/** Die Filter, die die Adresse tragen kann. */
export interface LogFilter {
  state?: 'sent' | 'failed' | undefined;
  kind?: NotificationKind | undefined;
  /** Nur Eintraege vor diesem Zeitpunkt — der Weg zur naechsten Seite. */
  before?: Date | undefined;
}

export const isNotificationKindFilter = (value: string | undefined): value is NotificationKind =>
  value !== undefined && (NOTIFICATION_KINDS as readonly string[]).includes(value);

/**
 * Der Zeitpunkt, nach dem sortiert und geblaettert wird.
 *
 * Eine zugestellte Zeile traegt `sent_at`, eine aufgegebene nicht — dort ist
 * `send_after` der Zeitpunkt des letzten Versuchs. Beides zusammen ergibt eine
 * einzige Reihenfolge; ohne `coalesce` sackten alle gescheiterten Zeilen ans
 * Ende, obwohl gerade sie oben stehen sollen.
 */
const attemptedAt = sql<Date>`coalesce(${schema.notificationOutbox.sentAt}, ${schema.notificationOutbox.sendAfter})`;

const parameters = (template: Record<string, unknown> | null): readonly string[] => {
  const values = template?.['parameters'];
  return Array.isArray(values) ? values.filter((v): v is string => typeof v === 'string') : [];
};

const templateName = (template: Record<string, unknown> | null): string | null => {
  const name = template?.['name'];
  return typeof name === 'string' ? name : null;
};

/** Der Zeitpunkt des letzten Eintrags einer Seite — der Anfang der naechsten. */
const last = (page: readonly { at: Date }[]): string | null => {
  const entry = page[page.length - 1];
  return entry ? new Date(entry.at).toISOString() : null;
};

export const notificationLog = async (filter: LogFilter = {}): Promise<LogPage> => {
  const attempted = or(
    eq(schema.notificationOutbox.state, 'sent'),
    eq(schema.notificationOutbox.state, 'failed'),
  );

  const [counts] = await db
    .select({
      sent: sql<number>`count(*) filter (where ${schema.notificationOutbox.state} = 'sent')::int`,
      failed: sql<number>`count(*) filter (where ${schema.notificationOutbox.state} = 'failed')::int`,
    })
    .from(schema.notificationOutbox);

  const rows = await db
    .select({
      id: schema.notificationOutbox.id,
      kind: schema.notificationOutbox.kind,
      channel: schema.notificationOutbox.channel,
      state: schema.notificationOutbox.state,
      at: attemptedAt,
      attempts: schema.notificationOutbox.attempts,
      recipientId: schema.notificationOutbox.recipientId,
      subject: schema.notificationOutbox.sentSubject,
      body: schema.notificationOutbox.sentBody,
      template: schema.notificationOutbox.sentTemplate,
      lastError: schema.notificationOutbox.lastError,
    })
    .from(schema.notificationOutbox)
    .where(
      and(
        attempted,
        filter.state ? eq(schema.notificationOutbox.state, filter.state) : undefined,
        filter.kind ? eq(schema.notificationOutbox.kind, filter.kind) : undefined,
        filter.before ? lt(attemptedAt, filter.before) : undefined,
      ),
    )
    /* Eine Seite mehr lesen, um zu wissen, ob es weitergeht — ohne zweite Abfrage. */
    .orderBy(desc(attemptedAt))
    .limit(PAGE_SIZE + 1);

  const page = rows.slice(0, PAGE_SIZE);

  /*
   * Angezeigt wird der Vorname, wie in der Nachricht selbst. Die Namen kommen
   * frisch aus der Person und stehen nicht in der Zeile: eine zweite Kopie des
   * Namens waere eine zweite Datenhaltung, und beim Loeschen bliebe sie stehen.
   */
  const ids = [...new Set(page.map((row) => row.recipientId))];
  const people =
    ids.length === 0
      ? []
      : await db
          .select({
            id: schema.referees.id,
            name: schema.referees.name,
            firstName: schema.referees.firstName,
          })
          .from(schema.referees)
          .where(inArray(schema.referees.id, ids));
  const byReferee = new Map(people.map((row) => [row.id, salutationName(row)]));

  return {
    entries: page.map((row) => ({
      id: row.id,
      kind: row.kind,
      channel: row.channel,
      state: row.state as 'sent' | 'failed',
      at: new Date(row.at),
      attempts: row.attempts,
      /*
       * Die Person kann geloescht sein, waehrend ihr Protokolleintrag noch in
       * der Frist steht. Dann bleibt der Eintrag ohne Namen — er soll nicht
       * verschwinden, aber auch niemanden benennen, den es nicht mehr gibt.
       */
      recipientName: byReferee.get(row.recipientId) ?? 'gelöscht',
      subject: row.subject,
      body: row.body,
      templateName: templateName(row.template),
      templateParameters: parameters(row.template),
      lastError: row.lastError,
    })),
    /*
     * Der Treiber gibt je nach Ausdruck einen `Date` oder eine Zeichenkette
     * zurueck — durch `new Date` laeuft beides in dieselbe Form.
     */
    nextBefore: rows.length > PAGE_SIZE ? last(page) : null,
    counts: { sent: counts?.sent ?? 0, failed: counts?.failed ?? 0 },
  };
};
