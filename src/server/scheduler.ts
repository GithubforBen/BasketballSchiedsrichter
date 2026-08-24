import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, gte, inArray, lt, ne } from 'drizzle-orm';
import { CLUB } from '@/config/club';
import { db, schema } from '@/db';
import { promotionOfferIntent, type NotificationIntent } from '@/domain/notifications';
import { rotationWindowStart } from '@/domain/rotation';
import { hours } from '@/domain/time';
import { buildSlots } from '@/domain/slots';
import {
  planNotifications,
  type NewPromotionOffer,
  type PromotionOfferRecord,
  type ScheduledGame,
  type SchedulerInput,
} from '@/domain/scheduler';
import { countsAsRefereed } from '@/domain/stats';
import type { SlotIndex } from '@/domain/types';
import { toAssignment, toGame } from './queries/games';
import { loadAllReferees } from './queries/referees';
import { loadAlertSettings, loadSettings } from './queries/settings';
import { applyRetention, type RetentionResult } from './aufbewahrung';
import { dispatchOutbox, enqueueAll, type DispatchResult } from './outbox';

/**
 * Der Lauf, der die Nachrichten faellig stellt.
 *
 * Er liest den Stand, laesst den reinen Nachrichtenplan entscheiden und
 * schreibt das Ergebnis in die Outbox. Die Entscheidung selbst liegt in
 * `@/domain/scheduler` und ist ohne Datenbank testbar — hier steht nur, woher
 * die Zahlen kommen und wohin das Ergebnis geht.
 */

/** Wie oft aufgeraeumt wird. Taeglich genuegt — die Fristen zaehlen in Tagen. */
const RETENTION_INTERVAL_HOURS = 24;

export interface SchedulerRun {
  /**
   * Tatsaechlich neu angelegte Nachrichten. Bei einem zweiten Lauf ueber
   * unveraenderten Daten ist das null — die Schluessel gibt es schon.
   */
  queued: number;
  /** Geloeschte Zeilen, deren Aufbewahrungsfrist abgelaufen war. M6. */
  pruned: RetentionResult | null;
  /** Abgelaufene Nachrueck-Anfragen. Regel 14. */
  expired: number;
  /** Neu gestellte Nachrueck-Anfragen. Regel 13. */
  offered: number;
  dispatch: DispatchResult;
}

/**
 * Wie weit voraus geplant wird.
 *
 * Weiter als die laengste Erinnerung plus einen Puffer muss niemand schauen:
 * alles Spaetere kann noch nichts ausgeloest haben.
 */
const HORIZON_DAYS = 60;

/** Einsaetze je Person im Rotationsfenster. Regel 19. */
const appearancesInWindow = async (
  window: Parameters<typeof rotationWindowStart>[1],
  now: Date,
): Promise<ReadonlyMap<string, number>> => {
  const since = rotationWindowStart(now, window);
  const rows = await db
    .select({
      refereeId: schema.assignments.refereeId,
      slotIndex: schema.assignments.slotIndex,
      playedAsReferee: schema.assignments.playedAsReferee,
    })
    .from(schema.assignments)
    .innerJoin(schema.games, eq(schema.assignments.gameId, schema.games.id))
    .where(
      and(
        gte(schema.games.kickoff, since),
        lt(schema.games.kickoff, now),
        ne(schema.games.state, 'cancelled'),
      ),
    );

  const counts = new Map<string, number>();
  for (const row of rows) {
    const slotIndex = row.slotIndex as SlotIndex;
    const counted = countsAsRefereed(slotIndex, {
      gameId: '',
      slotIndex,
      refereeId: row.refereeId,
      claimedAt: now,
      confirmedAt: null,
      playedAsReferee: row.playedAsReferee,
    });
    if (!counted) continue;
    counts.set(row.refereeId, (counts.get(row.refereeId) ?? 0) + 1);
  }
  return counts;
};

/** Alles, was der Nachrichtenplan ueber den aktuellen Stand wissen muss. */
const loadHorizon = async (now: Date): Promise<readonly ScheduledGame[]> => {
  const until = new Date(now.getTime() + HORIZON_DAYS * 24 * 60 * 60 * 1000);
  const gameRows = await db
    .select()
    .from(schema.games)
    .where(and(gte(schema.games.kickoff, now), lt(schema.games.kickoff, until)))
    .orderBy(asc(schema.games.kickoff));

  if (gameRows.length === 0) return [];
  const ids = gameRows.map((row) => row.id);

  const assignmentRows = await db
    .select()
    .from(schema.assignments)
    .where(inArray(schema.assignments.gameId, ids));
  const offerRows = await db
    .select()
    .from(schema.promotionOffers)
    .where(inArray(schema.promotionOffers.gameId, ids));

  return gameRows.map((row) => ({
    game: toGame(row),
    slots: buildSlots(
      assignmentRows.filter((a) => a.gameId === row.id).map(toAssignment),
    ),
    offers: offerRows
      .filter((o) => o.gameId === row.id)
      .map(
        (o): PromotionOfferRecord => ({
          id: o.id,
          gameId: o.gameId,
          targetSlot: o.targetSlot as SlotIndex,
          substituteSlot: o.substituteSlot as SlotIndex,
          refereeId: o.refereeId,
          respondBy: o.respondBy,
          outcome: o.outcome,
        }),
      ),
  }));
};

