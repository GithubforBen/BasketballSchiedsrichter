import { describe, expect, it } from 'vitest';
import { parseCsv, CSV_COLUMNS } from './csv';
import {
  BOM,
  GAME_EXPORT_COLUMNS,
  buildGameCsv,
  csvField,
  gameExportFileName,
  gameExportRow,
} from './csv-export';
import { buildSlots } from './slots';
import type { GameWithSlots } from './schedule';
import type { Assignment, Game } from './types';

const ZONE = 'Europe/Berlin';

const game = (overrides: Partial<Game> = {}): Game => ({
  id: 'g1',
  kickoff: new Date('2026-09-19T08:00:00Z'), // 10:00 Ortszeit
  leagueId: 'U14',
  leagueLabel: 'XU14Bz',
  home: 'BG Nordstadt',
  away: 'TSG Aue',
  venue: 'Sporthalle Nordstadt',
  requiredLicense: 'E',
  state: 'scheduled',
  vacancyVersion: 0,
  overrides: { withdraw: false, substituteRequest: false, oneGamePerDay: false },
  ...overrides,
});

const assignment = (slotIndex: 0 | 1 | 2 | 3, refereeId: string): Assignment => ({
  gameId: 'g1',
  slotIndex,
  refereeId,
  claimedAt: new Date('2026-09-01T10:00:00Z'),
  confirmedAt: null,
  playedAsReferee: null,
});

const entry = (g: Game, assignments: readonly Assignment[] = []): GameWithSlots => ({
  game: g,
  slots: buildSlots(assignments),
});

const INITIALS: Record<string, string> = {
  r1: 'LS',
  r2: 'JK',
  r3: 'MV',
  r4: 'TA',
};
const initialsOf = (id: string): string => INITIALS[id] ?? id;

describe('GAME_EXPORT_COLUMNS', () => {
  it('beginnt mit den Spalten des Imports', () => {
    expect(GAME_EXPORT_COLUMNS.slice(0, CSV_COLUMNS.length)).toEqual([...CSV_COLUMNS]);
  });

  it('nennt hinter der Lizenz die vier Plaetze', () => {
    expect(GAME_EXPORT_COLUMNS.slice(6)).toEqual([
      'Lizenz',
      'Schiri 1',
      'Schiri 2',
      'Ersatz 1',
      'Ersatz 2',
    ]);
  });
});

describe('gameExportRow', () => {
  it('schreibt Datum und Zeit in Vereinszeit', () => {
    const row = gameExportRow(entry(game()), initialsOf, ZONE);
    expect(row[0]).toBe('19.09.2026');
    expect(row[1]).toBe('10:00');
  });

  it('nimmt das Kuerzel des Verbands als Liga', () => {
    expect(gameExportRow(entry(game()), initialsOf, ZONE)[2]).toBe('XU14Bz');
  });

  it('nimmt die Liga selbst, wenn es kein Kuerzel gibt', () => {
    const row = gameExportRow(entry(game({ leagueLabel: '' })), initialsOf, ZONE);
    expect(row[2]).toBe('U14');
  });

  it('setzt die Kuerzel auf ihren Platz', () => {
    const row = gameExportRow(
      entry(game(), [assignment(0, 'r1'), assignment(1, 'r2'), assignment(2, 'r3')]),
      initialsOf,
      ZONE,
    );
    expect(row.slice(7)).toEqual(['LS', 'JK', 'MV', '']);
  });

  it('schreibt Kuerzel und keine Namen', () => {
    /*
     * Der Punkt der Spalten: das Kuerzel haengt im oeffentlichen Spielplan
     * ohnehin an jedem Spiel, der volle Name nach Regel 29 nirgends. Eine
     * Datei, die Namen traegt, waere etwas anderes als eine, die Kuerzel
     * traegt — auch wenn sie gleich aussieht.
     */
    const row = gameExportRow(entry(game(), [assignment(0, 'r1')]), initialsOf, ZONE);
    expect(row[7]).toBe('LS');
    expect(row.join(';')).not.toContain('Schnorrenberger');
  });

  it('laesst freie Plaetze leer statt sie zusammenzuschieben', () => {
    /*
     * Regel 2 vergibt die Plaetze der Reihe nach, aber ein Austrag reisst eine
     * Luecke: ohne Platztreue ruecken die Ersatzleute in der Datei auf die
     * Schiedsrichterspalten vor und die Datei behauptet eine Besetzung, die es
     * nicht gibt.
     */
    const row = gameExportRow(entry(game(), [assignment(2, 'r3')]), initialsOf, ZONE);
    expect(row.slice(7)).toEqual(['', '', 'MV', '']);
  });
});

describe('csvField', () => {
  it('laesst gewoehnliche Felder unberuehrt', () => {
    expect(csvField('Sporthalle Süd')).toBe('Sporthalle Süd');
  });

  it('fasst ein Semikolon im Feld in Anfuehrungszeichen', () => {
    expect(csvField('Sporthalle Nord; Halle 2')).toBe('"Sporthalle Nord; Halle 2"');
  });

  it('verdoppelt Anfuehrungszeichen im Feld', () => {
    expect(csvField('Halle "Am Wald"')).toBe('"Halle ""Am Wald"""');
  });
});

describe('buildGameCsv', () => {
  it('stellt der Kopfzeile ein BOM voran, damit Excel UTF-8 erkennt', () => {
    expect(buildGameCsv([], initialsOf, ZONE).startsWith(`${BOM}Datum;`)).toBe(true);
  });

  it('gibt bei keinem Spiel nur die Kopfzeile aus', () => {
    const lines = buildGameCsv([], initialsOf, ZONE).trimEnd().split('\r\n');
    expect(lines).toHaveLength(1);
  });

  it('behaelt die uebergebene Reihenfolge bei', () => {
    const first = entry(game({ id: 'a', home: 'Erst' }));
    const second = entry(game({ id: 'b', home: 'Zweit', kickoff: new Date('2026-09-19T06:00:00Z') }));
    const lines = buildGameCsv([first, second], initialsOf, ZONE).trimEnd().split('\r\n');
    expect(lines[1]).toContain('Erst');
    expect(lines[2]).toContain('Zweit');
  });

  it('laesst sich vom Import wieder einlesen', () => {
    /*
     * Der eigentliche Zweck der Spaltenreihenfolge: was hier herauskommt, geht
     * dort wieder hinein. Der Import misst die Breite an der Kopfzeile, sieht
     * die Lizenz an Position sieben und uebergeht die vier Namensspalten.
     */
    const csv = buildGameCsv(
      [entry(game(), [assignment(0, 'r1'), assignment(3, 'r4')])],
      initialsOf,
      ZONE,
    );
    const result = parseCsv(csv.slice(BOM.length), ['U14']);

    expect(result.fileProblem).toBe('');
    expect(result.invalid).toHaveLength(0);
    expect(result.valid[0]?.localKickoff).toBe('2026-09-19T10:00');
    expect(result.valid[0]?.home).toBe('BG Nordstadt');
    expect(result.valid[0]?.license).toBe('E');
  });
});

describe('gameExportFileName', () => {
  it('traegt das Datum des Exports', () => {
    expect(gameExportFileName(new Date('2026-09-19T08:00:00Z'), ZONE)).toBe(
      'spielplan-2026-09-19.csv',
    );
  });
});
