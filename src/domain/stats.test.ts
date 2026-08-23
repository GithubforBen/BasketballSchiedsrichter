import { describe, expect, it } from 'vitest';
import { inDays, makeAssignment, NOW } from './__fixtures__/build';
import {
  buildRanking,
  countRefereedGames,
  countsAsRefereed,
  needsPlayedDecision,
  ownRank,
  type CountableEntry,
} from './stats';

const past = inDays(-1);
const future = inDays(1);

describe('Regel 25/26 — nur echte Einsaetze als Schiedsrichter zaehlen', () => {
  it('zaehlt einen Schiedsrichter-Platz', () => {
    expect(countsAsRefereed(0, makeAssignment(0, 'r-jk'))).toBe(true);
    expect(countsAsRefereed(1, makeAssignment(1, 'r-jk'))).toBe(true);
  });

  it('zaehlt einen Ersatzplatz ohne Einsatz nicht', () => {
    expect(countsAsRefereed(2, makeAssignment(2, 'r-jk'))).toBe(false);
    expect(countsAsRefereed(3, makeAssignment(3, 'r-jk'))).toBe(false);
  });

  it('zaehlt einen Ersatz mit Einsatz', () => {
    expect(countsAsRefereed(2, makeAssignment(2, 'r-jk', { playedAsReferee: true }))).toBe(true);
  });

  it('zaehlt kommende Spiele nicht mit — eine Eintragung ist noch kein Einsatz', () => {
    const entries: CountableEntry[] = [
      { slotIndex: 0, assignment: makeAssignment(0, 'r-jk'), kickoff: future },
      { slotIndex: 0, assignment: makeAssignment(0, 'r-jk'), kickoff: past },
    ];
    expect(countRefereedGames(entries, NOW)).toBe(1);
  });
});

describe('Regel 27 — Nachruecken zaehlt automatisch, der Admin kann korrigieren', () => {
  it('zaehlt automatisch, sobald jemand auf einem Schiedsrichter-Platz steht', () => {
    // Nach dem Nachruecken sitzt die Person auf Platz 0 — ohne dass jemand
    // etwas eintragen muss.
    expect(countsAsRefereed(0, makeAssignment(0, 'r-tf'))).toBe(true);
  });

  it('laesst die Admin-Korrektur den Platz ueberstimmen', () => {
    expect(countsAsRefereed(0, makeAssignment(0, 'r-jk', { playedAsReferee: false }))).toBe(false);
    expect(countsAsRefereed(3, makeAssignment(3, 'r-jk', { playedAsReferee: true }))).toBe(true);
  });

  it('meldet, wo der Admin nachpflegen muss', () => {
    const entries: CountableEntry[] = [
      { slotIndex: 2, assignment: makeAssignment(2, 'r-jk'), kickoff: past },
      { slotIndex: 2, assignment: makeAssignment(2, 'r-lb', { playedAsReferee: false }), kickoff: past },
      { slotIndex: 0, assignment: makeAssignment(0, 'r-tf'), kickoff: past },
      { slotIndex: 2, assignment: makeAssignment(2, 'r-ay'), kickoff: future },
    ];
    const open = needsPlayedDecision(entries, NOW);
    expect(open).toHaveLength(1);
    expect(open[0]?.assignment.refereeId).toBe('r-jk');
  });
});

describe('Regel 28 — Ranking zeigt nur die eigene Position namentlich', () => {
  const entries = [
    { refereeId: 'r-nb', name: 'Nele Baumann', count: 12 },
    { refereeId: 'r-tf', name: 'Timo Faerber', count: 11 },
    { refereeId: 'r-ms', name: 'Marco Silva', count: 9 },
    { refereeId: 'r-lb', name: 'Lena Brandt', count: 8 },
    { refereeId: 'r-jk', name: 'Jonas Keller', count: 7 },
    { refereeId: 'r-ay', name: 'Aylin Yildiz', count: 4 },
  ];

  it('sortiert absteigend nach Einsaetzen', () => {
    expect(buildRanking(entries, 'r-jk').map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('nennt nur die eigene Zeile beim Namen und zeigt nur dort eine Zahl', () => {
    const rows = buildRanking(entries, 'r-jk');
    const me = ownRank(rows);
    expect(me).toMatchObject({ rank: 5, label: 'Du', count: 7 });
    for (const row of rows.filter((r) => !r.isMe)) {
      expect(row.label).toBe('anonym');
      expect(row.count).toBeNull();
    }
  });

  it('gibt keinen fremden Namen weiter — auch nicht versteckt', () => {
    const serialised = JSON.stringify(buildRanking(entries, 'r-jk'));
    for (const other of entries.filter((e) => e.refereeId !== 'r-jk')) {
      expect(serialised).not.toContain(other.name);
      expect(serialised).not.toContain(other.refereeId);
    }
  });

  it('loest Gleichstand reproduzierbar ueber den Namen auf', () => {
    const tie = [
      { refereeId: 'b', name: 'Bea', count: 5 },
      { refereeId: 'a', name: 'Ada', count: 5 },
    ];
    expect(buildRanking(tie, 'a').find((r) => r.isMe)?.rank).toBe(1);
  });
});
