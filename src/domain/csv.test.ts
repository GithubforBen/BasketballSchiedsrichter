import { describe, expect, it } from 'vitest';
import {
  CSV_COLUMNS,
  CSV_EXAMPLE,
  dedupe,
  gameKey,
  parseCsv,
  parseGermanDate,
  parseTime,
} from './csv';

const LEAGUES = ['U14', 'U16', 'U18', 'Erwachsene', 'Senioren'];
const header = CSV_COLUMNS.join(';');
const file = (...rows: string[]) => [header, ...rows].join('\n');

describe('CSV einlesen', () => {
  it('liest die Beispieldatei vollständig', () => {
    const result = parseCsv(CSV_EXAMPLE, LEAGUES);
    expect(result.fileProblem).toBe('');
    expect(result.valid).toHaveLength(4);
    expect(result.invalid).toHaveLength(0);
    expect(result.valid[0]).toMatchObject({
      league: 'U14',
      home: 'BG Nordstadt',
      away: 'TSG Aue',
      localKickoff: '2026-09-19T10:00',
    });
  });

  it('verlangt die richtige Kopfzeile', () => {
    const result = parseCsv('Datum;Zeit;Heim\n01.02.2026;10:00;A', LEAGUES);
    expect(result.fileProblem).toContain('Kopfzeile');
    expect(result.rows).toHaveLength(0);
  });

  it('meldet eine leere Datei', () => {
    expect(parseCsv('   \n\n', LEAGUES).fileProblem).toContain('leer');
  });

  it('verträgt Windows-Zeilenenden und Leerzeilen', () => {
    const text = `${header}\r\n19.09.2026;10:00;U14;A;B;Halle\r\n\r\n`;
    expect(parseCsv(text, LEAGUES).valid).toHaveLength(1);
  });

  it('nennt bei jeder unbrauchbaren Zeile die Zeilennummer und den Grund', () => {
    const result = parseCsv(
      file(
        '19.09.2026;10:00;U14;A;B;Halle',
        '31.02.2026;10:00;U14;A;B;Halle',
        '19.09.2026;25:00;U14;A;B;Halle',
        '19.09.2026;10:00;Kreisliga;A;B;Halle',
        '19.09.2026;10:00;U14;;B;Halle',
        '19.09.2026;10:00;U14;A;B',
      ),
      LEAGUES,
    );
    expect(result.valid).toHaveLength(1);
    expect(result.invalid).toHaveLength(5);
    expect(result.invalid.map((row) => row.line)).toEqual([3, 4, 5, 6, 7]);
    for (const row of result.invalid) {
      expect(row.problem.length, `Zeile ${row.line}`).toBeGreaterThan(5);
    }
    expect(result.invalid[0]?.problem).toContain('Datum');
    expect(result.invalid[1]?.problem).toContain('Uhrzeit');
    expect(result.invalid[2]?.problem).toContain('Liga');
  });

  it('importiert nur die brauchbaren Zeilen und wirft nicht die ganze Datei weg', () => {
    const result = parseCsv(
      file('19.09.2026;10:00;U14;A;B;Halle', 'kaputt', '20.09.2026;11:00;U16;C;D;Halle'),
      LEAGUES,
    );
    expect(result.valid).toHaveLength(2);
    expect(result.invalid).toHaveLength(1);
  });
});

describe('Datum und Uhrzeit', () => {
  it('liest die deutsche Schreibweise', () => {
    expect(parseGermanDate('12.09.2026')).toBe('2026-09-12');
    expect(parseGermanDate('1.2.2026')).toBe('2026-02-01');
    expect(parseGermanDate('12.09.26')).toBe('2026-09-12');
  });

  it('lehnt es ab, ein unmögliches Datum stillschweigend zu verschieben', () => {
    // Ohne Prüfung würde der 31.02. zum 03.03. — und das Spiel läge am
    // falschen Tag, ohne dass es jemand merkt.
    expect(parseGermanDate('31.02.2026')).toBeNull();
    expect(parseGermanDate('32.01.2026')).toBeNull();
    expect(parseGermanDate('2026-09-12')).toBeNull();
    expect(parseGermanDate('')).toBeNull();
  });

  it('liest Uhrzeiten mit Doppelpunkt und Punkt', () => {
    expect(parseTime('10:30')).toBe('10:30');
    expect(parseTime('9:05')).toBe('09:05');
    expect(parseTime('10.30')).toBe('10:30');
  });

  it('lehnt unmögliche Uhrzeiten ab', () => {
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('10:60')).toBeNull();
    expect(parseTime('1030')).toBeNull();
  });
});

