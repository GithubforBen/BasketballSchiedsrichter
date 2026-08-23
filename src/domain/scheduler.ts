import { confirmationState } from './confirmation';
import { nextPromotionStep, promotionResponseWindowMs } from './escalation';
import {
  adminAlertIntent,
  dailyDigestIntent,
  openSlotAnnouncementIntent,
  personalReminderIntent,
  confirmationRequestIntent,
  type NotificationIntent,
} from './notifications';
import { notificationOrder, type RotationCandidate } from './rotation';
import { qualifiedReferees } from './rules';
import { refereeSlots, substituteSlots, SLOT_LABELS } from './slots';
import { calendarDay, days, describeLeadTime, hours, localHour } from './time';
import type { AdminAlertSettings } from './alerts';
import type { ClubSettings, Game, Referee, Slot, SlotIndex } from './types';

/**
 * Der Nachrichtenplan. Regeln 10, 11, 13-15, 19-21, 32.
 *
 * Diese Ebene liest nichts und verschickt nichts. Sie bekommt einen Ausschnitt
 * des Spielplans und einen Zeitpunkt und sagt, welche Nachrichten jetzt faellig
 * waeren. Damit laesst sich der komplette Versandplan im Trockenlauf pruefen,
 * ohne Datenbank, ohne Netz und ohne dass eine echte Nachricht Geld kostet.
 *
 * Jede Absicht traegt einen Idempotenzschluessel. Derselbe Plan zweimal
 * ausgefuehrt ergibt dieselben Schluessel — die Outbox verwirft die Doppelung.
 * Ein doppelter Cron-Lauf oder ein Neustart mitten im Lauf ist deshalb
 * folgenlos, und das ist hier die entscheidende Eigenschaft.
 */

/** Eine laufende Nachrueck-Anfrage, so wie sie gespeichert ist. Regeln 13-15. */
export interface PromotionOfferRecord {
  id: string;
  gameId: string;
  targetSlot: SlotIndex;
  substituteSlot: SlotIndex;
  refereeId: string;
  respondBy: Date;
  outcome: 'pending' | 'accepted' | 'declined' | 'expired';
}

/** Ein Spiel mit allem, was der Plan darueber wissen muss. */
export interface ScheduledGame {
  game: Game;
  slots: readonly Slot[];
  offers: readonly PromotionOfferRecord[];
}

/** Eine Anfrage, die neu gestellt werden soll. Die Id vergibt erst die Ablage. */
export interface NewPromotionOffer {
  gameId: string;
  targetSlot: SlotIndex;
  substituteSlot: SlotIndex;
  refereeId: string;
  respondBy: Date;
}

export interface SchedulerInput {
  games: readonly ScheduledGame[];
  referees: readonly Referee[];
  /** Einsaetze im Rotationsfenster, nach Schiedsrichter-Id. Regel 19. */
  appearances: ReadonlyMap<string, number>;
  settings: ClubSettings;
  alerts: AdminAlertSettings;
  timeZone: string;
}

export interface NotificationPlan {
  intents: readonly NotificationIntent[];
  /** Anfragen, deren Antwortfrist verstrichen ist. Regel 14. */
  expiredOfferIds: readonly string[];
  /**
   * Neu zu stellende Anfragen. Ihre Nachricht entsteht erst nach dem Anlegen,
   * weil der Idempotenzschluessel an der Id der Anfrage haengt.
   */
  newOffers: readonly NewPromotionOffer[];
}

/**
 * Stufen der automatischen Nachfrage bei offenen Spielen. Regel 32.
 *
 * Stufe 0 geht sofort raus, sobald ein Platz offen ist und die Nachrueck-Kaskade
 * nichts mehr anzubieten hat. Die weiteren Stufen wiederholen die Frage, je
 * naeher der Anpfiff rueckt — jede Stufe hoechstens einmal, weil ihre Nummer im
 * Schluessel steht.
 */
export const NUDGE_LEAD_DAYS: readonly number[] = [14, 7, 3, 1];

/** Ortszeit, zu der die Tageszusammenfassung rausgeht. Regel 20. */
export const DIGEST_HOUR = 18;

