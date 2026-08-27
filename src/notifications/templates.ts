import { CLUB } from '@/config/club';
import { matchdayLabel, timeLabel } from '@/domain/schedule';
import { SLOT_LABELS } from '@/domain/slots';
import { describeHours, describeLeadTime } from '@/domain/time';
import type { NotificationKind } from '@/domain/notifications';
import type { Game, SlotIndex } from '@/domain/types';
import { TOKEN_LIFETIME_MINUTES } from '@/server/auth/tokens';
import { answerLink } from './action-links';

/**
 * Die Texte der ausgehenden Nachrichten.
 *
 * An einer Stelle gesammelt, weil sie beim Umstieg auf die WhatsApp Cloud API
 * als freigegebene Vorlagen hinterlegt werden muessen — dann aendert sich der
 * Versandweg, nicht der Wortlaut.
 *
 * `renderMessage` ist bewusst rein: dieselbe Funktion erzeugt den Text fuer den
 * Versand und fuer die Vorschau unter /dev/outbox. Was dort steht, geht auch
 * genau so raus — es gibt keinen zweiten Weg, auf dem ein anderer Text
 * entstehen koennte.
 *
 * Zwei Regeln gelten fuer **jede** Nachricht zu einem Spiel:
 *
 * 1. **Datum und Vorlauf stehen immer beide drin** — "Sa 29.08.2026, 10:30 Uhr"
 *    sagt, welches Spiel gemeint ist, "Anpfiff in 3 Tagen" sagt, wie eilig es
 *    ist. Wer nur das eine liest, muss nicht nachrechnen oder nachschlagen.
 * 2. **Kein Hinweis auf einen moeglichen Nachfolger.** Kein "sonst besetzen wir
 *    den Platz neu", kein "sonst fragen wir den naechsten Ersatz". Wer liest,
 *    dass sich ohnehin jemand findet, sagt eher ab. Was passiert, wenn niemand
 *    antwortet, ist eine Sache der Anwendung und nicht der Nachricht.
 */

export interface RenderedMessage {
  /** Betreff. WhatsApp kennt keinen, E-Mail schon. */
  subject: string;
  body: string;
}

export const loginMessage = (params: {
  name: string;
  link: string;
  code: string;
}): RenderedMessage => ({
  subject: `Anmeldung bei ${CLUB.appName}`,
  body: [
    `Hallo ${params.name},`,
    '',
    `hier ist dein Zugang zur Schiedsrichter-Planung der ${CLUB.name}:`,
    '',
    params.link,
    '',
    `Falls der Link nicht funktioniert, gib diesen Code ein: ${params.code}`,
    '',
    `Beides gilt ${TOKEN_LIFETIME_MINUTES} Minuten und nur ein einziges Mal.`,
    'Hast du dich nicht angemeldet? Dann ignoriere diese Nachricht einfach.',
  ].join('\n'),
});

/** Alles, was ein Text ueber seinen Anlass wissen muss. */
export interface MessageContext {
  /** Anrede. Der volle Name ist nur nach Anmeldung sichtbar (Regel 29). */
  recipientName: string;
  /**
   * Das betroffene Spiel, frisch gelesen. Absichtlich nicht in der Outbox
   * gespeichert: verschiebt sich der Anpfiff zwischen Anlegen und Versand,
   * soll die Nachricht den neuen Termin nennen und nicht den alten.
   */
  game: Game | null;
  payload: Readonly<Record<string, unknown>>;
  baseUrl: string;
  timeZone: string;
  now: Date;
  /**
   * Der eindeutige Antwortlink dieser Nachricht, schon signiert.
   *
   * Er benennt Vorgang, Spiel und Person — damit eine Bestaetigung genau das
   * Spiel trifft, um das gebeten wurde, und kein anderes. Nachrichten ohne
   * Rueckfrage haben keinen; sie verweisen auf den Kalender.
   */
  answerToken: string | null;
}

/** "Sa 29.08.2026, 10:30 Uhr · U14 · BG Nordstadt gegen TV Ostheim". */
export const gameLine = (game: Game, timeZone: string): string =>
  `${matchdayLabel(game.kickoff, timeZone)}, ${timeLabel(game.kickoff, timeZone)} Uhr · ` +
  `${game.leagueId} · ${game.home} gegen ${game.away}`;

const text = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const number = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const lines = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

const slotLabel = (value: unknown): string => {
  const index = number(value);
  return index !== null && index >= 0 && index <= 3 ? SLOT_LABELS[index as SlotIndex] : 'einen Platz';
};

const greeting = (name: string): string => `Hallo ${name},`;

const signature = (baseUrl: string, path: string, hint: string): readonly string[] => [
  '',
  hint,
  `${baseUrl}${path}`,
];

