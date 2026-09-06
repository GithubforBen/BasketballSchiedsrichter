import { leagueFromLabel } from './league';
import { LICENSES, isLicense } from './license';
import type { License } from './types';

/**
 * CSV-Import fuer Spielplaene. Regel: Spalten `Datum;Zeit;Liga;Heim;Gast;Ort`,
 * Semikolon getrennt, erste Zeile Kopfzeile.
 *
 * Rein und ohne Datenbankbezug: das Einlesen und die Duplikaterkennung sind
 * hier vollstaendig testbar, das Schreiben passiert woanders.
 */

export const CSV_COLUMNS = ['Datum', 'Zeit', 'Liga', 'Heim', 'Gast', 'Ort'] as const;

/**
 * Die Lizenzspalte, die hinter den Pflichtspalten stehen darf.
 *
 * Freiwillig und nicht Teil von `CSV_COLUMNS`: die Dateien, die der Verband
 * herausgibt, kennen sie nicht, und ein Import soll daran nicht scheitern.
 * Fehlt sie oder bleibt sie leer, gilt die niedrigste Lizenz E.
 */
export const CSV_LICENSE_COLUMN = 'Lizenz';
export const DEFAULT_CSV_LICENSE: License = 'E';

export interface CsvRow {
  /** Zeilennummer in der Datei, ab 1 — fuer die Fehlermeldung. */
  line: number;
  date: string;
  time: string;
  /** Die Liga, zu der die Zeile gehoert — aus dem Kuerzel gedeutet. */
  league: string;
  /** Das Kuerzel, wie es in der Datei stand. Es wird angezeigt. */
  leagueLabel: string;
  home: string;
  away: string;
  venue: string;
  /** Noetige Lizenz. Ohne Spalte steht hier die niedrigere. */
  license: License;
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

  /*
   * Die Breite der Kopfzeile ist das Mass fuer jede Zeile.
   *
   * Vorher wurde nur gegen die sechs Pflichtspalten geprueft. Eine Zeile, der
   * die Spalte "Ort" fehlte, hatte damit trotzdem sechs Felder — nur eines
   * davon verrutscht: die Lizenz stand im Ort. Das ergab vierzig Spiele in
   * einer Halle namens "E", und auffallen konnte es nirgends, weil ein Ort
   * kein bestimmtes Format hat.
   */
  const width = header.length;
  const rows = lines
    .slice(1)
    .map((line, index) => readRow(line, index + 2, knownLeagues, width));
  return {
    rows,
    valid: rows.filter((row) => row.problem === ''),
    invalid: rows.filter((row) => row.problem !== ''),
    fileProblem: '',
  };
};

