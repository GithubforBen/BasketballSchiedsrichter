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

/**
 * Alle Nachrichtenarten, als Liste und nicht nur als Typ.
 *
 * Die Outbox liest ihre Art als Text aus der Datenbank zurueck. Eine Art, die
 * es nicht mehr gibt — etwa nach einem Umbau, waehrend alte Zeilen noch warten
 * — muss auffallen und darf nicht als leere Nachricht rausgehen: die kostet
 * genauso viel wie eine gute (Regel 33). Deshalb ist die Liste die Quelle und
 * der Typ folgt aus ihr.
 */
export const NOTIFICATION_KINDS = [
  /** Regel 31: Bestaetigung an die Person, die sich gerade eingetragen hat. */
  'assignment',
  /** Regel 10: Pflichtbestaetigung mit Antwortknopf. */
  'confirmation-request',
  /** Regel 11: Erneute Erinnerung, wenn die Bestaetigung ausbleibt. */
  'confirmation-follow-up',
  /** Regeln 13-14: Anfrage an einen Ersatz, ob er nachrueckt. */
  'promotion-offer',
  /** Regel 15 / 32: Ausschreibung eines offenen Platzes an alle Qualifizierten. */
  'open-slot-announcement',
  /** Regel 15 / 32: Tagesbilanz der offenen Plaetze fuer die Admins. */
  'admin-open-slots',
  /** Regel 17: Neuer Termin mit Absage-Option. */
  'relocation',
  /** Regel 21: Persoenliche Erinnerung vor Anpfiff. */
  'personal-reminder',
  /** Regel 20: Meldung an die Admins. */
  'admin-alert',
  /** Regel 20: Taegliche Zusammenfassung fuer die Admins. */
  'daily-digest',
  /** Anmeldung: Magic-Link und Code. */
  'login',
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const isNotificationKind = (value: string): value is NotificationKind =>
  (NOTIFICATION_KINDS as readonly string[]).includes(value);

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
  /**
   * Angaben, die der Text braucht und die spaeter nicht mehr rekonstruierbar
   * sind — der Vorlauf einer Erinnerung, die Antwortfrist einer Nachfrage, der
   * alte Termin einer Verschiebung. Spiel und Person werden beim Versand frisch
   * gelesen und stehen deshalb absichtlich nicht hier.
   */
  payload: Readonly<Record<string, unknown>>;
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
  payload: { slotIndex },
});

/**
 * Regel 32: Der offene Platz wird allen Qualifizierten ausgeschrieben.
 * Die Reihenfolge kommt aus der Rotation (Regel 19) und bleibt hier erhalten.
 *
 * Der Schluessel traegt zwei Zaehler. `vacancyVersion` steigt, sobald ein Platz
 * neu frei wird — ohne ihn bliebe die zweite Ausschreibung desselben Spiels
 * stumm, weil sie wie eine Wiederholung der ersten aussaehe. `round` ist die
 * Stufe der Nachfrage und sorgt dafuer, dass die Erinnerung mit naeher
 * rueckendem Anpfiff erneut rausgeht.
 */
export const openSlotAnnouncementIntent = (
  gameId: string,
  recipientIds: readonly string[],
  vacancyVersion: number,
  round: number,
): NotificationIntent => ({
  kind: 'open-slot-announcement',
  recipientIds,
  gameId,
  key: `open-slot:${gameId}:${vacancyVersion}:${round}`,
  expectsReply: false,
  payload: { round },
});

/**
 * Die Tagesbilanz der offenen Plaetze fuer die Admins. Regeln 15 und 32.
 *
 * Sie ist bewusst **keine** Nachricht je Spiel: ein Admin, der zehn Luecken
 * hat, braucht keine zehn Nachrichten mit demselben Aufruf, sondern eine mit
 * dem Stand der Saison. Deshalb haengt der Schluessel am Kalendertag und nicht
 * am Spiel — sie geht hoechstens einmal am Tag raus.
 *
 * Ersatzplaetze zaehlen nicht mit: ein fehlender Ersatz ist keine Luecke im
 * Spielplan, sondern ein fehlendes Polster.
 */