/**
 * Setzt die Zeilen einer Nachricht zusammen.
 *
 * `null` heisst "diese Angabe gibt es hier nicht" und faellt weg; der leere
 * Text ist eine gewollte Leerzeile und bleibt stehen. Vorher fielen beide weg,
 * weil die Zusammensetzung jede leere Zeile aussortierte — die Nachrichten
 * hatten dadurch keinen einzigen Absatz.
 */
const paragraphs = (...linesOfText: readonly (string | null)[]): string =>
  linesOfText.filter((entry): entry is string => entry !== null).join('\n');

/**
 * Der Knopf ans Ende der Nachricht.
 *
 * Erwartet die Nachricht eine Antwort, fuehrt er auf ihren eindeutigen Link —
 * genau dieses Spiel, genau diese Person, genau dieser Vorgang. Fehlt der
 * Token, bleibt der Kalender als Weg: eine Nachricht ohne jeden Verweis waere
 * schlechter als eine mit einem allgemeinen.
 */
const answerSignature = (
  ctx: MessageContext,
  hint: string,
  fallbackPath: string,
): readonly string[] => [
  '',
  hint,
  ctx.answerToken ? answerLink(ctx.baseUrl, ctx.answerToken) : `${ctx.baseUrl}${fallbackPath}`,
];

/**
 * Der Text einer Nachricht.
 *
 * Fehlt das Spiel — etwa weil es zwischen Anlegen und Versand geloescht wurde —
 * bleibt eine verstaendliche Nachricht uebrig, statt "undefined" zu verschicken.
 */
