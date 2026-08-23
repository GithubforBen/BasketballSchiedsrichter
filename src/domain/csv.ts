/**
 * CSV-Import fuer Spielplaene. Regel: Spalten `Datum;Zeit;Liga;Heim;Gast;Ort`,
 * Semikolon getrennt, erste Zeile Kopfzeile.
 *
 * Rein und ohne Datenbankbezug: das Einlesen und die Duplikaterkennung sind
 * hier vollstaendig testbar, das Schreiben passiert woanders.
 */

export const CSV_COLUMNS = ['Datum', 'Zeit', 'Liga', 'Heim', 'Gast', 'Ort'] as const;

export interface CsvRow {
  /** Zeilennummer in der Datei, ab 1 — fuer die Fehlermeldung. */
  line: number;
  date: string;
  time: string;
  league: string;
  home: string;
  away: string;
  venue: string;
  /** Ortszeit als `YYYY-MM-DDTHH:mm`, sobald Datum und Zeit lesbar waren. */
  localKickoff: string | null;
  /** Was an dieser Zeile nicht stimmt. Leer, wenn sie in Ordnung ist. */
  problem: string;
}

export interface CsvParseResult {
  rows: readonly CsvRow[];
  /** Zeilen ohne Beanstandung. */
  valid: readonly CsvRow[];
  /** Zeilen mit Beanstandung — sie werden nicht importiert. */
  invalid: readonly CsvRow[];
  /** Beanstandung an der Datei als Ganzes, etwa eine fehlende Kopfzeile. */
  fileProblem: string;
}

const SEPARATOR = ';';

export const parseCsv = (text: string, knownLeagues: readonly string[]): CsvParseResult => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');

  if (lines.length === 0) {
    return { rows: [], valid: [], invalid: [], fileProblem: 'Die Datei ist leer.' };
  }

  const header = (lines[0] ?? '').split(SEPARATOR).map((cell) => cell.trim().toLowerCase());
  const expected = CSV_COLUMNS.map((column) => column.toLowerCase());
  if (expected.some((column, index) => header[index] !== column)) {
    return {
      rows: [],
      valid: [],
      invalid: [],
      fileProblem: `Die Kopfzeile muss lauten: ${CSV_COLUMNS.join(SEPARATOR)}`,
    };
  }

  const rows = lines.slice(1).map((line, index) => readRow(line, index + 2, knownLeagues));
  return {
    rows,
    valid: rows.filter((row) => row.problem === ''),
    invalid: rows.filter((row) => row.problem !== ''),
    fileProblem: '',
  };
};

const readRow = (line: string, lineNumber: number, knownLeagues: readonly string[]): CsvRow => {
  const cells = line.split(SEPARATOR).map((cell) => cell.trim());
  const [date = '', time = '', league = '', home = '', away = '', venue = ''] = cells;

  const base = { line: lineNumber, date, time, league, home, away, venue };
  const fail = (problem: string): CsvRow => ({ ...base, localKickoff: null, problem });

  if (cells.length < CSV_COLUMNS.length) {
    return fail(`Zeile hat nur ${cells.length} von ${CSV_COLUMNS.length} Spalten.`);
  }
  if (home === '' || away === '') return fail('Heim oder Gast fehlt.');
  if (venue === '') return fail('Ort fehlt.');
  if (!knownLeagues.includes(league)) {
    return fail(`Liga „${league}“ ist im Verein nicht angelegt.`);
  }

  const isoDate = parseGermanDate(date);
  if (!isoDate) return fail(`Datum „${date}“ ist nicht lesbar (erwartet TT.MM.JJJJ).`);

  const isoTime = parseTime(time);
  if (!isoTime) return fail(`Uhrzeit „${time}“ ist nicht lesbar (erwartet HH:MM).`);

  return { ...base, localKickoff: `${isoDate}T${isoTime}`, problem: '' };
};

/** „12.09.2026“ und „12.9.26“ ergeben beide `2026-09-12`. */
export const parseGermanDate = (value: string): string | null => {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(value);
  if (!match) return null;
  const [, day = '', month = '', year = ''] = match;
  const fullYear = year.length === 2 ? `20${year}` : year;
  const asDate = new Date(`${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00Z`);
  if (Number.isNaN(asDate.getTime())) return null;
  // Ein 31. Februar rutscht beim Umrechnen in den Maerz — das faellt hier auf.
  if (asDate.getUTCDate() !== Number(day) || asDate.getUTCMonth() + 1 !== Number(month)) {
    return null;
  }
  return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

/** „10:30“, „9:05“ und „10.30“ ergeben `10:30`. */
export const parseTime = (value: string): string | null => {
  const match = /^(\d{1,2})[:.](\d{2})$/.exec(value);
  if (!match) return null;
  const [, hour = '', minute = ''] = match;
  if (Number(hour) > 23 || Number(minute) > 59) return null;
  return `${hour.padStart(2, '0')}:${minute}`;
};

/**
 * Der Schluessel, ueber den ein Spiel als dasselbe erkannt wird:
 * Anpfiff, Heim und Gast. Derselbe Schluessel liegt als eindeutiger Index in
 * der Datenbank — beides muss zusammenpassen, sonst wuerde der Import zwar
 * eine Vorschau anzeigen und dann am Schreiben scheitern.
 */
export const gameKey = (kickoff: Date, home: string, away: string): string =>
  `${kickoff.toISOString()}|${home}|${away}`;

export interface DedupeResult {
  /** Zeilen, die neu angelegt werden. */
  fresh: readonly CsvRow[];
  /** Zeilen, die es schon gibt — sie werden uebersprungen. */
  duplicates: readonly CsvRow[];
  /** Zeilen, die innerhalb der Datei doppelt vorkommen. */
  repeated: readonly CsvRow[];
}

/**
 * Trennt neue Zeilen von schon vorhandenen. Doppelte innerhalb derselben Datei
 * zaehlen ebenfalls als uebersprungen — sonst braeche der Import an der
 * Eindeutigkeitsbedingung ab, statt sauber zu melden.
 */
export const dedupe = (
  rows: readonly CsvRow[],
  toKickoff: (localKickoff: string) => Date,
  existingKeys: ReadonlySet<string>,
): DedupeResult => {
  const seen = new Set<string>();
  const fresh: CsvRow[] = [];
  const duplicates: CsvRow[] = [];
  const repeated: CsvRow[] = [];

  for (const row of rows) {
    if (row.localKickoff === null) continue;
    const key = gameKey(toKickoff(row.localKickoff), row.home, row.away);
    if (existingKeys.has(key)) duplicates.push(row);
    else if (seen.has(key)) repeated.push(row);
    else {
      seen.add(key);
      fresh.push(row);
    }
  }

  return { fresh, duplicates, repeated };
};

/** Die Beispiel-CSV aus dem Mockup, als Vorbelegung des Eingabefelds. */
export const CSV_EXAMPLE = [
  CSV_COLUMNS.join(SEPARATOR),
  '19.09.2026;10:00;U14;BG Nordstadt;TSG Aue;Sporthalle Nordstadt',
  '19.09.2026;12:00;U16;BG Nordstadt;SG Weiher;Sporthalle Nordstadt',
  '19.09.2026;14:30;U18;BG Nordstadt;BBC Talheim;Zeppelinhalle',
  '20.09.2026;11:00;Senioren;BG Nordstadt;TSV Kirchheim;Zeppelinhalle',
].join('\n');
