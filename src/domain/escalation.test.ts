import { describe, expect, it } from 'vitest';
import { inHours, makeGame, NOW, settings, slotsFrom } from './__fixtures__/build';
import {
  applyPromotion,
  nextPromotionStep,
  promotionOfferExpired,
  promotionResponseWindowMs,
} from './escalation';
import { hours } from './time';
import type { SlotIndex } from './types';

const step = (occupants: readonly (string | null)[], declined: readonly SlotIndex[] = [], kickoff = inHours(200)) =>
  nextPromotionStep({
    game: makeGame({ kickoff }),
    slots: slotsFrom(occupants),
    declinedSlots: declined,
    settings: settings(),
    now: NOW,
  });

describe('Regel 13 — bei Ausfall wird zuerst Ersatz 1 gefragt', () => {
  it('bietet Ersatz 1 den freien Schiedsrichter-Platz an', () => {
    const result = step([null, 'r-lb', 'r-tf', 'r-ay']);
    expect(result.kind).toBe('offer');
    if (result.kind === 'offer') {
      expect(result.substitute.index).toBe(2);
      expect(result.targetSlot).toBe(0);
    }
  });

  it('tut nichts, solange beide Schiedsrichter-Plaetze besetzt sind', () => {
    expect(step(['a', 'b', 'c', null]).kind).toBe('idle');
  });
});

describe('Regel 14 — nach Ablauf oder Absage ist Ersatz 2 dran', () => {
  it('geht zu Ersatz 2 ueber, wenn Ersatz 1 abgelehnt hat', () => {
    const result = step([null, 'r-lb', 'r-tf', 'r-ay'], [2]);
    expect(result.kind).toBe('offer');
    if (result.kind === 'offer') expect(result.substitute.index).toBe(3);
  });

  it('erkennt eine abgelaufene Frist', () => {
    expect(promotionOfferExpired(inHours(-1), NOW)).toBe(true);
    expect(promotionOfferExpired(inHours(1), NOW)).toBe(false);
    expect(promotionOfferExpired(NOW, NOW)).toBe(true);
  });
});

describe('Regel 15 — danach wird der Platz ausgeschrieben', () => {
  it('schreibt aus, wenn beide Ersatzleute abgelehnt haben', () => {
    const result = step([null, 'r-lb', 'r-tf', 'r-ay'], [2, 3]);
    expect(result).toMatchObject({ kind: 'announce', reason: 'all-declined', targetSlot: 0 });
  });

  it('schreibt sofort aus, wenn es gar keinen Ersatz gibt', () => {
    const result = step([null, 'r-lb', null, null]);
    expect(result).toMatchObject({ kind: 'announce', reason: 'no-substitutes' });
  });

  it('ueberspringt leere Ersatzplaetze und fragt den vorhandenen', () => {
    const result = step([null, 'r-lb', null, 'r-ay']);
    expect(result.kind).toBe('offer');
    if (result.kind === 'offer') expect(result.substitute.index).toBe(3);
  });
});

describe('Regel 16 — Nachruecken belegt den Schiedsrichter-Platz', () => {
  it('macht den Ersatzplatz frei und schiebt nichts nach', () => {
    const result = step([null, 'r-lb', 'r-tf', 'r-ay']);
    expect(result.kind).toBe('offer');
    if (result.kind !== 'offer') return;
    expect(applyPromotion(result)).toEqual({
      targetSlot: 0,
      vacatedSlot: 2,
      refereeId: 'r-tf',
    });
  });
});

describe('Antwortfrist beim Nachruecken', () => {
  it('nutzt den Standardwert, wenn genug Zeit bis zum Anpfiff bleibt', () => {
    const game = makeGame({ kickoff: inHours(200) });
    expect(promotionResponseWindowMs(game, settings(), NOW)).toBe(hours(12));
  });

  it('kuerzt auf ein Drittel der Restzeit, wenn es knapp wird', () => {
    const game = makeGame({ kickoff: inHours(9) });
    expect(promotionResponseWindowMs(game, settings(), NOW)).toBe(hours(3));
  });

  it('geht an der Schwelle stetig ineinander ueber', () => {
    const game = makeGame({ kickoff: inHours(36) });
    expect(promotionResponseWindowMs(game, settings(), NOW)).toBe(hours(12));
  });

  it('gibt null zurueck, wenn der Anpfiff vorbei ist', () => {
    const game = makeGame({ kickoff: inHours(-1) });
    expect(promotionResponseWindowMs(game, settings(), NOW)).toBe(0);
  });
});
