import { describe, expect, it } from 'vitest';
import { NOW, inDays, inHours, makeGame } from '@/domain/__fixtures__/build';
import { CLUB } from '@/config/club';
import { gameLine, loginMessage, renderMessage, type MessageContext } from './templates';
import type { NotificationKind } from '@/domain/notifications';

/**
 * Die Texte. Ein Test pro Nachrichtenart, damit keine Art stillschweigend
 * leer bleibt — eine leere Nachricht kostet genauso viel wie eine gute.
 */

const ctx = (over: Partial<MessageContext> = {}): MessageContext => ({
  recipientName: 'Jonas Keller',
  game: makeGame({ kickoff: inHours(30) }),
  payload: {},
  baseUrl: 'https://schiriplan.test',
  timeZone: CLUB.timeZone,
  now: NOW,
  answerToken: 'AAA.BBB',
  ...over,
});

const ALL_KINDS: readonly NotificationKind[] = [
  'assignment',
  'confirmation-request',
  'confirmation-follow-up',
  'promotion-offer',
  'open-slot-announcement',
  'admin-open-slots',
  'relocation',
  'personal-reminder',
  'admin-alert',
  'daily-digest',
  'login',
];

/** Ein Inhalt, der zu jeder Art passt — die Arten lesen daraus, was sie brauchen. */
const EVERY_PAYLOAD = {
  subject: 'Anmeldung',
  body: 'Dein Link',
  code: '123456',
  lines: ['BG Nordstadt gegen TV Ostheim: Schiedsrichter 1 offen.'],
  detail: 'Eine Bestaetigung fehlt.',
  hoursBefore: 24,
  slotIndex: 0,
  targetSlot: 1,
  respondBy: inHours(5).toISOString(),
  gamesWithGap: 4,
  gamesWithoutAny: 1,
  nextKickoff: inHours(30).toISOString(),
} as const;

describe('Jede Nachrichtenart hat einen Text', () => {
  it.each(ALL_KINDS)('%s ergibt Betreff und Inhalt', (kind) => {
    const rendered = renderMessage(
      kind,
      ctx({ payload: EVERY_PAYLOAD }),
    );
    expect(rendered.subject.length).toBeGreaterThan(0);
    expect(rendered.body.length).toBeGreaterThan(0);
    expect(rendered.body).not.toContain('undefined');
    expect(rendered.body).not.toContain('NaN');
  });

  it('nennt Termin, Liga und Mannschaften in einer Zeile', () => {
    const game = makeGame({ kickoff: new Date('2026-08-29T08:30:00Z') });
    expect(gameLine(game, CLUB.timeZone)).toBe(
      'Sa 29.08.2026, 10:30 Uhr · U14 · BG Nordstadt gegen TV Ostheim',
    );
  });
});

describe('Regel 21 — die Erinnerung nennt ihren Vorlauf', () => {
  it('setzt die Massangabe vor die Praeposition: "7 Tage vor Anpfiff"', () => {
    const rendered = renderMessage('personal-reminder', ctx({ payload: { hoursBefore: 168 } }));
    expect(rendered.subject).toBe('Erinnerung: 7 Tage vor Anpfiff');
  });

  it('nutzt den Dativ dort, wo er hingehoert: "Anpfiff in 1 Tag 6 Std"', () => {
    const rendered = renderMessage('confirmation-request', ctx({ payload: {} }));
    expect(rendered.body).toContain('Anpfiff in 1 Tag 6 Std.');
  });

  it('bleibt lesbar, wenn der Vorlauf fehlt', () => {
    const rendered = renderMessage('personal-reminder', ctx({ payload: {} }));
    expect(rendered.subject).toBe('Erinnerung an deinen Einsatz');
  });
});

describe('Jede Nachricht zu einem Spiel nennt Datum und Vorlauf', () => {
  /*
   * Die allgemeine Regel: das Datum sagt, welches Spiel gemeint ist, der
   * Vorlauf, wie eilig es ist. Keins von beiden darf fehlen — sonst muss der
   * Empfaenger nachschlagen oder nachrechnen.
   */
  const WITH_GAME: readonly NotificationKind[] = [
    'assignment',
    'confirmation-request',
    'confirmation-follow-up',
    'promotion-offer',
    'open-slot-announcement',
    'relocation',
    'personal-reminder',
  ];

  it.each(WITH_GAME)('%s nennt Anpfiff-Datum und "in wie vielen Tagen"', (kind) => {
    const rendered = renderMessage(
      kind,
      ctx({
        game: makeGame({ kickoff: inDays(2) }),
        payload: { slotIndex: 0, targetSlot: 1, hoursBefore: 24 },
      }),
    );
    expect(rendered.body).toContain('Mo 03.08.2026, 14:00 Uhr');
    expect(rendered.body).toContain('Anpfiff in 2 Tagen');
  });

  it('nennt auch beim abgesagten Spiel den Termin, um den es geht', () => {
    const rendered = renderMessage(
      'relocation',
      ctx({ game: makeGame({ kickoff: inDays(2), state: 'cancelled' }) }),
    );
    expect(rendered.body).toContain('Mo 03.08.2026, 14:00 Uhr');
  });
});

