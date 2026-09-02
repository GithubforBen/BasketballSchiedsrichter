import { CLUB } from '@/config/club';
import { matchdayLabel, timeLabel } from '@/domain/schedule';
import { SLOT_LABELS } from '@/domain/slots';
import { describeHours, describeLeadTime } from '@/domain/time';
import type { NotificationKind } from '@/domain/notifications';
import type { Game, SlotIndex } from '@/domain/types';
import { TOKEN_LIFETIME_MINUTES } from '@/server/auth/tokens';
import { answerLink } from './action-links';

/**
 * Die Texte der ausgehenden Nachrichten — und zugleich ihre WhatsApp-Vorlagen.
 *
 * Ausserhalb des 24-Stunden-Fensters nimmt Meta nur freigegebene Vorlagen an,
 * und das Fenster steht bei einem Verein so gut wie nie offen. Jede Nachricht
 * steht deshalb hier als **Vorlagentext mit `{{1}}`, `{{2}}` …** und einer
 * Liste ihrer Werte. Daraus entsteht beides:
 *
 * - fuer WhatsApp der Vorlagen-Aufruf (Name, Sprache, Parameter, Knopfwert),
 * - fuer E-Mail, Entwicklung und die Vorschau unter /dev/outbox der Fliesstext,
 *   indem dieselben Werte in denselben Text eingesetzt werden.
 *
 * Damit kann der Wortlaut zwischen Vorschau und Versand nicht auseinanderlaufen:
 * es gibt genau eine Quelle, und der Fliesstext ist ihre eingesetzte Fassung.
 * Was hier steht, ist zugleich das, was bei Meta einzureichen ist — siehe
 * `docs/whatsapp-vorlagen.md`.
 *
 * Drei Regeln gelten fuer **jede** Nachricht zu einem Spiel:
 *
 * 1. **Datum und Vorlauf stehen immer beide drin** — "Sa 29.08.2026, 10:30 Uhr"
 *    sagt, welches Spiel gemeint ist, "Anpfiff in 3 Tagen" sagt, wie eilig es
 *    ist. Wer nur das eine liest, muss nicht nachrechnen oder nachschlagen.
 * 2. **Kein Hinweis auf einen moeglichen Nachfolger.** Kein "sonst besetzen wir
 *    den Platz neu", kein "sonst fragen wir den naechsten Ersatz". Wer liest,
 *    dass sich ohnehin jemand findet, sagt eher ab. Was passiert, wenn niemand
 *    antwortet, ist eine Sache der Anwendung und nicht der Nachricht.
 * 3. **Angesprochen wird mit dem Vornamen.** "Hallo Jonas", nicht "Hallo Jonas
 *    Keller" — eine Nachricht an einen Menschen, kein Serienbrief.
 */

/** Sprache aller Vorlagen. Bei Meta unter genau diesem Kuerzel angelegt. */
export const TEMPLATE_LANGUAGE = 'de';

/**
 * Der Vorlagen-Aufruf, so wie ihn die Cloud API braucht.
 *
 * `parameters` sind die Werte fuer `{{1}}` bis `{{n}}` des Textteils, in
 * genau dieser Reihenfolge. `buttonParameter` ist der Wert der **einen**
 * Variablen eines dynamischen URL-Knopfes — Meta erlaubt dort genau eine, und
 * nur am Ende der Adresse. Ein statischer Knopf hat keinen: seine Adresse
 * steht fest in der freigegebenen Vorlage.
 */
export interface OutgoingTemplate {
  name: string;
  language: string;
  parameters: readonly string[];
  buttonParameter: string | null;
}

export interface RenderedMessage {
  /** Betreff. WhatsApp kennt keinen, E-Mail schon. */
  subject: string;
  /** Der fertige Fliesstext fuer E-Mail, Entwicklung und Vorschau. */
  body: string;
  /**
   * Die Vorlage fuer WhatsApp. `null` heisst: fuer diese Nachricht ist keine
   * hinterlegt — dann bleibt nur der Fliesstext, und der geht ausserhalb des
   * 24-Stunden-Fensters nicht raus.
   */
  template: OutgoingTemplate | null;
}