export const renderMessage = (kind: NotificationKind, ctx: MessageContext): RenderedMessage => {
  const { game, timeZone, baseUrl, recipientName } = ctx;
  const line = game ? gameLine(game, timeZone) : 'ein Spiel, das inzwischen entfallen ist';
  const venue = game ? `Ort: ${game.venue}` : null;
  const lead = game ? describeLeadTime(game.kickoff, ctx.now) : '';

  switch (kind) {
    case 'login':
      /*
       * Anmeldenachrichten tragen Link und Code, die es nach dem Anlegen nicht
       * mehr gibt — sie werden deshalb als Einzige beim Anlegen fertig
       * geschrieben und hier nur noch durchgereicht.
       */
      return {
        subject: text(ctx.payload['subject'], `Anmeldung bei ${CLUB.appName}`),
        body: text(ctx.payload['body']),
      };

    case 'assignment':
      return {
        subject: 'Dein Einsatz steht',
        body: paragraphs(
          greeting(recipientName),
          '',
          `du stehst als ${slotLabel(ctx.payload['slotIndex'])} fuer:`,
          line,
          venue,
          `Anpfiff ${lead}.`,
          '',
          'Rechtzeitig vor Anpfiff bitten wir dich noch um eine Bestaetigung.',
          ...signature(baseUrl, '/kalender', 'Dein Kalender:'),
        ),
      };

    case 'confirmation-request':
      return {
        subject: 'Bitte bestaetige deinen Einsatz',
        body: paragraphs(
          greeting(recipientName),
          '',
          `bitte bestaetige kurz, dass du pfeifst:`,
          line,
          venue,
          `Anpfiff ${lead}.`,
          ...answerSignature(ctx, 'Hier bestaetigst du genau dieses Spiel:', '/kalender'),
        ),
      };

    case 'confirmation-follow-up':
      return {
        subject: 'Deine Bestaetigung steht noch aus',
        body: paragraphs(
          greeting(recipientName),
          '',
          'wir haben noch keine Rueckmeldung von dir zu:',
          line,
          venue,
          `Anpfiff ${lead}.`,
          '',
          /*
           * Frueher stand hier "sonst muessen wir den Platz neu besetzen".
           * Genau das gehoert nicht in eine Nachricht: wer liest, dass sich
           * ohnehin ein Ersatz findet, sagt eher ab als zu.
           */
          'Bitte gib uns kurz Bescheid — ein Tippen genuegt.',
          ...answerSignature(ctx, 'Hier bestaetigst du genau dieses Spiel:', '/kalender'),
        ),
      };

    case 'promotion-offer': {
      const respondBy = text(ctx.payload['respondBy']);
      const deadline = respondBy
        ? `Bitte antworte bis ${matchdayLabel(new Date(respondBy), timeZone)}, ${timeLabel(new Date(respondBy), timeZone)} Uhr.`
        : 'Bitte antworte moeglichst bald.';
      return {
        subject: 'Rueckst du nach?',
        body: paragraphs(
          greeting(recipientName),
          '',
          `du stehst als Ersatz, und ${slotLabel(ctx.payload['targetSlot'])} ist frei geworden:`,
          line,
          venue,
          `Anpfiff ${lead}.`,
          '',
          /*
           * Kein "sonst fragen wir den naechsten Ersatz": das ist derselbe
           * Hinweis auf einen Nachfolger, der schon bei der Bestaetigung zur
           * Absage einlaedt. Die Frist steht da, das genuegt.
           */
          deadline,
          ...answerSignature(ctx, 'Hier antwortest du auf genau diese Anfrage:', '/kalender'),
        ),
      };
    }

    case 'open-slot-announcement': {
      /*
       * Dieselbe Luecke, zwei Leserkreise: alle Qualifizierten sollen sich
       * eintragen, die Admins sollen den Platz besetzen. Steht die
       * Ausschreibung auf "nur Admins", waere "wer sich zuerst eintraegt"
       * eine Aufforderung an Leute, die dafuer gar nicht qualifiziert sein
       * muessen.
       */
      const toAdmins = text(ctx.payload['audience']) === 'admins';
      return {
        subject: toAdmins ? 'Ein Platz ist frei — bitte besetzen' : 'Ein Platz ist frei',
        body: paragraphs(
          greeting(recipientName),
          '',
          'fuer dieses Spiel fehlt noch jemand:',
          line,
          venue,
          `Anpfiff ${lead}.`,
          '',
          toAdmins
            ? 'Diese Luecke geht nur an die Admins. Bitte besetzt den Platz.'
            : 'Wer sich zuerst eintraegt, bekommt den Platz.',
          ...signature(baseUrl, toAdmins ? '/uebersicht' : '/spiele', toAdmins ? 'Zur Uebersicht:' : 'Hier eintragen:'),
        ),
      };
    }

    case 'relocation': {
      const previousKickoff = text(ctx.payload['previousKickoff']);
      const previousVenue = text(ctx.payload['previousVenue']);
      const before = previousKickoff
        ? `Bisher: ${matchdayLabel(new Date(previousKickoff), timeZone)}, ${timeLabel(new Date(previousKickoff), timeZone)} Uhr` +
          (previousVenue ? `, ${previousVenue}` : '')
        : null;
      const cancelled = game?.state === 'cancelled';
      return {
        subject: cancelled ? 'Spiel abgesagt' : 'Neuer Termin',
        body: paragraphs(
          greeting(recipientName),
          '',
          cancelled ? 'dieses Spiel faellt aus:' : 'dieses Spiel wurde verlegt:',
          line,
          venue,
          before,
          cancelled ? null : `Anpfiff ${lead}.`,
          '',
          cancelled
            ? 'Du musst nichts weiter tun.'
            : 'Passt der neue Termin? Wenn nicht, gib den Platz bitte gleich frei.',
          ...(cancelled
            ? []
            : answerSignature(ctx, 'Hier antwortest du zu genau diesem Spiel:', '/kalender')),
        ),
      };
    }

    case 'personal-reminder': {
      const hoursBefore = number(ctx.payload['hoursBefore']);
      const heading =
        hoursBefore === null
          ? 'Erinnerung an deinen Einsatz'
          : /*
             * Nominativ, nicht Dativ: die Massangabe steht vor der Praeposition
             * ("3 Tage vor Anpfiff"), nicht dahinter ("in 3 Tagen").
             */
            `Erinnerung: ${describeHours(hoursBefore)} vor Anpfiff`;
      return {
        subject: heading,
        body: paragraphs(
          greeting(recipientName),
          '',
          `${heading}:`,
          line,
          venue,
          `Anpfiff ${lead}.`,
          ...signature(baseUrl, '/kalender', 'Dein Kalender:'),
        ),
      };
    }

    case 'admin-alert':
      return {
        subject: 'Meldung aus der Schiedsrichter-Planung',
        body: paragraphs(
          greeting(recipientName),
          '',
          text(ctx.payload['detail'], 'es gibt eine Meldung zu einem Spiel.'),
          ...signature(baseUrl, '/meldungen', 'Alle Meldungen:'),
        ),
      };

    case 'daily-digest': {
      const entries = lines(ctx.payload['lines']);
      return {
        subject: 'Tagesuebersicht Schiedsrichter-Planung',
        body: paragraphs(
          greeting(recipientName),
          '',
          entries.length === 1 ? 'ein Spiel braucht Aufmerksamkeit:' : `${entries.length} Spiele brauchen Aufmerksamkeit:`,
          ...entries.map((entry) => `- ${entry}`),
          ...signature(baseUrl, '/uebersicht', 'Zur Uebersicht:'),
        ),
      };
    }
  }
};
