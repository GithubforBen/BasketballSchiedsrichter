import { describe, expect, it } from 'vitest';
import { makeAssignment, makeGame } from './__fixtures__/build';
import {
  dateLabel,
  groupByMatchday,
  matchTitle,
  matchdayLabel,
  timeLabel,
  withSlots,
  type GameWithSlots,
} from './schedule';

const TZ = 'Europe/Berlin';

const entry = (id: string, kickoff: string, occupants: readonly (string | null)[] = []): GameWithSlots =>
  withSlots(
    makeGame({ id, kickoff: new Date(kickoff) }),
    occupants.flatMap((refereeId, index) =>
      refereeId === null
        ? []
        : [{ ...makeAssignment(index as 0 | 1 | 2 | 3, refereeId), gameId: id }],
    ),
  );

describe('Gruppierung nach Spieltagen', () => {
  it('fasst Spiele desselben Tages zusammen', () => {
    const days = groupByMatchday(
      [
        entry('a', '2026-08-22T08:30:00Z'),
        entry('b', '2026-08-22T11:00:00Z'),
        entry('c', '2026-08-23T13:00:00Z'),
      ],
      TZ,
    );
    expect(days).toHaveLength(2);
    expect(days[0]?.games.map((g) => g.game.id)).toEqual(['a', 'b']);
    expect(days[1]?.games.map((g) => g.game.id)).toEqual(['c']);
  });

  it('sortiert Tage und Spiele nach Anpfiff', () => {
    const days = groupByMatchday(
      [
        entry('spaet', '2026-08-23T13:00:00Z'),
        entry('zweit', '2026-08-22T11:00:00Z'),
        entry('erst', '2026-08-22T08:30:00Z'),
      ],
      TZ,
    );
    expect(days.map((d) => d.key)).toEqual(['2026-08-22', '2026-08-23']);
    expect(days[0]?.games.map((g) => g.game.id)).toEqual(['erst', 'zweit']);
  });

  it('trennt nach der Vereinszeitzone, nicht nach UTC', () => {
    // 22:30 UTC ist in Deutschland bereits der Folgetag.
    const days = groupByMatchday(
      [entry('a', '2026-08-22T21:00:00Z'), entry('b', '2026-08-22T22:30:00Z')],
      TZ,
    );
    expect(days.map((d) => d.key)).toEqual(['2026-08-22', '2026-08-23']);
  });

  it('zaehlt die besetzten Plätze über alle Spiele des Tages', () => {
    const days = groupByMatchday(
      [
        entry('a', '2026-08-22T08:30:00Z', ['x', 'y', null, null]),
        entry('b', '2026-08-22T11:00:00Z', ['z', null, null, null]),
      ],
      TZ,
    );
    expect(days[0]?.summary).toBe('2 Spiele · 3/8 Plätze besetzt');
  });

  it('setzt den Singular bei einem einzelnen Spiel', () => {
    const days = groupByMatchday([entry('a', '2026-08-22T08:30:00Z')], TZ);
    expect(days[0]?.summary).toBe('1 Spiel · 0/4 Plätze besetzt');
  });

  it('gibt bei leerer Eingabe eine leere Liste zurück', () => {
    expect(groupByMatchday([], TZ)).toEqual([]);
  });
});

describe('Beschriftungen', () => {
  it('schreibt den Spieltag wie im Mockup', () => {
    expect(matchdayLabel(new Date('2026-08-22T08:30:00Z'), TZ)).toBe('Sa 22.08.2026');
  });

  it('zeigt Uhrzeit und Datum in Ortszeit', () => {
    expect(timeLabel(new Date('2026-08-22T08:30:00Z'), TZ)).toBe('10:30');
    expect(dateLabel(new Date('2026-08-22T08:30:00Z'), TZ)).toBe('22.08.2026');
    // Winterzeit: eine Stunde weniger Versatz.
    expect(timeLabel(new Date('2026-01-10T09:30:00Z'), TZ)).toBe('10:30');
  });

  it('setzt die Paarung mit Gedankenstrich', () => {
    expect(matchTitle(makeGame({ home: 'BG Nordstadt', away: 'TV Ostheim' }))).toBe(
      'BG Nordstadt — TV Ostheim',
    );
  });
});

describe('Wochentag ohne Abkürzungspunkt', () => {
  it('schreibt jeden Wochentag so wie das Mockup', () => {
    // Node liefert im Deutschen "Mo.", "Di." … — das Mockup schreibt sie ohne Punkt.
    const labels = [
      '2026-08-17T09:00:00Z',
      '2026-08-18T09:00:00Z',
      '2026-08-19T09:00:00Z',
      '2026-08-20T09:00:00Z',
      '2026-08-21T09:00:00Z',
      '2026-08-22T09:00:00Z',
      '2026-08-23T09:00:00Z',
    ].map((iso) => matchdayLabel(new Date(iso), TZ).split(' ')[0]);
    expect(labels).toEqual(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']);
  });
});