/**
 * Ein Wert fuer eine Vorlagen-Variable.
 *
 * Meta laesst darin **keine Zeilenumbrueche**, Tabulatoren oder laengeren
 * Leerraum zu; eine Vorlage mit so einem Wert wird beim Versand abgelehnt.
 * Betroffen ist vor allem die Liste der Tagesuebersicht, die deshalb zu einer
 * Zeile verbunden wird.
 */
const singleLine = (value: string): string => value.replace(/\s+/g, ' ').trim();

/** Setzt die Werte in den Vorlagentext ein — `{{1}}` ist `params[0]`. */
export const fillTemplate = (text: string, params: readonly string[]): string =>
  text.replace(/\{\{(\d+)\}\}/g, (_match, index: string) => params[Number(index) - 1] ?? '');

/**
 * Der Knopf am Ende einer Nachricht.
 *
 * `parameter` unterscheidet die beiden Arten: ist er gesetzt, ist der Knopf
 * dynamisch und traegt den eindeutigen Antwort-Token dieser Nachricht; ist er
 * null, steht die Adresse fest in der Vorlage.
 */
interface Button {
  label: string;
  /** Die vollstaendige Adresse — fuer den Fliesstext. */
  href: string;
  parameter: string | null;
}

/** Ein fertiger Entwurf, aus dem Fliesstext und Vorlagen-Aufruf entstehen. */
interface Draft {
  subject: string;
  /** Name der freigegebenen Vorlage bei Meta. */
  template: string;
  /** Der Vorlagentext, Wort fuer Wort wie eingereicht. */
  text: string;
  /** Die Werte fuer `{{1}}` … `{{n}}`. */
  params: readonly string[];
  button: Button | null;
}

const render = (draft: Draft): RenderedMessage => {
  const params = draft.params.map(singleLine);
  const body = draft.button
    ? `${fillTemplate(draft.text, params)}\n\n${draft.button.label}:\n${draft.button.href}`
    : fillTemplate(draft.text, params);

  return {
    subject: draft.subject,
    body,
    template: {
      name: draft.template,
      language: TEMPLATE_LANGUAGE,
      parameters: params,
      buttonParameter: draft.button?.parameter ?? null,
    },
  };
};

/**
 * Die Anmeldenachricht.
 *
 * Sie entsteht als Einzige beim Anlegen und nicht beim Versand: Link und Code
 * gibt es danach nicht mehr. Ueber WhatsApp geht davon nur der **Code** raus —
 * in eine AUTHENTICATION-Vorlage passt kein Link. Ueber E-Mail geht weiterhin
 * beides.
 */
export const LOGIN_TEMPLATE = 'schiriplan_anmeldung';

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
  template: {
    name: LOGIN_TEMPLATE,
    language: TEMPLATE_LANGUAGE,
    parameters: [params.code],
    buttonParameter: null,
  },
});