describe('Keine Nachricht stellt einen Nachfolger in Aussicht', () => {
  /*
   * Wer liest, dass der Platz sowieso neu besetzt wird, sagt eher ab. Die
   * Regel gilt fuer alle Nachrichten und nicht nur fuer die Nachfassnachricht,
   * an der sie aufgefallen ist.
   */
  const FORBIDDEN = ['neu besetzen', 'naechsten Ersatz', 'nächsten Ersatz', 'jemand anderen'];

  it.each(ALL_KINDS)('%s spricht nicht von Ersatz fuer den Empfaenger', (kind) => {
    const rendered = renderMessage(
      kind,
      ctx({ payload: EVERY_PAYLOAD }),
    );
    for (const phrase of FORBIDDEN) expect(rendered.body).not.toContain(phrase);
  });
});

describe('Antworten laufen ueber einen eindeutigen Link', () => {
  const ASKING: readonly NotificationKind[] = [
    'confirmation-request',
    'confirmation-follow-up',
    'promotion-offer',
    'relocation',
  ];

  it.each(ASKING)('%s verlinkt genau diesen Vorgang', (kind) => {
    const rendered = renderMessage(kind, ctx({ payload: { targetSlot: 1 } }));
    expect(rendered.body).toContain('https://schiriplan.test/antwort/AAA.BBB');
    expect(rendered.body).not.toContain('https://schiriplan.test/kalender');
  });

  it('bleibt ohne Token beim Kalender, statt ins Leere zu zeigen', () => {
    const rendered = renderMessage('confirmation-request', ctx({ answerToken: null }));
    expect(rendered.body).toContain('https://schiriplan.test/kalender');
  });

  it('verlinkt nichts, wo es nichts zu beantworten gibt', () => {
    const rendered = renderMessage('personal-reminder', ctx({ payload: { hoursBefore: 24 } }));
    expect(rendered.body).not.toContain('/antwort/');
  });
});

describe('Die Admins bekommen eine Bilanz, keine Einzelnachricht', () => {
  /*
   * Zehn Luecken ergeben fuer einen Admin eine Nachricht und nicht zehn: was er
   * braucht, ist der Stand der Saison und die Dringlichkeit des naechsten
   * Falls, nicht zehnmal derselbe Aufruf.
   */
  it('nennt beide Zahlen und den Vorlauf des naechsten Falls', () => {
    const rendered = renderMessage(
      'admin-open-slots',
      ctx({
        payload: {
          gamesWithGap: 7,
          gamesWithoutAny: 2,
          nextKickoff: inDays(3).toISOString(),
        },
      }),
    );
    expect(rendered.body).toContain('für 7 Spiele Schiedsrichter');
    expect(rendered.body).toContain('2 Spiele haben noch gar keinen Schiedsrichter');
    expect(rendered.body).toContain('startet in 3 Tagen');
    expect(rendered.body).toContain('https://schiriplan.test/uebersicht');
  });

  it('nennt keinen Vorlauf, den es nicht gibt', () => {
    const rendered = renderMessage(
      'admin-open-slots',
      ctx({ payload: { gamesWithGap: 1, gamesWithoutAny: 0, nextKickoff: null } }),
    );
    expect(rendered.body).not.toContain('undefined');
    expect(rendered.body).not.toContain('NaN');
  });
});

describe('Regel 17 — die Verschiebung nennt den alten Termin', () => {
  it('stellt alt und neu gegenueber', () => {
    const rendered = renderMessage(
      'relocation',
      ctx({
        game: makeGame({ kickoff: new Date('2026-09-05T08:30:00Z'), state: 'moved' }),
        payload: {
          previousKickoff: '2026-08-29T08:30:00Z',
          previousVenue: 'Sporthalle Nordstadt, Feld 2',
        },
      }),
    );
    // Zuerst das Spiel, das der Leser kennt — mit seinem bisherigen Termin.
    expect(rendered.body).toContain('Sa 29.08.2026, 10:30 Uhr · U14 · BG Nordstadt gegen TV Ostheim');
    expect(rendered.body).toContain('Neue Zeit: Sa 05.09.2026, 10:30 Uhr');
    expect(rendered.body).toContain('Neuer Ort: Sporthalle Nordstadt, Feld 2.');
  });

  it('bittet bei einer Absage nicht um eine Antwort — es gibt nichts zu entscheiden', () => {
    const rendered = renderMessage(
      'relocation',
      ctx({ game: makeGame({ state: 'cancelled' }), payload: {} }),
    );
    expect(rendered.subject).toBe('Spiel abgesagt');
    expect(rendered.body).not.toContain('/antwort/');
  });
});

