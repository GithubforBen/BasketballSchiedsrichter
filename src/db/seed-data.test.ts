import { describe, expect, it } from 'vitest';
import { CLUB } from '@/config/club';
import { buildSlots, nextFreeSlot } from '@/domain/slots';
import { gameStatus } from '@/domain/status';
import type { Assignment, SlotIndex } from '@/domain/types';
import { SEED_GAMES, SEED_REFEREES, toKickoff } from './seed-data';

const slotsOf = (occupants: readonly (string | null)[]) =>
  buildSlots(
    occupants.flatMap((refereeId, index): Assignment[] =>
      refereeId === null
        ? []
        : [
            {
              gameId: 'x',
              slotIndex: index as SlotIndex,
              refereeId,
              confirmedAt: null,
              playedAsReferee: null,
            },
          ],
    ),
  );

describe('Seed-Daten spiegeln das Mockup', () => {
  it('deckt alle vier Statuszustaende ab', () => {
    const states = new Set(SEED_GAMES.map((g) => gameStatus(slotsOf(g.slots)).status));
    expect(states).toEqual(new Set(['open', 'refereeMissing', 'substituteMissing', 'filled']));
  });

  it('enthaelt einen Spielstand mit Luecke — den Zustand nach einer Austragung', () => {
    // Regel 2 vergibt Plaetze der Reihe nach, aber eine Austragung reisst ein
    // Loch in die Mitte: Schiri 2 ist frei, waehrend Ersatz 1 besetzt bleibt.
    // Ohne diesen Fall im Seed wuerde die Oberflaeche nie dagegen gebaut.
    const withGap = SEED_GAMES.filter((game) => {
      const firstFree = game.slots.indexOf(null);
      return firstFree !== -1 && game.slots.slice(firstFree + 1).some((s) => s !== null);
    });
    expect(withGap.map((g) => g.id)).toEqual(['g3']);
  });

  it('bietet in einem solchen Spiel die Luecke als naechsten Platz an', () => {
    const gap = SEED_GAMES.find((g) => g.id === 'g3');
    expect(gap).toBeDefined();
    expect(nextFreeSlot(slotsOf(gap?.slots ?? []))?.index).toBe(1);
  });

  it('traegt niemanden zweimal in dasselbe Spiel ein', () => {
    for (const game of SEED_GAMES) {
      const occupants = game.slots.filter((s): s is string => s !== null);
      expect(new Set(occupants).size, `Spiel ${game.id}`).toBe(occupants.length);
    }
  });

  it('traegt nur Personen mit passender Qualifikation ein', () => {
    const byId = new Map(SEED_REFEREES.map((r) => [r.id, r]));
    for (const game of SEED_GAMES) {
      for (const refereeId of game.slots.filter((s): s is string => s !== null)) {
        const referee = byId.get(refereeId);
        expect(referee, `${refereeId} fehlt in den Seed-Personen`).toBeDefined();
        expect(
          referee?.qualifications,
          `${referee?.name} ist nicht fuer ${game.leagueId} qualifiziert (${game.id})`,
        ).toContain(game.leagueId);
      }
    }
  });

  it('haelt Regel 6 ein: niemand steht an einem Tag in zwei Spielen', () => {
    const perDay = new Map<string, Set<string>>();
    for (const game of SEED_GAMES) {
      const day = game.kickoffLocal.slice(0, 10);
      const seen = perDay.get(day) ?? new Set<string>();
      for (const refereeId of game.slots.filter((s): s is string => s !== null)) {
        expect(seen.has(refereeId), `${refereeId} steht am ${day} in zwei Spielen`).toBe(false);
        seen.add(refereeId);
      }
      perDay.set(day, seen);
    }
  });

  it('vergibt eindeutige Kuerzel', () => {
    const initials = SEED_REFEREES.map((r) => r.initials);
    expect(new Set(initials).size).toBe(initials.length);
  });

  it('rechnet Ortszeit korrekt nach UTC — Sommerzeit eingeschlossen', () => {
    expect(toKickoff('2026-08-22T10:30', CLUB.timeZone).toISOString()).toBe(
      '2026-08-22T08:30:00.000Z',
    );
    expect(toKickoff('2026-01-10T10:30', CLUB.timeZone).toISOString()).toBe(
      '2026-01-10T09:30:00.000Z',
    );
  });
});
