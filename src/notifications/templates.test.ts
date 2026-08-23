import { describe, expect, it } from 'vitest';
import { NOW, inHours, makeGame } from '@/domain/__fixtures__/build';
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
    expect(rendered.body).not.toContain('Hier antworten');
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
    const rendered = renderMessage('open-slot-announcement', ctx());
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
