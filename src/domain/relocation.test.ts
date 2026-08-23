import { describe, expect, it } from 'vitest';
import { inDays, makeGame, NOW, slotsFrom } from './__fixtures__/build';
import { applyRelocationDecline, relocationNotices } from './relocation';

const input = (occupants: readonly (string | null)[] = ['r-jk', 'r-lb', 'r-tf', null]) => ({
  game: makeGame({ kickoff: inDays(10), venue: 'Zeppelinhalle', state: 'moved' as const }),
  slots: slotsFrom(occupants),
  previousKickoff: inDays(9),
  previousVenue: 'Sporthalle Nordstadt, Feld 2',
  now: NOW,
});

describe('Regel 17 — beim Verschieben werden Schiedsrichter und Ersatz gleich behandelt', () => {
  it('benachrichtigt jeden belegten Platz, Ersatz eingeschlossen', () => {
    const notices = relocationNotices(input());
    expect(notices.map((n) => n.refereeId)).toEqual(['r-jk', 'r-lb', 'r-tf']);
  });

  it('gibt jedem — auch dem Ersatz — die Absage-Option', () => {
    for (const notice of relocationNotices(input())) {
      expect(notice.canDecline).toBe(true);
    }
  });

  it('benachrichtigt niemanden fuer freie Plaetze', () => {
    expect(relocationNotices(input([null, null, null, null]))).toHaveLength(0);
  });

  it('nennt den neuen Termin, den neuen Ort und die eigene Rolle', () => {
    const notice = relocationNotices(input())[2];
    expect(notice?.detail).toContain('Zeppelinhalle');
    expect(notice?.detail).toContain('Ersatz 1');
    expect(notice?.detail).toContain('in 10 Tagen');
  });

  it('benennt die Art der Aenderung', () => {
    const both = relocationNotices(input())[0];
    expect(both?.headline).toContain('verschoben und in eine andere Halle verlegt');

    const timeOnly = relocationNotices({
      ...input(),
      previousVenue: 'Zeppelinhalle',
    })[0];
    expect(timeOnly?.headline).toContain('verschoben');
    expect(timeOnly?.headline).not.toContain('Halle');

    const venueOnly = relocationNotices({
      ...input(),
      previousKickoff: inDays(10),
    })[0];
    expect(venueOnly?.headline).toContain('in eine andere Halle verlegt');
  });
});

describe('Regel 18 — eine Absage oeffnet den Platz sofort', () => {
  it('gibt den Platz des Schiedsrichters frei und startet die Kaskade', () => {
    expect(applyRelocationDecline(slotsFrom(['r-jk', 'r-lb', 'r-tf', null]), 'r-jk')).toEqual({
      vacatedSlot: 0,
      startsPromotionCascade: true,
    });
  });

  it('gibt den Ersatzplatz frei, ohne die Kaskade zu starten', () => {
    expect(applyRelocationDecline(slotsFrom(['r-jk', 'r-lb', 'r-tf', null]), 'r-tf')).toEqual({
      vacatedSlot: 2,
      startsPromotionCascade: false,
    });
  });

  it('tut nichts fuer jemanden, der gar nicht eingetragen ist', () => {
    expect(applyRelocationDecline(slotsFrom(['r-jk', null, null, null]), 'r-xx')).toBeNull();
  });
});