/** Alles, was ein Text ueber seinen Anlass wissen muss. */
export interface MessageContext {
  /**
   * Anrede: der Vorname. Der volle Name ist nur nach Anmeldung sichtbar
   * (Regel 29) und in einer Nachricht ohnehin zu foermlich.
   */
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

/** "Sa 29.08.2026, 10:30 Uhr" — nur der Termin, ohne Liga und Mannschaften. */
export const dateLine = (at: Date, timeZone: string): string =>
  `${matchdayLabel(at, timeZone)}, ${timeLabel(at, timeZone)} Uhr`;

const text = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const number = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const count = (value: unknown): number => number(value) ?? 0;

const lines = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

const slotLabel = (value: unknown): string => {
  const index = number(value);
  return index !== null && index >= 0 && index <= 3 ? SLOT_LABELS[index as SlotIndex] : 'ein Platz';
};

/** Ein Knopf mit fester Adresse — die Nachricht erwartet keine Antwort. */
const linkButton = (baseUrl: string, path: string, label: string): Button => ({
  label,
  href: `${baseUrl}${path}`,
  parameter: null,
});

/**
 * Ein Knopf auf den eindeutigen Antwortlink dieser Nachricht.
 *
 * Fehlt der Token — das Spiel ist verschwunden oder abgesagt —, bleibt der
 * Kalender als Weg: eine Nachricht ohne jeden Verweis waere schlechter als
 * eine mit einem allgemeinen. Ohne Token ist der Knopf dann auch nicht mehr
 * dynamisch, und die Vorlage bekommt keinen Knopfwert.
 */
const answerButton = (ctx: MessageContext, label: string): Button =>
  ctx.answerToken
    ? { label, href: answerLink(ctx.baseUrl, ctx.answerToken), parameter: ctx.answerToken }
    : linkButton(ctx.baseUrl, '/kalender', label);

/**
 * Der Text einer Nachricht.
 *
 * Fehlt das Spiel — etwa weil es zwischen Anlegen und Versand geloescht wurde —
 * bleibt eine verstaendliche Nachricht uebrig, statt "undefined" zu verschicken.
 */
export const renderMessage = (kind: NotificationKind, ctx: MessageContext): RenderedMessage => {
  const { game, timeZone, baseUrl, recipientName } = ctx;
  const line = game ? gameLine(game, timeZone) : 'ein Spiel, das inzwischen entfallen ist';
  const venue = game ? game.venue : 'unbekannt';
  const lead = game ? describeLeadTime(game.kickoff, ctx.now) : 'unbekannt';

  switch (kind) {
    case 'login':
      /*
       * Anmeldenachrichten tragen Link und Code, die es nach dem Anlegen nicht
       * mehr gibt — sie werden deshalb als Einzige beim Anlegen fertig
       * geschrieben und hier nur noch durchgereicht. Fuer die Vorlage zaehlt
       * allein der Code.
       */
      return {
        subject: text(ctx.payload['subject'], `Anmeldung bei ${CLUB.appName}`),
        body: text(ctx.payload['body']),
        template: {
          name: LOGIN_TEMPLATE,
          language: TEMPLATE_LANGUAGE,
          parameters: [text(ctx.payload['code'])],
          buttonParameter: null,
        },
      };

    case 'assignment':
      /*
       * Die Quittung fuer die eigene Handlung. Frueher endete sie mit "rechtzeitig
       * vor Anpfiff bitten wir dich noch um eine Bestaetigung" — das hat mehr
       * verwirrt als geholfen: die Bitte kommt ohnehin als eigene Nachricht,
       * und wer sie hier schon liest, haelt die Quittung faelschlich fuer sie.
       */
      return render({
        subject: 'Dein Einsatz steht',
        template: 'schiriplan_einsatz_steht',
        text: [
          'Hallo {{1}},',
          '',
          'du stehst als {{2}} für das Spiel:',
          '{{3}}',
          'Ort: {{4}}',
          'Anpfiff {{5}}.',
          '',
          'Vielen Dank für Deinen Einsatz!',
        ].join('\n'),
        params: [recipientName, slotLabel(ctx.payload['slotIndex']), line, venue, lead],
        button: linkButton(baseUrl, '/kalender', 'Zum Kalender'),
      });

    case 'confirmation-request':
      return render({
        subject: 'Bitte bestätige deinen Einsatz',
        template: 'schiriplan_bestaetigung_erbeten',
        text: [
          'Hallo {{1}},',
          '',
          'bitte bestätige kurz, dass du an Deinen Einsatz denkst:',
          '{{2}}',
          'Ort: {{3}}',
          'Anpfiff {{4}}.',
          '',
          'Tippe unten, um zu bestätigen.',
        ].join('\n'),
        params: [recipientName, line, venue, lead],
        button: answerButton(ctx, 'Jetzt bestätigen'),
      });

    case 'confirmation-follow-up':
      return render({
        subject: 'Deine Bestätigung steht noch aus',
        template: 'schiriplan_bestaetigung_offen',
        text: [
          'Hallo {{1}},',
          '',
          'wir haben noch keine Rückmeldung von dir zu:',
          '{{2}}',
          'Ort: {{3}}',
          'Anpfiff {{4}}.',
          '',
          /*
           * Frueher stand hier "sonst muessen wir den Platz neu besetzen".
           * Genau das gehoert nicht in eine Nachricht: wer liest, dass sich
           * ohnehin ein Ersatz findet, sagt eher ab als zu.
           */
          'Bitte gib uns kurz Bescheid, dass du an Deinen Einsatz denkst — ein Tippen genügt.',
        ].join('\n'),
        params: [recipientName, line, venue, lead],
        button: answerButton(ctx, 'Jetzt bestätigen'),
      });

    case 'promotion-offer': {
      const respondBy = text(ctx.payload['respondBy']);
      const deadline = respondBy ? dateLine(new Date(respondBy), timeZone) : 'möglichst bald';
      return render({
        subject: 'Rückst du nach?',
        template: 'schiriplan_nachruecken',
        text: [
          'Hallo {{1}},',
          '',
          'du bist als Ersatz eingetragen, und {{2}} ist frei geworden:',
          '{{3}}',
          'Ort: {{4}}',
          'Anpfiff {{5}}.',
          '',
          /*
           * Kein "sonst fragen wir den naechsten Ersatz": das ist derselbe
           * Hinweis auf einen Nachfolger, der schon bei der Bestaetigung zur
           * Absage einlaedt. Die Frist steht da, das genuegt.
           */
          'Bitte sage bis {{6}} zu oder ab.',
        ].join('\n'),
        params: [
          recipientName,
          slotLabel(ctx.payload['targetSlot']),
          line,
          venue,
          lead,
          deadline,
        ],
        button: answerButton(ctx, 'Zu oder Absagen'),
      });
    }

    case 'open-slot-announcement':
      return render({
        subject: 'Ein Platz ist frei',
        template: 'schiriplan_platz_frei',
        text: [
          'Hallo {{1}},',
          '',
          'für dieses Spiel fehlt uns noch ein Schiedsrichter:',
          '{{2}}',
          'Ort: {{3}}',
          'Anpfiff {{4}}.',
          '',
          'Bitte, schau nochmal, ob du das Spiel vielleicht übernehmen kannst.',
        ].join('\n'),
        params: [recipientName, line, venue, lead],
        button: linkButton(baseUrl, '/spiele', 'Offene Spiele'),
      });

    case 'admin-open-slots': {
      /*
       * Dieselbe Luecke, anderer Leserkreis — und deshalb ein ganz anderer
       * Zuschnitt: die Qualifizierten hoeren von *einem* Spiel, die Admins von
       * *allen*. Eine Nachricht je offenem Platz waere fuer sie unbrauchbar;
       * was sie brauchen, ist der Stand der Saison und die Dringlichkeit des
       * naechsten Falls. Ersatzplaetze zaehlen dabei nicht mit: sie sind kein
       * Loch im Spielplan.
       */
      const nextKickoff = text(ctx.payload['nextKickoff']);
      /*
       * Der Satz lautet "startet in {{4}}" — das "in" steht schon im
       * Vorlagentext, der Wert traegt nur die Dauer ("3 Tagen").
       */
      const untilNext = nextKickoff
        ? describeLeadTime(new Date(nextKickoff), ctx.now).replace(/^in /, '')
        : 'unbekannter Zeit';
      return render({
        subject: 'Offene Schiedsrichter-Plätze',
        template: 'schiriplan_platz_frei_admin',
        text: [
          'Hallo {{1}},',
          '',
          'diese Saison fehlen noch für {{2}} Spiele Schiedsrichter.',
          '',
          '{{3}} Spiele haben noch gar keinen Schiedsrichter.',
          '',
          'Das nächste Spiel mit Lücke startet in {{4}}.',
          '',
          'Bitte, kümmere dich darum, dass die Spiele besetzt werden.',
        ].join('\n'),
        params: [
          recipientName,
          String(count(ctx.payload['gamesWithGap'])),
          String(count(ctx.payload['gamesWithoutAny'])),
          untilNext,
        ],
        button: linkButton(baseUrl, '/uebersicht', 'Übersicht'),
      });
    }

    case 'relocation': {
      /*
       * Verlegt und abgesagt sind zwei Vorlagen, nicht eine: bei einer Absage
       * gibt es nichts zu entscheiden, und ein "Passt der neue Termin?" waere
       * dort sinnlos. Unterschieden wird am frisch gelesenen Zustand des
       * Spiels, nicht am Inhalt der Outbox-Zeile — wird ein verlegtes Spiel
       * vor dem Versand doch abgesagt, geht die Absage raus.
       */
      if (game?.state === 'cancelled') {
        return render({
          subject: 'Spiel abgesagt',
          template: 'schiriplan_spiel_abgesagt',
          text: [
            'Hallo {{1}},',
            '',
            'dieses Spiel fällt aus:',
            '{{2}}',
            'Ort: {{3}}',
            '',
            'Du musst nichts weiter tun.',
          ].join('\n'),
          params: [recipientName, line, venue],
          button: null,
        });
      }

      const previousKickoff = text(ctx.payload['previousKickoff']);
      const previousVenue = text(ctx.payload['previousVenue'], venue);
      /*
       * Der bisherige Termin traegt Liga und Mannschaften mit: er beantwortet
       * die erste Frage des Lesers — welches Spiel ist gemeint? Der neue
       * Termin steht daneben und braucht sie nicht zu wiederholen.
       */
      const previousLine =
        previousKickoff && game
          ? `${dateLine(new Date(previousKickoff), timeZone)} · ${game.leagueId} · ${game.home} gegen ${game.away}`
          : line;
      return render({
        subject: 'Neuer Termin',
        template: 'schiriplan_termin_geaendert',
        text: [
          'Hallo {{1}},',
          '',
          'du bist als Schiedsrichter für dieses Spiel eingetragen:',
          '{{2}}',
          'Ort: {{3}}',
          '',
          'Das Spiel wurde verlegt:',
          '',
          'Neue Zeit: {{4}}',
          '',
          'Neuer Ort: {{5}}.',
          'Anpfiff {{6}}.',
          '',
          'Passt der neue Termin?',
          'Bitte sag zu oder ab.',
        ].join('\n'),
        params: [
          recipientName,
          previousLine,
          previousVenue,
          game ? dateLine(game.kickoff, timeZone) : 'unbekannt',
          venue,
          lead,
        ],
        button: answerButton(ctx, 'Zu oder Absagen'),
      });
    }

    case 'personal-reminder': {
      const hoursBefore = number(ctx.payload['hoursBefore']);
      /*
       * Nominativ, nicht Dativ: die Massangabe steht vor der Praeposition
       * ("3 Tage vor Anpfiff"), nicht dahinter ("in 3 Tagen").
       */
      const before = hoursBefore === null ? 'kurz' : describeHours(hoursBefore);
      return render({
        subject:
          hoursBefore === null
            ? 'Erinnerung an deinen Einsatz'
            : `Erinnerung: ${before} vor Anpfiff`,
        template: 'schiriplan_erinnerung',
        text: [
          'Hallo {{1}},',
          '',
          'Erinnerung: {{2}} vor Anpfiff.',
          '{{3}}',
          'Ort: {{4}}',
          'Anpfiff {{5}}.',
          '',
          'Bis dann!',
        ].join('\n'),
        params: [recipientName, before, line, venue, lead],
        button: linkButton(baseUrl, '/kalender', 'Zum Kalender'),
      });
    }

    case 'admin-alert':
      /*
       * Spiel und Anlass stehen getrennt: die Vorlage nennt in {{2}} das Spiel
       * und in {{3}}, was daran offen ist. Frueher war beides ein Satz — der
       * liess sich nicht auf zwei Variablen aufteilen.
       */
      return render({
        subject: 'Meldung aus der Schiedsrichter-Planung',
        template: 'schiriplan_meldung',
        text: [
          'Hallo {{1}},',
          '',
          'es gibt eine Meldung zu einem Spiel:',
          '{{2}}',
          '',
          '{{3}}',
          '',
          'Bitte in der Spielübersicht nachsehen und das Problem lösen.',
        ].join('\n'),
        params: [
          recipientName,
          line,
          text(ctx.payload['detail'], 'Bitte in der Spielübersicht nachsehen.'),
        ],
        button: linkButton(baseUrl, '/meldungen', 'Meldungen'),
      });

    case 'daily-digest': {
      const entries = lines(ctx.payload['lines']);
      /*
       * Meta laesst in einem Variablenwert keinen Zeilenumbruch zu. Die Liste
       * wird deshalb mit " · " zu einer Zeile verbunden — im Fliesstext sieht
       * das genauso aus wie in der Vorlage, damit Vorschau und Versand nicht
       * auseinanderlaufen.
       */
      return render({
        subject: 'Tagesübersicht Schiedsrichter-Planung',
        template: 'schiriplan_tagesuebersicht',
        text: [
          'Hallo {{1}},',
          '',
          '{{2}} Spiele brauchen Aufmerksamkeit:',
          '{{3}}',
          '',
          'Die vollständige Liste steht in der Spielübersicht.',
        ].join('\n'),
        params: [recipientName, String(entries.length), entries.join(' · ')],
        button: linkButton(baseUrl, '/uebersicht', 'Übersicht'),
      });
    }
  }
};
