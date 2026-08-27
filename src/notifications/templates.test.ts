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
  'relocation',
  'personal-reminder',
  'admin-alert',
  'daily-digest',
  'login',
];

describe('Jede Nachrichtenart hat einen Text', () => {
  it.each(ALL_KINDS)('%s ergibt Betreff und Inhalt', (kind) => {
    const rendered = renderMessage(
      kind,
      ctx({
        payload: {
          subject: 'Anmeldung',
          body: 'Dein Link',
          lines: ['BG Nordstadt gegen TV Ostheim: Schiedsrichter 1 offen.'],
          detail: 'Eine Bestaetigung fehlt.',
          hoursBefore: 24,
          slotIndex: 0,
          targetSlot: 1,
          respondBy: inHours(5).toISOString(),
        },
      }),
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
      ctx({
        payload: {
          subject: 'Anmeldung',
          body: 'Dein Link',
          lines: ['BG Nordstadt gegen TV Ostheim: Schiedsrichter 1 offen.'],
          detail: 'Eine Bestaetigung fehlt.',
          hoursBefore: 24,
          slotIndex: 0,
          targetSlot: 1,
          respondBy: inHours(5).toISOString(),
        },
      }),
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

describe('Die Ausschreibung kennt ihren Leserkreis', () => {
  it('bittet die Admins, den Platz zu besetzen', () => {
    const rendered = renderMessage(
      'open-slot-announcement',
      ctx({ payload: { round: 0, audience: 'admins' } }),
    );
    expect(rendered.body).toContain('nur an die Admins');
    expect(rendered.body).not.toContain('Wer sich zuerst eintraegt');
  });

  it('fordert alle anderen zum Eintragen auf', () => {
    const rendered = renderMessage(
      'open-slot-announcement',
      ctx({ payload: { round: 0, audience: 'all' } }),
    );
    expect(rendered.body).toContain('Wer sich zuerst eintraegt');
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
    expect(rendered.body).toContain('Sa 05.09.2026');
    expect(rendered.body).toContain('Bisher: Sa 29.08.2026, 10:30 Uhr');
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
    expect(rendered.body).toContain('Bitte antworte bis Sa 01.08.2026, 22:00 Uhr.');
    expect(rendered.body).toContain('Schiedsrichter 1');
  });

  it('bleibt verstaendlich, wenn die Frist fehlt', () => {
    const rendered = renderMessage('promotion-offer', ctx({ payload: {} }));
    expect(rendered.body).toContain('moeglichst bald');
    expect(rendered.body).toContain('einen Platz');
  });
});

describe('Regel 3 — die Ausschreibung sagt, dass es schnell gehen muss', () => {
  it('nennt First come, first served und verlinkt die offenen Spiele', () => {
    const rendered = renderMessage('open-slot-announcement', ctx({ payload: { round: 0 } }));
    expect(rendered.body).toContain('Wer sich zuerst eintraegt');
    expect(rendered.body).toContain('https://schiriplan.test/spiele');
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
      ctx({ payload: { subject: stored.subject, body: stored.body } }),
    );
    expect(rendered).toEqual(stored);
  });
});
