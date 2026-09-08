import { describe, expect, it } from 'vitest';
import {
  REFEREE_CSV_EXAMPLE,
  dedupeReferees,
  initialsSuggestion,
  parseRefereeCsv,
} from './referee-csv';

const LEAGUES = ['U10', 'U12', 'U14', 'U16', 'U18', 'Senioren'];

const HEADER = 'Name;Vorname;Kürzel;Telefon;Rolle;Lizenz;Ligen';

const parse = (...lines: string[]) => parseRefereeCsv([HEADER, ...lines].join('\n'), LEAGUES);

const one = (line: string) => {
  const result = parse(line);
  const row = result.rows[0];
  if (!row) throw new Error('keine Zeile eingelesen');
  return row;
};

describe('Kopfzeile', () => {
  it('kommt mit Name und Telefon allein aus', () => {
    // Die Liste, die ein Verein herumliegen hat, hat genau diese zwei Spalten.
    const result = parseRefereeCsv(['Name;Telefon', 'Lena Vogt;0171 2345678'].join('\n'), LEAGUES);
    expect(result.fileProblem).toBe('');
    expect(result.valid[0]?.initials).toBe('LV');
    expect(result.valid[0]?.firstName).toBe('Lena');
    expect(result.valid[0]?.license).toBeNull();
    expect(result.valid[0]?.role).toBe('referee');
  });

  it('nimmt die Spalten in beliebiger Reihenfolge', () => {
    const result = parseRefereeCsv(
      ['Ligen;Telefon;Lizenz;Name', 'U12,Senioren;0171 2345678;D;Lena Vogt'].join('\n'),
      LEAGUES,
    );
    expect(result.valid[0]?.name).toBe('Lena Vogt');
    expect(result.valid[0]?.license).toBe('D');
    expect(result.valid[0]?.leagueIds).toEqual(['U12', 'Senioren']);
  });

  it('meldet, welche Pflichtspalte fehlt', () => {
    expect(parseRefereeCsv('Name;Kürzel;Lizenz', LEAGUES).fileProblem).toContain('Telefon');
  });

  it('meldet eine Spalte, die es nicht gibt, statt sie zu übergehen', () => {
    // "Telefonnummer" ist ein Tippfehler. Ihn zu ignorieren hiesse, jede Zeile
    // wegen fehlender Nummer zu verwerfen, ohne den Grund zu nennen.
    const result = parseRefereeCsv('Name;Telefonnummer', LEAGUES);
    expect(result.fileProblem).toContain('Telefonnummer');
  });

  it('meldet eine doppelte Spalte', () => {
    expect(parseRefereeCsv('Name;Telefon;Name', LEAGUES).fileProblem).toContain('zweimal');
  });

  it('meldet eine leere Datei', () => {
    expect(parseRefereeCsv('   \n\n', LEAGUES).fileProblem).toBe('Die Datei ist leer.');
  });
});

describe('Telefonnummern', () => {
  it('nimmt jede uebliche Schreibweise an', () => {
    for (const written of ['0152 23529220', '+49 152 23529220', '152 23529220', '0152-235 29220']) {
      expect(one(`Jan Kern;;JK;${written}`).phone).toBe('+4915223529220');
    }
  });

  it('meldet eine unlesbare Nummer mit der Begruendung aus der Pruefung', () => {
    expect(one('Jan Kern;;JK;keine').problem).toContain('Ziffern');
  });
});

describe('Kürzel', () => {
  it('nimmt die Anfangsbuchstaben, wenn die Spalte leer bleibt', () => {
    const row = one('Ben Schnorrenberger;;;0152 26693501');
    expect(row.initials).toBe('BS');
    expect(row.initialsFromName).toBe(true);
  });

  it('schreibt ein vorhandenes Kürzel gross', () => {
    const row = one('Lena Vogt;;lv;0171 2345678');
    expect(row.initials).toBe('LV');
    expect(row.initialsFromName).toBe(false);
  });

  it('nimmt bei drei Wörtern das erste und das letzte', () => {
    expect(initialsSuggestion('Anna Maria Berg')).toBe('AB');
    expect(initialsSuggestion('Tim von der Heide')).toBe('TH');
  });

  it('verlangt ein eigenes Kürzel, wenn der Name nur ein Wort hat', () => {
    // "M" ist ein Buchstabe — zu wenig fuer ein Kuerzel.
    expect(one('Mara;;;0171 2345678').problem).toContain('Spalte „Kürzel“');
  });

  it('weist ein zu langes Kürzel zurueck', () => {
    expect(one('Lena Vogt;;LENAV;0171 2345678').problem).toContain('zwei bis vier');
  });
});

