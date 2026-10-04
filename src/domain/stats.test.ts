import { describe, expect, it } from 'vitest';
import { inDays, NOW } from './__fixtures__/build';
import {
  buildRanking,
  countRefereedGames,
  countsAsRefereed,
  ownRank,
  type CountableEntry,
} from './stats';

const past = inDays(-1);
const future = inDays(1);

describe('Regeln 25-27 — gezaehlt wird der Platz zum Anpfiff', () => {
  it('zaehlt einen Schiedsrichter-Platz', () => {
    expect(countsAsRefereed(0)).toBe(true);
    expect(countsAsRefereed(1)).toBe(true);
  });

  it('zaehlt einen Ersatzplatz nicht', () => {
    expect(countsAsRefereed(2)).toBe(false);
    expect(countsAsRefereed(3)).toBe(false);
  });

  it('zaehlt automatisch, sobald jemand auf einem Schiedsrichter-Platz steht', () => {
    /*
     * Wer nachgerueckt oder uebernommen hat, steht danach auf Platz 0 oder 1.
     * Damit zaehlt sein Einsatz, ohne dass jemand etwas nachtragen muss —
     * genau das war der Sinn der Abschaffung von "Spiele nachpflegen".
     */
    expect(countsAsRefereed(0)).toBe(true);
  });

  it('kennt keine Ausnahme mehr, die den Platz ueberstimmt', () => {
    /*
     * Frueher konnte der Admin je Eintragung ein "hat doch gepfiffen" setzen.
     * Der Wert haengt jetzt allein am Platz — eine Korrektur laeuft ueber die
     * Besetzung des Spiels, die auch nach dem Anpfiff aenderbar ist.
     */
    const zaehlt = ([0, 1] as const).map((index) => countsAsRefereed(index));
    const zaehltNicht = ([2, 3] as const).map((index) => countsAsRefereed(index));
    expect(zaehlt).toEqual([true, true]);
    expect(zaehltNicht).toEqual([false, false]);
  });

  it('zaehlt kommende Spiele nicht mit — eine Eintragung ist noch kein Einsatz', () => {
    const entries: CountableEntry[] = [
      { slotIndex: 0, kickoff: future },
      { slotIndex: 0, kickoff: past },
    ];
    expect(countRefereedGames(entries, NOW)).toBe(1);
  });

  it('zaehlt einen vergangenen Ersatzplatz nicht mit', () => {
    const entries: CountableEntry[] = [
      { slotIndex: 2, kickoff: past },
      { slotIndex: 3, kickoff: past },
      { slotIndex: 1, kickoff: past },
    ];
    expect(countRefereedGames(entries, NOW)).toBe(1);
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
