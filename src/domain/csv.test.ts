import { describe, expect, it } from 'vitest';
import {
  CSV_COLUMNS,
  CSV_EXAMPLE,
  countByKey,
  dedupe,
  parseCsv,
  parseGermanDate,
  parseTime,
} from './csv';
import { leagueFromLabel } from './league';

const LEAGUES = ['U10', 'U12', 'U14', 'U16', 'U18', 'Senioren'];
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
        // "Kreisliga" waere heute gueltig — ohne Altersklasse ist es ein
        // Senioren-Spiel. Unbrauchbar ist erst eine Klasse, die es nicht gibt.
        '19.09.2026;10:00;XU99Bz;A;B;Halle',
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
  const counts = (...keys: string[]) => countByKey(
    keys.map((key) => {
      const [kickoff = '', home = '', away = ''] = key.split('|');
      return { kickoff: toKickoff(kickoff), home, away };
    }),
  );

  it('überspringt Spiele, die es schon gibt', () => {
    const rows = rowsOf(file('19.09.2026;10:00;U14;A;B;Halle', '20.09.2026;11:00;U16;C;D;Halle'));

    const result = dedupe(rows, toKickoff, counts('2026-09-19T10:00|A|B'));
    expect(result.fresh).toHaveLength(1);
    expect(result.duplicates).toHaveLength(1);
    expect(result.fresh[0]?.home).toBe('C');
  });

  it('legt dieselbe Paarung zweimal an, wenn die Datei sie zweimal nennt', () => {
    /*
     * Der Verband setzt zur selben Zeit in derselben Halle zwei Begegnungen
     * an — beide brauchen eigene Schiedsrichter. Frueher fiel die zweite
     * stillschweigend weg, aus vierzig Zeilen wurden vierunddreissig Spiele.
     */
    const rows = rowsOf(file('19.09.2026;10:00;U14;A;B;Halle', '19.09.2026;10:00;U14;A;B;Halle'));
    const result = dedupe(rows, toKickoff, new Map());
    expect(result.fresh).toHaveLength(2);
    expect(result.duplicates).toHaveLength(0);
  });

  it('zählt gegen den Bestand: zweimal in der Datei, einmal vorhanden, eines entsteht', () => {
    const rows = rowsOf(file('19.09.2026;10:00;U14;A;B;Halle', '19.09.2026;10:00;U14;A;B;Halle'));
    const result = dedupe(rows, toKickoff, counts('2026-09-19T10:00|A|B'));
    expect(result.fresh).toHaveLength(1);
    expect(result.duplicates).toHaveLength(1);
  });

  it('erkennt dieselbe Mannschaft in anderer Schreibweise wieder', () => {
    // Der Verband schreibt Vereine nicht immer gleich; "BG NORDSTADT" neben
    // "BG Nordstadt" waere sonst ein zweites Spiel zur selben Zeit.
    const rows = rowsOf(file('19.09.2026;10:00;U14;BG NORDSTADT;TV  Ostheim;Halle'));
    const result = dedupe(rows, toKickoff, counts('2026-09-19T10:00|BG Nordstadt|TV Ostheim'));
    expect(result.fresh).toHaveLength(0);
    expect(result.duplicates).toHaveLength(1);
  });

  it('unterscheidet Spiele mit gleicher Paarung zu anderer Zeit', () => {
    const rows = rowsOf(file('19.09.2026;10:00;U14;A;B;Halle', '19.09.2026;14:00;U14;A;B;Halle'));
    expect(dedupe(rows, toKickoff, new Map()).fresh).toHaveLength(2);
  });

  it('unterscheidet Heim- und Auswärtsspiel derselben Mannschaften', () => {
    const rows = rowsOf(file('19.09.2026;10:00;U14;A;B;Halle', '19.09.2026;10:00;U14;B;A;Halle'));
    expect(dedupe(rows, toKickoff, new Map()).fresh).toHaveLength(2);
  });

  it('ist wiederholbar: derselbe Import ein zweites Mal legt nichts mehr an', () => {
    const rows = rowsOf(
      file(
        '19.09.2026;10:00;U14;A;B;Halle',
        '19.09.2026;10:00;U14;A;B;Halle',
        '20.09.2026;11:00;U16;C;D;Halle',
      ),
    );
    const first = dedupe(rows, toKickoff, new Map());
    expect(first.fresh).toHaveLength(3);

    const afterImport = countByKey(
      first.fresh.map((row) => ({
        kickoff: toKickoff(row.localKickoff ?? ''),
        home: row.home,
        away: row.away,
      })),
    );
    const second = dedupe(rows, toKickoff, afterImport);
    expect(second.fresh).toHaveLength(0);
    expect(second.duplicates).toHaveLength(3);
  });
});