describe('Rolle, Lizenz und Ligen', () => {
  it('versteht Schiri, Schiedsrichter und leer als dieselbe Rolle', () => {
    for (const written of ['', 'Schiri', 'schiedsrichter']) {
      expect(one(`Lena Vogt;;LV;0171 2345678;${written}`).role).toBe('referee');
    }
    expect(one('Lena Vogt;;LV;0171 2345678;Admin').role).toBe('admin');
  });

  it('weist eine erfundene Rolle zurueck', () => {
    expect(one('Lena Vogt;;LV;0171 2345678;Trainer').problem).toContain('Rolle');
  });

  it('nimmt jede Lizenzstufe an, auch die neue C', () => {
    for (const written of ['C', 'c', 'D', 'E']) {
      expect(one(`Lena Vogt;;LV;0171 2345678;Schiri;${written}`).license).toBe(
        written.toUpperCase(),
      );
    }
  });

  it('weist eine Stufe zurueck, die es nicht gibt', () => {
    expect(one('Lena Vogt;;LV;0171 2345678;Schiri;B').problem).toContain('B');
  });

  it('laesst die Lizenz leer, statt eine anzunehmen', () => {
    // Anders als beim Spielplan: eine Lizenz ist eine Tatsache ueber die
    // Person und wird nicht geraten. Ohne sie kann sie sich nicht eintragen.
    expect(one('Lena Vogt;;LV;0171 2345678;Schiri;').license).toBeNull();
  });

  it('trennt Ligen an Komma und Schrägstrich und wirft Doppelte weg', () => {
    expect(one('Lena Vogt;;LV;0171 2345678;Schiri;D;U12, Senioren / U12').leagueIds).toEqual([
      'U12',
      'Senioren',
    ]);
  });

  it('weist eine Liga zurueck, die es im Verein nicht gibt', () => {
    expect(one('Lena Vogt;;LV;0171 2345678;Schiri;D;U20').problem).toContain('U20');
  });

  it('nimmt den Vornamen aus dem Namen, wenn die Spalte leer ist', () => {
    expect(one('Lena Vogt;;LV;0171 2345678').firstName).toBe('Lena');
    expect(one('Lena Vogt;Leni;LV;0171 2345678').firstName).toBe('Leni');
  });
});

describe('Abgleich mit dem Bestand', () => {
  const nothing = { phones: [], initials: [] };

  it('legt aus dem Beispiel drei Personen an', () => {
    const parsed = parseRefereeCsv(REFEREE_CSV_EXAMPLE, LEAGUES);
    expect(parsed.invalid).toEqual([]);
    expect(dedupeReferees(parsed.valid, nothing).fresh).toHaveLength(3);
  });

  it('überspringt eine Nummer, die es schon gibt', () => {
    const parsed = parse('Lena Vogt;;LV;0171 2345678');
    const result = dedupeReferees(parsed.valid, {
      phones: ['+491712345678'],
      initials: ['LV'],
    });
    expect(result.fresh).toEqual([]);
    expect(result.duplicates).toHaveLength(1);
  });

  it('erkennt dieselbe Nummer in verschiedener Schreibweise als eine Person', () => {
    // Zweimal dieselbe Person ist ein Versehen — anders als beim Spielplan,
    // wo zwei gleiche Zeilen zwei Spiele sind.
    const parsed = parse('Lena Vogt;;LV;0171 2345678', 'Lena Vogt;;LW;+49 171 2345678');
    const result = dedupeReferees(parsed.valid, nothing);
    expect(result.fresh).toHaveLength(1);
    expect(result.duplicates).toHaveLength(1);
  });

  it('weist ein vergebenes Kürzel bei neuer Nummer gesondert aus', () => {
    const parsed = parse('Lars Vetter;;LV;0171 9999999');
    const result = dedupeReferees(parsed.valid, { phones: [], initials: ['LV'] });
    expect(result.fresh).toEqual([]);
    expect(result.duplicates).toEqual([]);
    expect(result.conflicts).toHaveLength(1);
  });

  it('laesst denselben Lauf ein zweites Mal nichts anlegen', () => {
    const parsed = parseRefereeCsv(REFEREE_CSV_EXAMPLE, LEAGUES);
    const first = dedupeReferees(parsed.valid, nothing);
    const after = {
      phones: first.fresh.flatMap((row) => (row.phone === null ? [] : [row.phone])),
      initials: first.fresh.map((row) => row.initials),
    };
    expect(dedupeReferees(parsed.valid, after).fresh).toEqual([]);
  });
});
