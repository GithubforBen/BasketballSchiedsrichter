import { describe, expect, it } from 'vitest';
import { inHours, makeGame, NOW, settings, slotsFrom } from './__fixtures__/build';
import {
  confirmationDueAt,
  confirmationState,
  needsFollowUp,
  openConfirmations,
} from './confirmation';
import type { Slot } from './types';

const slotsWith = (confirmedAt: Date | null = null) =>
  slotsFrom(['r-jk', 'r-lb', 'r-tf', null], (a) =>
    a.slotIndex === 0 ? { ...a, confirmedAt } : a,
  );

const slotAt = (slots: readonly Slot[], index: number): Slot => {
  const slot = slots[index];
  if (!slot) throw new Error(`Platz ${index} fehlt`);
  return slot;
};

describe('Regel 10 — Pflichtbestaetigung mit einstellbarem Vorlauf', () => {
  it('fordert die Bestaetigung genau den eingestellten Vorlauf vor Anpfiff an', () => {
    const game = makeGame({ kickoff: inHours(100) });
    expect(confirmationDueAt(game, settings({ confirmationLeadHours: 72 }))).toEqual(inHours(28));
  });

  it('meldet "scheduled", solange der Vorlauf nicht erreicht ist', () => {
    const game = makeGame({ kickoff: inHours(73) });
    expect(confirmationState(slotAt(slotsWith(), 0), game, settings(), NOW)).toBe('scheduled');
  });

  it('meldet "pending" ab dem Vorlauf auf die Sekunde genau', () => {
    const game = makeGame({ kickoff: inHours(72) });
    expect(confirmationState(slotAt(slotsWith(), 0), game, settings(), NOW)).toBe('pending');
  });

  it('folgt dem vom Admin eingestellten Vorlauf', () => {
    const game = makeGame({ kickoff: inHours(30) });
    const early = settings({ confirmationLeadHours: 48 });
    const late = settings({ confirmationLeadHours: 24 });
    expect(confirmationState(slotAt(slotsWith(), 0), game, early, NOW)).toBe('pending');
    expect(confirmationState(slotAt(slotsWith(), 0), game, late, NOW)).toBe('scheduled');
  });
});

describe('Regel 11 — Nachfassen nach 24 Stunden ohne Antwort', () => {
  it('bleibt vor Ablauf der Nachfassfrist bei "pending"', () => {
    const game = makeGame({ kickoff: inHours(72 - 23) });
    expect(confirmationState(slotAt(slotsWith(), 0), game, settings(), NOW)).toBe('pending');
    expect(needsFollowUp(slotAt(slotsWith(), 0), game, settings(), NOW)).toBe(false);
  });

  it('wird nach genau 24 Stunden ueberfaellig', () => {
    const game = makeGame({ kickoff: inHours(72 - 24) });
    expect(confirmationState(slotAt(slotsWith(), 0), game, settings(), NOW)).toBe('overdue');
    expect(needsFollowUp(slotAt(slotsWith(), 0), game, settings(), NOW)).toBe(true);
  });

  it('wird nicht ueberfaellig, wenn bereits bestaetigt wurde', () => {
    const game = makeGame({ kickoff: inHours(1) });
    const slots = slotsWith(NOW);
    expect(confirmationState(slotAt(slots, 0), game, settings(), NOW)).toBe('confirmed');
    expect(needsFollowUp(slotAt(slots, 0), game, settings(), NOW)).toBe(false);
  });
});

describe('Regel 12 — nur Schiedsrichter-Plaetze bestaetigen', () => {
  it('verlangt von Ersatzplaetzen keine Bestaetigung', () => {
    const game = makeGame({ kickoff: inHours(1) });
    expect(confirmationState(slotAt(slotsWith(), 2), game, settings(), NOW)).toBe('not-required');
  });

  it('verlangt von freien Plaetzen keine Bestaetigung', () => {
    const game = makeGame({ kickoff: inHours(1) });
    expect(confirmationState(slotAt(slotsWith(), 3), game, settings(), NOW)).toBe('not-required');
  });

  it('zaehlt nur offene Schiedsrichter-Bestaetigungen', () => {
    const game = makeGame({ kickoff: inHours(1) });
    const open = openConfirmations(slotsWith(NOW), game, settings(), NOW);
    expect(open.map((s) => s.index)).toEqual([1]);
  });
});