export const adminOpenSlotsIntent = (
  adminIds: readonly string[],
  day: string,
  summary: {
    /** Spiele, bei denen Schiedsrichter 1 oder 2 unbesetzt ist. */
    gamesWithGap: number;
    /** Spiele, bei denen beide Schiedsrichter-Plaetze unbesetzt sind. */
    gamesWithoutAny: number;
    /** Anpfiff des naechsten Spiels mit Luecke. */
    nextKickoff: Date | null;
  },
): NotificationIntent => ({
  kind: 'admin-open-slots',
  recipientIds: adminIds,
  gameId: null,
  key: `open-slots-admin:${day}`,
  expectsReply: false,
  payload: {
    gamesWithGap: summary.gamesWithGap,
    gamesWithoutAny: summary.gamesWithoutAny,
    nextKickoff: summary.nextKickoff?.toISOString() ?? null,
  },
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
  payload: {},
});

/**
 * Regel 13: Anfrage an einen Ersatz.
 *
 * Der Schluessel haengt an der Anfrage selbst, nicht an Spiel und Platz. Sonst
 * bliebe eine zweite Nachrueck-Runde stumm: traegt sich jemand aus, nachdem
 * derselbe Ersatz schon einmal fuer denselben Platz gefragt wurde, waere der
 * Schluessel derselbe und die Nachricht wuerde als Doppelung verworfen.
 */
export const promotionOfferIntent = (
  offerId: string,
  gameId: string,
  refereeId: string,
  targetSlot: number,
  respondBy: Date,
): NotificationIntent => ({
  kind: 'promotion-offer',
  recipientIds: [refereeId],
  gameId,
  key: `promotion:${offerId}`,
  expectsReply: true,
  /*
   * Die Id der Anfrage steht im Inhalt und nicht nur im Schluessel: der
   * eindeutige Antwortlink haengt an ihr, und ein Schluessel ist zum Zerlegen
   * da schlecht geeignet — er ist ein Text, dessen Aufbau sich aendern darf.
   */
  payload: { offerId, targetSlot, respondBy: respondBy.toISOString() },
});

export const relocationIntent = (
  gameId: string,
  recipientIds: readonly string[],
  version: number,
  previous: { kickoff: Date; venue: string },
): NotificationIntent => ({
  kind: 'relocation',
  recipientIds,
  gameId,
  key: `relocation:${gameId}:${version}`,
  expectsReply: true,
  payload: {
    version,
    previousKickoff: previous.kickoff.toISOString(),
    previousVenue: previous.venue,
  },
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
  payload: { hoursBefore },
});

/**
 * Regel 11 und 20: Meldung an alle Admins.
 *
 * `subject` benennt den Vorgang, auf den sich die Meldung bezieht — bei einer
 * ueberfaelligen Bestaetigung die Person. Er steckt im Schluessel, damit zwei
 * offene Bestaetigungen desselben Spiels zwei Meldungen ergeben und nicht eine.
 */
export const adminAlertIntent = (
  gameId: string,
  adminIds: readonly string[],
  reason: string,
  subject: string,
  /**
   * Was los ist — **ohne** das Spiel zu nennen. Die Vorlage trennt beides:
   * das Spiel steht in einer eigenen Variablen und wird beim Versand frisch
   * gelesen, damit ein zwischenzeitlich verlegtes Spiel den neuen Termin
   * zeigt und nicht den, der beim Anlegen galt.
   */
  detail: string,
): NotificationIntent => ({
  kind: 'admin-alert',
  recipientIds: adminIds,
  gameId,
  key: `admin-alert:${reason}:${gameId}:${subject}`,
  expectsReply: false,
  payload: { reason, detail },
});

/**
 * Regel 20: eine Zusammenfassung pro Kalendertag, nicht pro Lauf.
 *
 * Eine Absicht **je Admin**, nicht eine an alle: der Zeitraum steht im Profil
 * und kann sich von Admin zu Admin unterscheiden, also unterscheidet sich auch
 * die Liste. Der Schluessel bleibt derselbe — er ist zusammen mit dem
 * Empfaenger eindeutig, und das genuegt gegen den Doppelversand.
 */
export const dailyDigestIntent = (
  adminId: string,
  day: string,
  lines: readonly string[],
): NotificationIntent => ({
  kind: 'daily-digest',
  recipientIds: [adminId],
  gameId: null,
  key: `digest:${day}`,
  expectsReply: false,
  payload: { lines },
});
