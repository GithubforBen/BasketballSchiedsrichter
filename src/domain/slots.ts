import {
  REFEREE_SLOT_COUNT,
  SLOT_INDEXES,
  type Assignment,
  type Slot,
  type SlotIndex,
  type SlotKind,
} from './types';

/** Regel 1: Platz 0 und 1 sind Schiedsrichter, 2 und 3 sind Ersatz. */
export const slotKind = (index: SlotIndex): SlotKind =>
  index < REFEREE_SLOT_COUNT ? 'referee' : 'substitute';

export const SLOT_LABELS: Readonly<Record<SlotIndex, string>> = {
  0: 'Schiedsrichter 1',
  1: 'Schiedsrichter 2',
  2: 'Ersatz 1',
  3: 'Ersatz 2',
};

export const SLOT_LABELS_SHORT: Readonly<Record<SlotIndex, string>> = {
  0: 'Schiri 1',
  1: 'Schiri 2',
  2: 'Ersatz 1',
  3: 'Ersatz 2',
};

/** Baut aus den gespeicherten Belegungen die vollstaendige Platzliste eines Spiels. */
export const buildSlots = (assignments: readonly Assignment[]): readonly Slot[] =>
  SLOT_INDEXES.map((index) => ({
    index,
    kind: slotKind(index),
    assignment: assignments.find((a) => a.slotIndex === index) ?? null,
  }));

export const refereeSlots = (slots: readonly Slot[]): readonly Slot[] =>
  slots.filter((s) => s.kind === 'referee');

export const substituteSlots = (slots: readonly Slot[]): readonly Slot[] =>
  slots.filter((s) => s.kind === 'substitute');

export const occupiedSlots = (slots: readonly Slot[]): readonly Slot[] =>
  slots.filter((s) => s.assignment !== null);

/**
 * Regel 2: Plaetze werden strikt der Reihe nach vergeben.
 * Der einzige belegbare Platz ist der erste freie.
 */
export const nextFreeSlot = (slots: readonly Slot[]): Slot | null =>
  slots.find((s) => s.assignment === null) ?? null;

export const slotOf = (slots: readonly Slot[], refereeId: string): Slot | null =>
  slots.find((s) => s.assignment?.refereeId === refereeId) ?? null;

/** Regel 5: Wer schon auf einem Platz steht, kann keinen zweiten belegen. */
export const isAssigned = (slots: readonly Slot[], refereeId: string): boolean =>
  slotOf(slots, refereeId) !== null;