/**
 * Wie lange eine faellige Erinnerung noch nachgeholt wird.
 *
 * Ein Cron-Lauf kann ausfallen; sechs Stunden Nachlauf fangen das ab. Laenger
 * wird bewusst nicht nachgeholt: eine Nachricht "7 Tage vor Anpfiff", die
 * sechs Tage zu spaet ankommt, ist schlicht falsch — und sie kostet trotzdem
 * Geld (Regel 33). Lieber keine Erinnerung als eine irrefuehrende.
 */
export const REMINDER_CATCH_UP_MS = hours(6);

/**
 * Stufe der Nachfrage zum Zeitpunkt `now`. 0 heisst: die erste Ausschreibung.
 * Es wird immer nur die zuletzt erreichte Stufe gemeldet, damit nach einem
 * Ausfall nicht alle verpassten Stufen auf einmal nachgeholt werden.
 */
export const nudgeRound = (kickoff: Date, now: Date): number => {
  let round = 0;
  NUDGE_LEAD_DAYS.forEach((leadDays, index) => {
    if (now.getTime() >= kickoff.getTime() - days(leadDays)) round = index + 1;
  });
  return round;
};

/**
 * Regel 21: persoenliche Erinnerungen.
 *
 * Eine Erinnerung geht nur raus, wenn drei Dinge zusammenkommen: ihr Zeitpunkt
 * ist erreicht, er liegt nicht laenger als der Nachlauf zurueck, und die Person
 * war damals schon eingetragen. Wer sich zwei Stunden vor Anpfiff eintraegt,
 * bekommt keine Nachricht mehr, die "7 Tage vorher" heissen soll — sie waere
 * schlicht falsch und wuerde trotzdem Geld kosten.
 */
export const duePersonalReminders = (
  entry: ScheduledGame,
  referees: ReadonlyMap<string, Referee>,
  now: Date,
): readonly NotificationIntent[] => {
  const { game, slots } = entry;
  if (game.state === 'cancelled' || now.getTime() >= game.kickoff.getTime()) return [];

  const intents: NotificationIntent[] = [];
  for (const slot of slots) {
    const assignment = slot.assignment;
    if (!assignment) continue;
    const referee = referees.get(assignment.refereeId);
    if (!referee?.active) continue;

    for (const hoursBefore of referee.reminderHours) {
      const dueAt = game.kickoff.getTime() - hours(hoursBefore);
      if (dueAt > now.getTime()) continue;
      if (now.getTime() - dueAt > REMINDER_CATCH_UP_MS) continue;
      if (dueAt < assignment.claimedAt.getTime()) continue;
      intents.push(personalReminderIntent(game.id, referee.id, hoursBefore));
    }
  }
  return intents;
};

/**
 * Regeln 10 und 11: Pflichtbestaetigung und Nachfassen.
 *
 * Bei `overdue` wird die erste Anfrage bewusst erneut gemeldet. Sie ist laengst
 * verschickt und wird an ihrem Schluessel als Doppelung verworfen; ist sie aber
 * bei einem Ausfall nie entstanden, holt der naechste Lauf sie nach, statt sie
 * fuer immer zu verlieren.
 */
export const dueConfirmations = (
  entry: ScheduledGame,
  settings: ClubSettings,
  now: Date,
): readonly NotificationIntent[] => {
  const { game, slots } = entry;
  if (game.state === 'cancelled' || now.getTime() >= game.kickoff.getTime()) return [];

  const intents: NotificationIntent[] = [];
  for (const slot of refereeSlots(slots)) {
    const assignment = slot.assignment;
    if (!assignment) continue;
    const state = confirmationState(slot, game, settings, now);
    if (state === 'pending' || state === 'overdue') {
      intents.push(confirmationRequestIntent(game.id, assignment.refereeId, 'initial'));
    }
    if (state === 'overdue') {
      intents.push(confirmationRequestIntent(game.id, assignment.refereeId, 'follow-up'));
    }
  }
  return intents;
};

