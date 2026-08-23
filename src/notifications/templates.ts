import { CLUB } from '@/config/club';
import { matchdayLabel, timeLabel } from '@/domain/schedule';
import { SLOT_LABELS } from '@/domain/slots';
import { describeHours, describeLeadTime } from '@/domain/time';
import type { NotificationKind } from '@/domain/notifications';
import type { Game, SlotIndex } from '@/domain/types';
import { TOKEN_LIFETIME_MINUTES } from '@/server/auth/tokens';

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
 * Der Text einer Nachricht.
 *
 * Fehlt das Spiel — etwa weil es zwischen Anlegen und Versand geloescht wurde —
 * bleibt eine verstaendliche Nachricht uebrig, statt "undefined" zu verschicken.
 */
export const renderMessage = (kind: NotificationKind, ctx: MessageContext): RenderedMessage => {
  const { game, timeZone, baseUrl, recipientName } = ctx;
  const line = game ? gameLine(game, timeZone) : 'ein Spiel, das inzwischen entfallen ist';
  const venue = game ? `Ort: ${game.venue}` : '';
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
        body: [
          greeting(recipientName),
          '',
          `du stehst als ${slotLabel(ctx.payload['slotIndex'])} fuer:`,
          line,
          venue,
          '',
          'Rechtzeitig vor Anpfiff bitten wir dich noch um eine Bestaetigung.',
          ...signature(baseUrl, '/kalender', 'Dein Kalender:'),
        ]
          .filter((l) => l !== '')
          .join('\n'),
      };

    case 'confirmation-request':
      return {
        subject: 'Bitte bestaetige deinen Einsatz',
        body: [
          greeting(recipientName),
          '',
          `bitte bestaetige kurz, dass du pfeifst:`,
          line,
          venue,
          `Anpfiff ${lead}.`,
          ...signature(baseUrl, '/kalender', 'Hier bestaetigen:'),
        ]
          .filter((l) => l !== '')
          .join('\n'),
      };

    case 'confirmation-follow-up':
      return {
        subject: 'Deine Bestaetigung steht noch aus',
        body: [
          greeting(recipientName),
          '',
          'wir haben noch keine Rueckmeldung von dir zu:',
          line,
          venue,
          `Anpfiff ${lead}.`,
          '',
          'Bitte melde dich kurz — sonst muessen wir den Platz neu besetzen.',
          ...signature(baseUrl, '/kalender', 'Hier bestaetigen:'),
        ]
          .filter((l) => l !== '')
          .join('\n'),
      };

    case 'promotion-offer': {
      const respondBy = text(ctx.payload['respondBy']);
      const deadline = respondBy
        ? `Bitte antworte bis ${matchdayLabel(new Date(respondBy), timeZone)}, ${timeLabel(new Date(respondBy), timeZone)} Uhr.`
        : 'Bitte antworte moeglichst bald.';
      return {
        subject: 'Rueckst du nach?',
        body: [
          greeting(recipientName),
          '',
          `du stehst als Ersatz, und ${slotLabel(ctx.payload['targetSlot'])} ist frei geworden:`,
          line,
          venue,
          `Anpfiff ${lead}.`,
          '',
          deadline,
          'Ohne Antwort fragen wir den naechsten Ersatz.',
          ...signature(baseUrl, '/kalender', 'Hier antworten:'),
        ]
          .filter((l) => l !== '')
          .join('\n'),
      };
    }

    case 'open-slot-announcement':
      return {
        subject: 'Ein Platz ist frei',
        body: [
          greeting(recipientName),
          '',
          'fuer dieses Spiel fehlt noch jemand:',
          line,
          venue,
          `Anpfiff ${lead}.`,
          '',
          'Wer sich zuerst eintraegt, bekommt den Platz.',
          ...signature(baseUrl, '/spiele', 'Hier eintragen:'),
        ]
          .filter((l) => l !== '')
          .join('\n'),
      };

    case 'relocation': {
      const previousKickoff = text(ctx.payload['previousKickoff']);
      const previousVenue = text(ctx.payload['previousVenue']);
      const before = previousKickoff
        ? `Bisher: ${matchdayLabel(new Date(previousKickoff), timeZone)}, ${timeLabel(new Date(previousKickoff), timeZone)} Uhr` +
          (previousVenue ? `, ${previousVenue}` : '')
        : '';
      const cancelled = game?.state === 'cancelled';
      return {
        subject: cancelled ? 'Spiel abgesagt' : 'Neuer Termin',
        body: [
          greeting(recipientName),
          '',
          cancelled ? 'dieses Spiel faellt aus:' : 'dieses Spiel wurde verlegt:',
          line,
          venue,
          before,
          '',
          cancelled
            ? 'Du musst nichts weiter tun.'
            : 'Passt der neue Termin? Wenn nicht, gib den Platz bitte gleich frei.',
          ...(cancelled ? [] : signature(baseUrl, '/kalender', 'Hier antworten:')),
        ]
          .filter((l) => l !== '')
          .join('\n'),
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
        body: [
          greeting(recipientName),
          '',
          `${heading}:`,
          line,
          venue,
          ...signature(baseUrl, '/kalender', 'Dein Kalender:'),
        ]
          .filter((l) => l !== '')
          .join('\n'),
      };
    }

    case 'admin-alert':
      return {
        subject: 'Meldung aus der Schiedsrichter-Planung',
        body: [
          greeting(recipientName),
          '',
          text(ctx.payload['detail'], 'es gibt eine Meldung zu einem Spiel.'),
          ...signature(baseUrl, '/meldungen', 'Alle Meldungen:'),
        ]
          .filter((l) => l !== '')
          .join('\n'),
      };

    case 'daily-digest': {
      const entries = lines(ctx.payload['lines']);
      return {
        subject: 'Tagesuebersicht Schiedsrichter-Planung',
        body: [
          greeting(recipientName),
          '',
          entries.length === 1 ? 'ein Spiel braucht Aufmerksamkeit:' : `${entries.length} Spiele brauchen Aufmerksamkeit:`,
          ...entries.map((entry) => `- ${entry}`),
          ...signature(baseUrl, '/uebersicht', 'Zur Uebersicht:'),
        ]
          .filter((l) => l !== '')
          .join('\n'),
      };
    }
  }
};