const readRow = (
  line: string,
  lineNumber: number,
  knownLeagues: readonly string[],
  headerWidth: number,
): CsvRow => {
  const cells = line.split(SEPARATOR).map((cell) => cell.trim());
  const [date = '', time = '', label = '', home = '', away = '', venue = '', licence = ''] = cells;

  const base: Omit<CsvRow, 'localKickoff' | 'problem'> = {
    line: lineNumber,
    date,
    time,
    league: leagueFromLabel(label),
    leagueLabel: label,
    home,
    away,
    venue,
    license: DEFAULT_CSV_LICENSE,
  };
  const fail = (problem: string): CsvRow => ({ ...base, localKickoff: null, problem });

  if (cells.length !== headerWidth) {
    /*
     * Zu wenige Felder heisst: eines fehlt und alles dahinter ist verrutscht.
     * Zu viele heisst: irgendwo steckt ein Semikolon im Text. Beides macht die
     * Zeile unbrauchbar, und beides ist ohne diesen Vergleich nicht zu sehen.
     */
    return fail(
      `Zeile hat ${cells.length} Felder, die Kopfzeile ${headerWidth}. ` +
        (cells.length < headerWidth
          ? 'Es fehlt ein Semikolon — die Spalten dahinter sind verrutscht.'
          : 'Ein Feld enthält ein Semikolon zu viel.'),
    );
  }
  const upper = licence.toUpperCase();
  if (upper !== '' && !isLicense(upper)) {
    return fail(`Lizenz „${licence}“ gibt es nicht — erlaubt sind ${LICENSES.join(', ')}.`);
  }
  base.license = upper === '' ? DEFAULT_CSV_LICENSE : upper;
  if (home === '' || away === '') return fail('Heim oder Gast fehlt.');
  if (venue === '') return fail('Ort fehlt.');
  if (label === '') return fail('Liga fehlt.');
  if (!knownLeagues.includes(base.league)) {
    return fail(`Liga „${base.league}“ (aus „${label}“) ist im Verein nicht angelegt.`);
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
 * Der Schluessel, ueber den ein Spiel als dasselbe erkannt wird: Anpfiff,
 * Heim und Gast.
 *
 * Die Namen werden dafuer vereinheitlicht — Grossschreibung und mehrfache
 * Leerzeichen fallen weg. Der Verband schreibt denselben Verein nicht immer
 * gleich, und `BG NORDSTADT` neben `BG Nordstadt` waere sonst ein zweites
 * Spiel zur selben Zeit in derselben Halle.
 */
export const gameKey = (kickoff: Date, home: string, away: string): string => {
  const plain = (name: string): string => name.replace(/\s+/g, ' ').trim().toLocaleLowerCase('de');
  return `${kickoff.toISOString()}|${plain(home)}|${plain(away)}`;
};

export interface DedupeResult {
  /** Zeilen, die neu angelegt werden. */
  fresh: readonly CsvRow[];
  /** Zeilen, die es schon gibt — sie werden uebersprungen. */
  duplicates: readonly CsvRow[];
}

/**
 * Trennt neue Zeilen von schon vorhandenen — **gezaehlt**, nicht nur gesehen.
 *
 * Zwei gleiche Zeilen in einer Datei sind zwei Spiele und nicht ein Tippfehler:
 * Der Verband setzt zur selben Zeit in derselben Halle zwei Begegnungen an,
 * und beide brauchen ihre eigenen Schiedsrichter. Frueher fiel die zweite
 * stillschweigend weg — aus vierzig Zeilen wurden vierunddreissig Spiele.
 *
 * Verglichen wird deshalb, wie oft eine Paarung in der Datei steht und wie oft
 * sie schon in der Datenbank steht. Steht sie zweimal in der Datei und einmal
 * in der Datenbank, entsteht genau eine. Damit bleibt der Import wiederholbar:
 * derselbe Lauf ein zweites Mal findet beide vor und legt nichts mehr an.
 */
export const dedupe = (
  rows: readonly CsvRow[],
  toKickoff: (localKickoff: string) => Date,
  existingCounts: ReadonlyMap<string, number>,
): DedupeResult => {
  const seen = new Map<string, number>();
  const fresh: CsvRow[] = [];
  const duplicates: CsvRow[] = [];

  for (const row of rows) {
    if (row.localKickoff === null) continue;
    const key = gameKey(toKickoff(row.localKickoff), row.home, row.away);
    const before = seen.get(key) ?? 0;
    seen.set(key, before + 1);
    // Die ersten Vorkommen decken ab, was schon dasteht; erst was darueber
    // hinausgeht, ist neu.
    if (before < (existingCounts.get(key) ?? 0)) duplicates.push(row);
    else fresh.push(row);
  }

  return { fresh, duplicates };
};

/** Zaehlt vorhandene Spiele je Schluessel — die Gegenseite von `dedupe`. */
export const countByKey = (
  games: readonly { kickoff: Date; home: string; away: string }[],
): ReadonlyMap<string, number> => {
  const counts = new Map<string, number>();
  for (const game of games) {
    const key = gameKey(game.kickoff, game.home, game.away);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
};

/** Die Beispiel-CSV aus dem Mockup, als Vorbelegung des Eingabefelds. */
export const CSV_EXAMPLE = [
  [...CSV_COLUMNS, CSV_LICENSE_COLUMN].join(SEPARATOR),
  '19.09.2026;10:00;U14;BG Nordstadt;TSG Aue;Sporthalle Nordstadt;E',
  '19.09.2026;12:00;U16;BG Nordstadt;SG Weiher;Sporthalle Nordstadt;E',
  '19.09.2026;14:30;U18;BG Nordstadt;BBC Talheim;Zeppelinhalle;D',
  '20.09.2026;11:00;Senioren;BG Nordstadt;TSV Kirchheim;Zeppelinhalle;D',
].join('\n');