describe('Regeln 13 und 14 — die Nachrueck-Anfrage nennt ihre Frist', () => {
  it('schreibt die Antwortfrist als Datum und Uhrzeit', () => {
    const rendered = renderMessage(
      'promotion-offer',
      ctx({ payload: { targetSlot: 0, respondBy: '2026-08-01T20:00:00Z' } }),
    );
    expect(rendered.body).toContain('Bitte sage bis Sa 01.08.2026, 22:00 Uhr zu oder ab.');
    expect(rendered.body).toContain('Schiedsrichter 1');
    // Der Knopf sagt, was er tut — zusagen oder absagen, beides an einer Stelle.
    expect(rendered.body).toContain('Zu oder Absagen:');
  });

  it('bleibt verstaendlich, wenn die Frist fehlt', () => {
    const rendered = renderMessage('promotion-offer', ctx({ payload: {} }));
    expect(rendered.body).toContain('möglichst bald');
    expect(rendered.body).toContain('ein Platz ist frei geworden');
  });
});

describe('Die Ausschreibung fragt, ob jemand das Spiel uebernimmt', () => {
  it('bittet um Uebernahme und verlinkt die offenen Spiele', () => {
    const rendered = renderMessage('open-slot-announcement', ctx({ payload: { round: 0 } }));
    expect(rendered.body).toContain('fehlt uns noch ein Schiedsrichter');
    expect(rendered.body).toContain('ob du das Spiel vielleicht übernehmen kannst');
    expect(rendered.body).toContain('https://schiriplan.test/spiele');
  });
});

describe('Jede Nachricht traegt ihre WhatsApp-Vorlage', () => {
  /*
   * Ausserhalb des 24-Stunden-Fensters nimmt Meta nur eine freigegebene Vorlage
   * an. Eine Art ohne Vorlage koennte also gar nicht zugestellt werden — das
   * faellt hier auf und nicht erst beim Empfaenger.
   */
  it.each(ALL_KINDS)('%s nennt Name und Parameter', (kind) => {
    const rendered = renderMessage(kind, ctx({ payload: EVERY_PAYLOAD }));
    expect(rendered.template?.name).toMatch(/^schiriplan_[a-z_]+$/);
    expect(rendered.template?.language).toBe('de');
    for (const value of rendered.template?.parameters ?? []) {
      // Meta laesst in einem Variablenwert keinen Zeilenumbruch zu.
      expect(value).not.toMatch(/[\n\t]/);
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('gibt den Antwort-Token als Knopfwert mit, wo eine Antwort erwartet wird', () => {
    const rendered = renderMessage('confirmation-request', ctx());
    expect(rendered.template?.buttonParameter).toBe('AAA.BBB');
  });

  it('laesst den Knopfwert weg, wo die Adresse fest in der Vorlage steht', () => {
    const rendered = renderMessage('personal-reminder', ctx({ payload: { hoursBefore: 24 } }));
    expect(rendered.template?.buttonParameter).toBeNull();
  });

  it('verbindet die Liste der Tagesuebersicht zu einer Zeile', () => {
    const rendered = renderMessage(
      'daily-digest',
      ctx({ payload: { lines: ['Erste Zeile.', 'Zweite Zeile.'] } }),
    );
    expect(rendered.template?.parameters[2]).toBe('Erste Zeile. · Zweite Zeile.');
  });
});

describe('Ein entfallenes Spiel bricht keine Nachricht', () => {
  it('schreibt einen verstaendlichen Satz statt "undefined"', () => {
    const rendered = renderMessage('personal-reminder', ctx({ game: null }));
    expect(rendered.body).toContain('inzwischen entfallen');
    expect(rendered.body).not.toContain('undefined');
  });
});

describe('Die Anmeldenachricht bleibt beim Anlegen geschrieben', () => {
  it('reicht den gespeicherten Text unveraendert durch', () => {
    const stored = loginMessage({ name: 'Jonas Keller', link: 'https://x/y', code: '123456' });
    const rendered = renderMessage(
      'login',
      ctx({ payload: { subject: stored.subject, body: stored.body, code: '123456' } }),
    );
    expect(rendered).toEqual(stored);
  });
});