/**
 * Legt eine Nachrueck-Anfrage an und macht daraus die Nachricht.
 *
 * Die Reihenfolge ist wichtig: erst die Zeile, dann die Nachricht. Der
 * Idempotenzschluessel haengt an der Id der Anfrage, und eine Nachricht ohne
 * zugehoerige Anfrage waere eine Frage, deren Antwort nirgends ankaeme.
 */
const openOffer = async (offer: NewPromotionOffer): Promise<NotificationIntent> => {
  const id = randomUUID();
  await db.insert(schema.promotionOffers).values({
    id,
    gameId: offer.gameId,
    targetSlot: offer.targetSlot,
    substituteSlot: offer.substituteSlot,
    refereeId: offer.refereeId,
    respondBy: offer.respondBy,
    outcome: 'pending',
  });
  return promotionOfferIntent(id, offer.gameId, offer.refereeId, offer.targetSlot, offer.respondBy);
};

/** Der Stand, gegen den geplant wird. */
const loadInput = async (now: Date): Promise<SchedulerInput> => {
  const [settings, alerts, referees] = await Promise.all([
    loadSettings(),
    loadAlertSettings(),
    loadAllReferees(),
  ]);
  const games = await loadHorizon(now);
  const appearances = await appearancesInWindow(settings.rotationWindow, now);
  return { games, referees, appearances, settings, alerts, timeZone: CLUB.timeZone };
};

/**
 * Ein Lauf.
 *
 * Zweimal hintereinander aufgerufen aendert der zweite Lauf nichts: die
 * Schluessel sind dieselben, und die Outbox nimmt sie kein zweites Mal an.
 */
export const runScheduler = async (now: Date = new Date()): Promise<SchedulerRun> => {
  const plan = planNotifications(await loadInput(now), now);

  if (plan.expiredOfferIds.length > 0) {
    await db
      .update(schema.promotionOffers)
      .set({ outcome: 'expired' })
      .where(inArray(schema.promotionOffers.id, [...plan.expiredOfferIds]));
  }

  const intents: NotificationIntent[] = [...plan.intents];
  for (const offer of plan.newOffers) {
    intents.push(await openOffer(offer));
  }

  const queued = await enqueueAll(db, intents);
  const dispatch = await dispatchOutbox({ now });
  const pruned = await pruneIfDue(now);

  return {
    queued,
    pruned,
    expired: plan.expiredOfferIds.length,
    offered: plan.newOffers.length,
    dispatch,
  };
};

/**
 * Raeumt hoechstens einmal am Tag auf.
 *
 * Der Zeitgeber laeuft alle fuenf Minuten; bei jedem Lauf vier Loeschabfragen
 * ueber die groessten Tabellen zu schicken, waere Verschwendung. Der Zeitpunkt
 * des letzten Laufs steht im Pruefprotokoll — bewusst dort und nicht im
 * Arbeitsspeicher, damit ein Neustart die Frist nicht zuruecksetzt.
 */
const pruneIfDue = async (now: Date): Promise<RetentionResult | null> => {
  const last = await db
    .select({ createdAt: schema.auditLog.createdAt })
    .from(schema.auditLog)
    .where(eq(schema.auditLog.action, 'aufbewahrung.lauf'))
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(1);

  const previous = last[0]?.createdAt;
  if (previous && now.getTime() - previous.getTime() < hours(RETENTION_INTERVAL_HOURS)) {
    return null;
  }

  const pruned = await applyRetention(now);
  await db.insert(schema.auditLog).values({
    id: randomUUID(),
    actorId: null,
    action: 'aufbewahrung.lauf',
    detail: { ...pruned },
  });
  return pruned;
};

/**
 * Der Trockenlauf: was ein Lauf verschicken wuerde, ohne dass er es tut.
 *
 * Jede Nachricht kostet Geld (Regel 33). Vor einer Aenderung an Fristen oder
 * Erinnerungen laesst sich damit nachsehen, was sie auslost — ohne dass eine
 * einzige Nachricht rausgeht.
 */
export const previewScheduler = async (
  now: Date = new Date(),
): Promise<readonly NotificationIntent[]> => planNotifications(await loadInput(now), now).intents;
