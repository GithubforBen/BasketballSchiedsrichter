import { describe, expect, it } from 'vitest';
import { slotsFrom } from './__fixtures__/build';
import { isAssigned, nextFreeSlot, slotKind, slotOf, substituteSlots, refereeSlots } from './slots';
import { SLOT_COUNT } from './types';

describe('Regel 1 — zwei Schiedsrichter und zwei Ersatzplaetze', () => {
  it('hat genau vier Plaetze', () => {
    expect(slotsFrom([null, null, null, null])).toHaveLength(SLOT_COUNT);
  });

  it('ordnet Platz 0 und 1 den Schiedsrichtern, 2 und 3 dem Ersatz zu', () => {
    expect(slotKind(0)).toBe('referee');
    expect(slotKind(1)).toBe('referee');
    expect(slotKind(2)).toBe('substitute');
    expect(slotKind(3)).toBe('substitute');
  });

  it('teilt die Plaetze in zwei gleich grosse Gruppen', () => {
    const slots = slotsFrom([null, null, null, null]);
    expect(refereeSlots(slots)).toHaveLength(2);
    expect(substituteSlots(slots)).toHaveLength(2);
  });
});

describe('Regel 2 — Plaetze werden der Reihe nach vergeben', () => {
  it('nennt bei leerem Spiel Schiri 1', () => {
    expect(nextFreeSlot(slotsFrom([null, null, null, null]))?.index).toBe(0);
  });

  it('geht von Schiri 1 ueber Schiri 2 zu den Ersatzplaetzen', () => {
    expect(nextFreeSlot(slotsFrom(['a', null, null, null]))?.index).toBe(1);
    expect(nextFreeSlot(slotsFrom(['a', 'b', null, null]))?.index).toBe(2);
    expect(nextFreeSlot(slotsFrom(['a', 'b', 'c', null]))?.index).toBe(3);
  });

  it('gibt null zurueck, wenn alle vier Plaetze besetzt sind', () => {
    expect(nextFreeSlot(slotsFrom(['a', 'b', 'c', 'd']))).toBeNull();
  });

  it('nennt eine Luecke vor einem belegten Platz — nach einer Austragung', () => {
    // Schiri 1 hat sich ausgetragen, Schiri 2 steht noch. Der naechste freie
    // Platz ist wieder Schiri 1, nicht der erste unbelegte Ersatzplatz.
    expect(nextFreeSlot(slotsFrom([null, 'b', 'c', 'd']))?.index).toBe(0);
  });
});

describe('Regel 5 — niemand belegt zwei Plaetze im selben Spiel', () => {
  it('findet die eigene Belegung', () => {
    const slots = slotsFrom(['a', 'b', null, null]);
    expect(slotOf(slots, 'b')?.index).toBe(1);
    expect(isAssigned(slots, 'b')).toBe(true);
  });

  it('meldet niemanden, der nicht eingetragen ist', () => {
    expect(isAssigned(slotsFrom(['a', null, null, null]), 'z')).toBe(false);
    expect(slotOf(slotsFrom(['a', null, null, null]), 'z')).toBeNull();
  });
});