/** Regel 11: bleibt die Bestaetigung aus, erfahren es auch die Admins. */
export const dueConfirmationAlerts = (
  entry: ScheduledGame,
  settings: ClubSettings,
  alerts: AdminAlertSettings,
  adminIds: readonly string[],
  referees: ReadonlyMap<string, Referee>,
  now: Date,
): readonly NotificationIntent[] => {
  if (!alerts.confirmationOverdue || adminIds.length === 0) return [];
  const { game, slots } = entry;
  if (game.state === 'cancelled' || now.getTime() >= game.kickoff.getTime()) return [];

  const intents: NotificationIntent[] = [];
  for (const slot of refereeSlots(slots)) {
    const assignment = slot.assignment;
    if (!assignment) continue;
    if (confirmationState(slot, game, settings, now) !== 'overdue') continue;
    const name = referees.get(assignment.refereeId)?.name ?? assignment.refereeId;
    intents.push(
      adminAlertIntent(
        game.id,
        adminIds,
        'confirmation-overdue',
        assignment.refereeId,
        `${name} hat die Pflichtbestaetigung fuer ${game.home} gegen ${game.away} seit ` +
          `${settings.confirmationFollowUpHours} Stunden nicht beantwortet. ` +
          `Anpfiff ${describeLeadTime(game.kickoff, now)}.`,
      ),
    );
  }
  return intents;
};

interface PromotionPlan {
  expiredOfferIds: readonly string[];
  newOffers: readonly NewPromotionOffer[];
  /** Die Kaskade ist erschoepft: der Platz gehoert ausgeschrieben. Regel 15. */
  announce: boolean;
}

/**
 * Regeln 13-15: die Nachrueck-Kaskade weiterdrehen.
 *
 * Eine laufende Anfrage blockiert die naechste, bis ihre Frist verstrichen ist —
 * sonst wuerden beide Ersatzleute gleichzeitig gefragt und beide koennten
 * zusagen. Erst wenn niemand mehr zu fragen ist, wird ausgeschrieben.
 */
export const planPromotions = (
  entry: ScheduledGame,
  settings: ClubSettings,
  now: Date,
): PromotionPlan => {
  const { game, slots, offers } = entry;
  if (game.state === 'cancelled' || now.getTime() >= game.kickoff.getTime()) {
    return { expiredOfferIds: [], newOffers: [], announce: false };
  }

  const expired = offers.filter(
    (o) => o.outcome === 'pending' && now.getTime() >= o.respondBy.getTime(),
  );
  const expiredOfferIds = expired.map((o) => o.id);
  const stillWaiting = offers.some(
    (o) => o.outcome === 'pending' && now.getTime() < o.respondBy.getTime(),
  );
  if (stillWaiting) return { expiredOfferIds, newOffers: [], announce: false };

  /*
   * Wer abgelehnt hat oder dessen Frist abgelaufen ist, wird nicht erneut
   * gefragt — auch nicht der gerade in diesem Lauf abgelaufene.
   */
  const declinedSlots = offers
    .filter((o) => o.outcome === 'declined' || o.outcome === 'expired')
    .map((o) => o.substituteSlot)
    .concat(expired.map((o) => o.substituteSlot));

  const step = nextPromotionStep({ game, slots, declinedSlots, settings, now });

  if (step.kind === 'idle') return { expiredOfferIds, newOffers: [], announce: false };
  if (step.kind === 'announce') return { expiredOfferIds, newOffers: [], announce: true };

  const assignment = step.substitute.assignment;
  if (!assignment) return { expiredOfferIds, newOffers: [], announce: false };

  return {
    expiredOfferIds,
    newOffers: [
      {
        gameId: game.id,
        targetSlot: step.targetSlot,
        substituteSlot: step.substitute.index,
        refereeId: assignment.refereeId,
        respondBy: new Date(now.getTime() + promotionResponseWindowMs(game, settings, now)),
      },
    ],
    announce: false,
  };
};

/**
 * Regeln 15, 19 und 32: der offene Platz wird ausgeschrieben.
 *
 * Die erste Ausschreibung ist Pflicht und haengt nicht am Schalter fuer die
 * automatische Nachfrage — ohne sie erfuehre niemand von der Luecke. Nur die
 * Wiederholungen sind abschaltbar, denn sie kosten erneut Geld.
 */