describe('Das Liga-Kürzel des Verbands', () => {
  it('holt die Altersklasse aus dem Kürzel heraus', () => {
    expect(leagueFromLabel('XU14Bz')).toBe('U14');
    expect(leagueFromLabel('U16')).toBe('U16');
    expect(leagueFromLabel('1. Regionalliga U18 männlich')).toBe('U18');
    expect(leagueFromLabel('xu12a')).toBe('U12');
  });

  it('macht ein Senioren-Spiel aus allem ohne Altersklasse', () => {
    expect(leagueFromLabel('Herren Kreisliga B, Gruppe 1')).toBe('Senioren');
    expect(leagueFromLabel('Damen Bezirksoberliga')).toBe('Senioren');
  });

  it('behält das Kürzel an der Zeile — es wird angezeigt', () => {
    const [row] = parseCsv(file('19.09.2026;10:00;XU14Bz;A;B;Halle'), LEAGUES).valid;
    expect(row?.league).toBe('U14');
    expect(row?.leagueLabel).toBe('XU14Bz');
  });

  it('meldet, wenn die gedeutete Liga im Verein fehlt', () => {
    const [row] = parseCsv(file('19.09.2026;10:00;XU99Bz;A;B;Halle'), LEAGUES).invalid;
    expect(row?.problem).toContain('U99');
    expect(row?.problem).toContain('XU99Bz');
  });
});

describe('Verrutschte Spalten', () => {
  /*
   * Der Fall, der vierzig Spiele in eine Halle namens "E" gelegt hat: der
   * Zeile fehlte das Feld "Ort", die Lizenz rutschte hinein, und weil sie
   * damit immer noch sechs Felder hatte, fiel nichts auf.
   */
  const header = 'Datum;Zeit;Liga;Heim;Gast;Ort;Lizenz';

  it('meldet eine Zeile, der ein Feld fehlt', () => {
    const result = parseCsv(
      [header, '19.09.2026;10:00;XU14BZ2;Bergstraße;VfL Bensheim;E'].join('\n'),
      ['U14'],
    );
    expect(result.valid).toEqual([]);
    expect(result.invalid[0]?.problem).toContain('verrutscht');
  });

  it('meldet eine Zeile mit einem Semikolon zu viel', () => {
    const result = parseCsv(
      [header, '19.09.2026;10:00;XU14BZ2;Bergstraße;VfL Bensheim;Halle;Feld 2;E'].join('\n'),
      ['U14'],
    );
    expect(result.valid).toEqual([]);
    expect(result.invalid[0]?.problem).toContain('zu viel');
  });

  it('nimmt eine Zeile an, die genau so breit ist wie die Kopfzeile', () => {
    const result = parseCsv(
      [header, '19.09.2026;10:00;XU14BZ2;Bergstraße;VfL Bensheim;Halle;E'].join('\n'),
      ['U14'],
    );
    expect(result.invalid).toEqual([]);
    expect(result.valid[0]?.venue).toBe('Halle');
  });

  it('misst an der Kopfzeile und nicht an den Pflichtspalten', () => {
    // Ohne Lizenzspalte sind sechs Felder richtig — dieselbe Zeile waere mit
    // Lizenzspalte in der Kopfzeile zu schmal.
    const ohne = parseCsv(
      ['Datum;Zeit;Liga;Heim;Gast;Ort', '19.09.2026;10:00;XU14BZ2;A;B;Halle'].join('\n'),
      ['U14'],
    );
    expect(ohne.invalid).toEqual([]);
    expect(ohne.valid[0]?.venue).toBe('Halle');
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

  it('liest auch die hoechste Stufe C', () => {
    const result = parseCsv(
      ['Datum;Zeit;Liga;Heim;Gast;Ort;Lizenz', '19.09.2026;10:00;U14;A;B;Halle;C'].join('\n'),
      leagues,
    );
    expect(result.valid[0]?.license).toBe('C');
  });

  it('weist eine Lizenz zurueck, die es nicht gibt', () => {
    const result = parseCsv(
      ['Datum;Zeit;Liga;Heim;Gast;Ort;Lizenz', '19.09.2026;10:00;U14;A;B;Halle;B'].join('\n'),
      leagues,
    );
    expect(result.invalid[0]?.problem).toContain('Lizenz');
  });
});
