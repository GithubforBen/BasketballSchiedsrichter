import 'server-only';
import { and, eq, lt, or, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { days } from '@/domain/time';

/**
 * Aufbewahrungsfristen. Datenschutz, M6.
 *
 * Ohne diese Datei waechst jede Tabelle unbegrenzt: Anmeldenachrichten mit
 * Namen und Anrede, Zaehler mit IP-Adressen, ein Pruefprotokoll ueber Jahre.
 * Daten aufzubewahren, die man nicht mehr braucht, ist kein Versehen — es ist
 * der haeufigste Datenschutzverstoss ueberhaupt, und er faellt niemandem auf,
 * weil nichts kaputtgeht.
 *
 * Die Fristen sind bewusst unterschiedlich lang, je nachdem, wozu die Zeile
 * noch dient. Sie stehen hier an einer Stelle, damit die Datenschutzerklaerung
 * sie nennen kann, ohne dass jemand den Code durchsuchen muss.
 */

export interface RetentionPolicy {
  /** Anmeldelinks und -codes. Sie gelten 15 Minuten; danach sind sie Abfall. */
  loginTokensDays: number;
  /**
   * Zaehler der Rate-Limits. Sie sind nach ihrem Fenster wirkungslos, tragen
   * aber die IP-Adresse im Schluessel — deshalb die kuerzeste Frist.
   */
  rateLimitsDays: number;
  /**
   * Zugestellte und aufgegebene Nachrichten. Sie tragen Anrede und Inhalt.
   * Ein Vierteljahr reicht, um einer Beschwerde nachzugehen ("ich habe nie
   * eine Nachricht bekommen"); danach ist es nur noch Vorrat.
   */
  outboxDays: number;
  /**
   * Das Pruefprotokoll der Admin-Aktionen. Eine Saison, damit sich am Ende
   * der Spielzeit noch nachvollziehen laesst, wer was geaendert hat.
   */
  auditDays: number;
}

export const DEFAULT_RETENTION: RetentionPolicy = {
  loginTokensDays: 7,
  rateLimitsDays: 2,
  outboxDays: 90,
  auditDays: 400,
};

export interface RetentionResult {
  loginTokens: number;
  rateLimits: number;
  outbox: number;
  audit: number;
}

/**
 * Raeumt auf, was seine Frist ueberschritten hat.
 *
 * Wartende Nachrichten bleiben unangetastet, egal wie alt sie sind: eine Zeile
 * im Zustand `queued` ist eine Aufgabe, keine Erinnerung. Wer sie mitloeschte,
 * verlore einen Versand, statt Ballast abzuwerfen.
 */
export const applyRetention = async (
  now: Date = new Date(),
  policy: RetentionPolicy = DEFAULT_RETENTION,
): Promise<RetentionResult> => {
  const before = (daysBack: number): Date => new Date(now.getTime() - days(daysBack));

  const loginTokens = await db
    .delete(schema.loginTokens)
    .where(lt(schema.loginTokens.createdAt, before(policy.loginTokensDays)))
    .returning({ id: schema.loginTokens.id });

  const rateLimits = await db
    .delete(schema.rateLimits)
    .where(lt(schema.rateLimits.windowStart, before(policy.rateLimitsDays)))
    .returning({ key: schema.rateLimits.key });

  /*
   * `sentAt` ist bei einer aufgegebenen Nachricht leer — dann zaehlt die
   * Faelligkeit. Der Zeitpunkt wird ausdruecklich als `timestamptz` uebergeben:
   * in einem rohen SQL-Ausdruck kennt der Treiber die Spalte nicht mehr und
   * wuesste sonst nicht, wie er ein Date binden soll.
   */
  const outboxCutoff = before(policy.outboxDays).toISOString();
  const outbox = await db
    .delete(schema.notificationOutbox)
    .where(
      and(
        or(
          eq(schema.notificationOutbox.state, 'sent'),
          eq(schema.notificationOutbox.state, 'failed'),
        ),
        sql`coalesce(${schema.notificationOutbox.sentAt}, ${schema.notificationOutbox.sendAfter})
            < ${outboxCutoff}::timestamptz`,
      ),
    )
    .returning({ id: schema.notificationOutbox.id });

  const audit = await db
    .delete(schema.auditLog)
    .where(lt(schema.auditLog.createdAt, before(policy.auditDays)))
    .returning({ id: schema.auditLog.id });

  return {
    loginTokens: loginTokens.length,
    rateLimits: rateLimits.length,
    outbox: outbox.length,
    audit: audit.length,
  };
};
