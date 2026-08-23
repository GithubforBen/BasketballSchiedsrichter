/**
 * Nachrichtenauslöser. Regeln 31-33.
 *
 * Diese Ebene versendet nichts. Sie beschreibt nur, welche Nachricht aus einem
 * fachlichen Vorgang folgt — damit in M5 ein Adapter (WhatsApp, E-Mail,
 * Entwicklungs-Outbox) davorgehaengt werden kann, ohne die Regeln anzufassen.
 *
 * Regel 33: Jede Nachricht kostet den Verein Geld. Deshalb traegt jede Absicht
 * ihre Kosteneinheiten mit und laesst sich vor dem Versand zusammenzaehlen.
 */

export type NotificationKind =
  /** Regel 31: Bestaetigung an die Person, die sich gerade eingetragen hat. */
  | 'assignment'
  /** Regel 10: Pflichtbestaetigung mit Antwortknopf. */
  | 'confirmation-request'
  /** Regel 11: Erneute Erinnerung, wenn die Bestaetigung ausbleibt. */
  | 'confirmation-follow-up'
  /** Regeln 13-14: Anfrage an einen Ersatz, ob er nachrueckt. */
  | 'promotion-offer'
  /** Regel 15 / 32: Ausschreibung eines offenen Platzes an alle Qualifizierten. */
  | 'open-slot-announcement'
  /** Regel 17: Neuer Termin mit Absage-Option. */
  | 'relocation'
  /** Regel 21: Persoenliche Erinnerung vor Anpfiff. */
  | 'personal-reminder'
  /** Regel 20: Meldung an die Admins. */
  | 'admin-alert'
  /** Anmeldung: Magic-Link und Code. */
  | 'login';

export interface NotificationIntent {
  kind: NotificationKind;
  /** Empfaenger. Eine Absicht kann sich an mehrere Personen richten. */
  recipientIds: readonly string[];
  gameId: string | null;
  /**
   * Idempotenzschluessel. Zwei Absichten mit demselben Schluessel sind
   * dieselbe Nachricht und duerfen nur einmal rausgehen — auch nach einem
   * Neustart oder einem doppelten Cron-Lauf.
   */
  key: string;
  /** Ob der Empfaenger antworten kann (Bestaetigen, Absagen, Nachruecken). */
  expectsReply: boolean;
}

/**
 * Regel 33: Kosten einer Absicht in Nachrichteneinheiten — eine pro Empfaenger.
 * Anmeldenachrichten zaehlen mit, weil sie denselben Kanal und dieselbe
 * Abrechnung nutzen.
 */
export const costUnits = (intent: NotificationIntent): number => intent.recipientIds.length;

export const totalCostUnits = (intents: readonly NotificationIntent[]): number =>
  intents.reduce((sum, intent) => sum + costUnits(intent), 0);

/**
 * Entfernt Absichten, die bereits verschickt wurden oder in derselben Runde
 * doppelt entstanden sind. Grundlage der Outbox in M5.
 */
export const deduplicate = (
  intents: readonly NotificationIntent[],
  alreadySent: ReadonlySet<string>,
): readonly NotificationIntent[] => {
  const seen = new Set<string>();
  return intents.filter((intent) => {
    if (alreadySent.has(intent.key) || seen.has(intent.key)) return false;
    seen.add(intent.key);
    return true;
  });
};

/** Regel 31: Wer sich eingetragen hat, erfaehrt es sofort. */
export const assignmentIntent = (
  gameId: string,
  refereeId: string,
  slotIndex: number,
): NotificationIntent => ({
  kind: 'assignment',
  recipientIds: [refereeId],
  gameId,
  key: `assignment:${gameId}:${refereeId}:${slotIndex}`,
  expectsReply: false,
});

/**
 * Regel 32: Der Admin erinnert alle Qualifizierten an ein offenes Spiel.
 * Die Reihenfolge kommt aus der Rotation (Regel 19) und bleibt hier erhalten.
 */
export const openSlotAnnouncementIntent = (
  gameId: string,
  recipientIds: readonly string[],
  round: number,
): NotificationIntent => ({
  kind: 'open-slot-announcement',
  recipientIds,
  gameId,
  key: `open-slot:${gameId}:${round}`,
  expectsReply: false,
});

export const confirmationRequestIntent = (
  gameId: string,
  refereeId: string,
  attempt: 'initial' | 'follow-up',
): NotificationIntent => ({
  kind: attempt === 'initial' ? 'confirmation-request' : 'confirmation-follow-up',
  recipientIds: [refereeId],
  gameId,
  key: `confirmation:${gameId}:${refereeId}:${attempt}`,
  expectsReply: true,
});

export const promotionOfferIntent = (
  gameId: string,
  refereeId: string,
  slotIndex: number,
): NotificationIntent => ({
  kind: 'promotion-offer',
  recipientIds: [refereeId],
  gameId,
  key: `promotion:${gameId}:${slotIndex}:${refereeId}`,
  expectsReply: true,
});

export const relocationIntent = (
  gameId: string,
  recipientIds: readonly string[],
  version: number,
): NotificationIntent => ({
  kind: 'relocation',
  recipientIds,
  gameId,
  key: `relocation:${gameId}:${version}`,
  expectsReply: true,
});

export const personalReminderIntent = (
  gameId: string,
  refereeId: string,
  hoursBefore: number,
): NotificationIntent => ({
  kind: 'personal-reminder',
  recipientIds: [refereeId],
  gameId,
  key: `reminder:${gameId}:${refereeId}:${hoursBefore}`,
  expectsReply: false,
});