describe('Duplikaterkennung', () => {
  const toKickoff = (local: string) => new Date(`${local}:00Z`);
  const rowsOf = (text: string) => parseCsv(text, LEAGUES).valid;

  it('überspringt Spiele, die es schon gibt', () => {
    const rows = rowsOf(file('19.09.2026;10:00;U14;A;B;Halle', '20.09.2026;11:00;U16;C;D;Halle'));
    const existing = new Set([gameKey(toKickoff('2026-09-19T10:00'), 'A', 'B')]);

    const result = dedupe(rows, toKickoff, existing);
    expect(result.fresh).toHaveLength(1);
    expect(result.duplicates).toHaveLength(1);
    expect(result.fresh[0]?.home).toBe('C');
  });

  it('überspringt Doppelte innerhalb derselben Datei', () => {
    // Ohne diese Prüfung bräche der Import an der Eindeutigkeitsbedingung ab,
    // statt sauber zu melden.
    const rows = rowsOf(file('19.09.2026;10:00;U14;A;B;Halle', '19.09.2026;10:00;U14;A;B;Andere'));
    const result = dedupe(rows, toKickoff, new Set());
    expect(result.fresh).toHaveLength(1);
    expect(result.repeated).toHaveLength(1);
  });

  it('unterscheidet Spiele mit gleicher Paarung zu anderer Zeit', () => {
    const rows = rowsOf(file('19.09.2026;10:00;U14;A;B;Halle', '19.09.2026;14:00;U14;A;B;Halle'));
    expect(dedupe(rows, toKickoff, new Set()).fresh).toHaveLength(2);
  });

  it('unterscheidet Heim- und Auswärtsspiel derselben Mannschaften', () => {
    const rows = rowsOf(file('19.09.2026;10:00;U14;A;B;Halle', '19.09.2026;10:00;U14;B;A;Halle'));
    expect(dedupe(rows, toKickoff, new Set()).fresh).toHaveLength(2);
  });

  it('ist wiederholbar: derselbe Import ein zweites Mal legt nichts mehr an', () => {
    const rows = rowsOf(file('19.09.2026;10:00;U14;A;B;Halle', '20.09.2026;11:00;U16;C;D;Halle'));
    const first = dedupe(rows, toKickoff, new Set());
    expect(first.fresh).toHaveLength(2);

    const afterImport = new Set(
      first.fresh.map((row) => gameKey(toKickoff(row.localKickoff ?? ''), row.home, row.away)),
    );
    const second = dedupe(rows, toKickoff, afterImport);
    expect(second.fresh).toHaveLength(0);
    expect(second.duplicates).toHaveLength(2);
  });
});

describe('Die Lizenzspalte ist freiwillig', () => {
  /*
   * Die Dateien, die der Verband herausgibt, kennen die Spalte nicht. Ein
   * Import soll daran nicht scheitern — ohne Angabe gilt die niedrigere
   * Lizenz, und der Admin hebt einzelne Spiele danach an.
   */
  const leagues = ['U14'];

  it('nimmt E an, wo nichts steht', () => {
    const result = parseCsv(
      ['Datum;Zeit;Liga;Heim;Gast;Ort', '19.09.2026;10:00;U14;A;B;Halle'].join('\n'),
      leagues,
    );
    expect(result.valid[0]?.license).toBe('E');
  });

  it('liest die Spalte, wo sie steht', () => {
    const result = parseCsv(
      ['Datum;Zeit;Liga;Heim;Gast;Ort;Lizenz', '19.09.2026;10:00;U14;A;B;Halle;d'].join('\n'),
      leagues,
    );
    expect(result.valid[0]?.license).toBe('D');
  });

  it('weist eine Lizenz zurueck, die es nicht gibt', () => {
    const result = parseCsv(
      ['Datum;Zeit;Liga;Heim;Gast;Ort;Lizenz', '19.09.2026;10:00;U14;A;B;Halle;C'].join('\n'),
      leagues,
    );
    expect(result.invalid[0]?.problem).toContain('Lizenz');
  });
});