export const openSlotAnnouncement = (
  entry: ScheduledGame,
  referees: readonly Referee[],
  appearances: ReadonlyMap<string, number>,
  settings: ClubSettings,
  now: Date,
): NotificationIntent | null => {
  const { game, slots } = entry;
  const round = nudgeRound(game.kickoff, now);
  if (round > 0 && !settings.autoNudge) return null;

  const assigned = new Set(
    slots.flatMap((s) => (s.assignment ? [s.assignment.refereeId] : [])),
  );
  const candidates: RotationCandidate[] = qualifiedReferees(referees, game.leagueId)
    .filter((r) => !assigned.has(r.id))
    .map((referee) => ({ referee, countInWindow: appearances.get(referee.id) ?? 0 }));

  const order = notificationOrder(candidates, settings);
  if (order.length === 0) return null;

  return openSlotAnnouncementIntent(
    game.id,
    order.map((r) => r.id),
    game.vacancyVersion,
    round,
  );
};

/**
 * Regel 20: eine Zusammenfassung am Abend, statt einer Meldung pro Vorgang.
 *
 * Sie geht genau einmal pro Kalendertag raus — der Schluessel traegt das Datum
 * in Vereinszeit, nicht die Laufzeit des Cron-Jobs.
 */
export const dueDigest = (
  input: SchedulerInput,
  adminIds: readonly string[],
  now: Date,
): NotificationIntent | null => {
  if (!input.alerts.dailyDigest || adminIds.length === 0) return null;
  if (localHour(now, input.timeZone) < DIGEST_HOUR) return null;

  const upcoming = input.games.filter(
    (e) => e.game.state !== 'cancelled' && e.game.kickoff.getTime() > now.getTime(),
  );
  const lines: string[] = [];
  for (const entry of upcoming) {
    const missing = refereeSlots(entry.slots).filter((s) => s.assignment === null);
    const openSubstitutes = substituteSlots(entry.slots).filter((s) => s.assignment === null);
    const unconfirmed = refereeSlots(entry.slots).filter(
      (s) => s.assignment !== null && confirmationState(s, entry.game, input.settings, now) !== 'confirmed',
    );
    if (missing.length === 0 && unconfirmed.length === 0) continue;

    const parts: string[] = [];
    if (missing.length > 0) {
      parts.push(`${missing.map((s) => SLOT_LABELS[s.index]).join(' und ')} offen`);
    }
    if (unconfirmed.length > 0) parts.push(`${unconfirmed.length}x Bestaetigung ausstehend`);
    if (openSubstitutes.length > 0) parts.push(`${openSubstitutes.length} Ersatzplatz frei`);
    lines.push(
      `${entry.game.home} gegen ${entry.game.away} (${entry.game.leagueId}), Anpfiff ` +
        `${describeLeadTime(entry.game.kickoff, now)}: ${parts.join(', ')}.`,
    );
  }

  if (lines.length === 0) return null;
  return dailyDigestIntent(adminIds, calendarDay(now, input.timeZone), lines);
};

/**
 * Der vollstaendige Plan fuer diesen Zeitpunkt.
 *
 * Reihenfolge und Inhalt haengen ausschliesslich an den Eingaben und an `now`.
 * Zweimal mit demselben `now` aufgerufen liefert dieselben Schluessel.
 */
export const planNotifications = (input: SchedulerInput, now: Date): NotificationPlan => {
  const refereesById = new Map(input.referees.map((r) => [r.id, r]));
  const adminIds = input.referees.filter((r) => r.role === 'admin' && r.active).map((r) => r.id);

  const intents: NotificationIntent[] = [];
  const expiredOfferIds: string[] = [];
  const newOffers: NewPromotionOffer[] = [];

  for (const entry of input.games) {
    intents.push(...duePersonalReminders(entry, refereesById, now));
    intents.push(...dueConfirmations(entry, input.settings, now));
    intents.push(
      ...dueConfirmationAlerts(entry, input.settings, input.alerts, adminIds, refereesById, now),
    );

    const promotion = planPromotions(entry, input.settings, now);
    expiredOfferIds.push(...promotion.expiredOfferIds);
    newOffers.push(...promotion.newOffers);

    if (promotion.announce) {
      const announcement = openSlotAnnouncement(
        entry,
        input.referees,
        input.appearances,
        input.settings,
        now,
      );
      if (announcement) intents.push(announcement);
    }
  }

  const digest = dueDigest(input, adminIds, now);
  if (digest) intents.push(digest);

  return { intents, expiredOfferIds, newOffers };
};
