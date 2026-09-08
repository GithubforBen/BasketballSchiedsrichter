import { LICENSES, isLicense, firstNameSuggestion } from './license';
import { hasUsableStartPassword } from './password';
import { normalisePhone } from './phone';
import type { License } from './types';

/**
 * CSV-Import fuer Schiedsrichter. Regel 30: Konten legt ausschliesslich der
 * Admin an — eine Selbstregistrierung gibt es nicht, wohl aber diesen Weg,
 * eine ganze Abteilung auf einmal einzutragen.
 *
 * Rein und ohne Datenbankbezug, wie beim Spielplan-Import: das Einlesen und
 * die Duplikaterkennung laufen im Browser fuer die Vorschau und auf dem Server
 * fuer den Import, mit denselben Funktionen und daher demselben Ergebnis.
 *
 * Der wichtige Unterschied zum Spielplan: dort sind zwei gleiche Zeilen zwei
 * Spiele, hier sind sie ein Versehen. Eine Person gibt es genau einmal, und
 * erkannt wird sie an der Telefonnummer — sie ist die Anmeldung.
 */

/**
 * Ohne diese beiden geht es nicht: der Name traegt das Start-Passwort
 * (Regel 35), die Nummer ist die Anmeldung.
 */
export const REFEREE_CSV_COLUMNS = ['Name', 'Telefon'] as const;

/**
 * Alles Weitere ist freiwillig.
 *
 * Die Liste, die ein Verein herumliegen hat, besteht aus Namen und Nummern und
 * sonst nichts — genau die soll sich einfuegen lassen. Vorname und Kuerzel
 * entstehen dann aus dem Namen, Rolle und Lizenz lassen sich hinterher in der
 * Tabelle setzen. Die Ligen moeglichst gleich hier, denn ohne Qualifikation
 * kann sich niemand eintragen (Regel 4).
 */
export const REFEREE_CSV_OPTIONAL_COLUMNS = [
  'Vorname',
  'Kürzel',
  'Rolle',
  'Lizenz',
  'Ligen',
] as const;

/** Jede Spalte, die der Import kennt. */
const KNOWN_COLUMNS = [...REFEREE_CSV_COLUMNS, ...REFEREE_CSV_OPTIONAL_COLUMNS] as const;

type Column = (typeof KNOWN_COLUMNS)[number];

export interface RefereeCsvRow {
  /** Zeilennummer in der Datei, ab 1 — fuer die Fehlermeldung. */
  line: number;
  name: string;
  /** Anrede in jeder Nachricht. Leer in der Datei heisst: das erste Wort. */
  firstName: string;
  initials: string;
  /** Ob das Kuerzel aus dem Namen kam und nicht in der Datei stand. */
  initialsFromName: boolean;
  /** Die Nummer, wie sie in der Datei stand — fuer die Fehlermeldung. */
  rawPhone: string;
  /** E.164, sobald die Nummer lesbar war. */
  phone: string | null;
  role: 'referee' | 'admin';
  /** Lizenz, `null` wenn die Spalte fehlt oder leer ist. */
  license: License | null;
  leagueIds: readonly string[];
  /** Was an dieser Zeile nicht stimmt. Leer, wenn sie in Ordnung ist. */
  problem: string;
}

export interface RefereeCsvParseResult {
  rows: readonly RefereeCsvRow[];
  valid: readonly RefereeCsvRow[];
  invalid: readonly RefereeCsvRow[];
  /** Beanstandung an der Datei als Ganzes, etwa eine fehlende Kopfzeile. */
  fileProblem: string;
}

const SEPARATOR = ';';

/**
 * Vorschlag fuers Kuerzel: die Anfangsbuchstaben von erstem und letztem Wort.
 *
 * "Ben Schnorrenberger" wird zu "BS". Das Kuerzel ist eine Erfindung dieser
 * App und steht in keiner Vereinsliste; es fuer dreissig Leute von Hand zu
 * erfinden waere genau die Arbeit, die ein Import abnehmen soll. Kollidiert
 * der Vorschlag, faellt das beim Abgleich auf und die Zeile verlangt ein
 * eigenes Kuerzel — geraten wird nichts, was hinterher falsch dastuende.
 */
export const initialsSuggestion = (name: string): string => {
  const words = name
    .trim()
    .split(/[\s-]+/)
    .filter((word) => word !== '');
  const first = words[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1] ?? '') : '';
  return `${first.slice(0, 1)}${last.slice(0, 1)}`.toUpperCase();
};

/**
 * Liest die Kopfzeile als *Namen*, nicht als Reihenfolge.
 *
 * Damit darf `Telefon;Name` genauso dastehen wie `Name;Vorname;…`, und wer
 * weder Kuerzel noch Lizenz hat, laesst die Spalten einfach weg. Eine feste
 * Reihenfolge waere hier die falsche Strenge: die Datei kommt aus einer
 * Vereinsliste und nicht aus einem Verbandsexport.
 *
 * Eine unbekannte Spalte ist trotzdem ein Fehler und wird nicht stillschweigend
 * uebergangen — „Telefonnummer“ statt „Telefon“ ist ein Tippfehler, und ihn zu
 * ignorieren hiesse, jede Zeile ohne Nummer zu verwerfen, ohne zu sagen warum.
 */
const readHeader = (
  cells: readonly string[],
): { ok: true; columns: ReadonlyMap<Column, number> } | { ok: false; message: string } => {
  const columns = new Map<Column, number>();

  for (const [position, cell] of cells.entries()) {
    if (cell === '') continue;
    const known = KNOWN_COLUMNS.find(
      (column) => column.toLowerCase() === cell.trim().toLowerCase(),
    );
    if (!known) {
      return {
        ok: false,
        message:
          `Die Spalte „${cell.trim()}“ kennt der Import nicht. ` +
          `Erlaubt sind: ${KNOWN_COLUMNS.join(', ')}.`,
      };
    }
    if (columns.has(known)) {
      return { ok: false, message: `Die Spalte „${known}“ steht zweimal in der Kopfzeile.` };
    }
    columns.set(known, position);
  }

  const missing = REFEREE_CSV_COLUMNS.filter((column) => !columns.has(column));
  if (missing.length > 0) {
    return {
      ok: false,
      message: `In der Kopfzeile fehlt: ${missing.join(', ')}. Alles andere ist freiwillig.`,
    };
  }
  return { ok: true, columns };
};

export const parseRefereeCsv = (
  text: string,
  knownLeagues: readonly string[],
): RefereeCsvParseResult => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');

  const empty = { rows: [], valid: [], invalid: [] };
  if (lines.length === 0) {
    return { ...empty, fileProblem: 'Die Datei ist leer.' };
  }

  const header = readHeader((lines[0] ?? '').split(SEPARATOR).map((cell) => cell.trim()));
  if (!header.ok) return { ...empty, fileProblem: header.message };

  const rows = lines
    .slice(1)
    .map((line, index) => readRow(line, index + 2, header.columns, knownLeagues));
  return {
    rows,
    valid: rows.filter((row) => row.problem === ''),
    invalid: rows.filter((row) => row.problem !== ''),
    fileProblem: '',
  };
};

/** „Schiri“, „Schiedsrichter“ und leer ergeben dasselbe; nur „Admin“ nicht. */
const readRole = (value: string): 'referee' | 'admin' | null => {
  const plain = value.trim().toLowerCase();
  if (plain === '' || plain === 'schiri' || plain === 'schiedsrichter') return 'referee';
  if (plain === 'admin') return 'admin';
  return null;
};

/** „U14, U16“ und „U14;U16“ waeren dasselbe — aber das Semikolon trennt Spalten. */
const readLeagues = (value: string): readonly string[] =>
  value
    .split(/[,/]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');

const readRow = (
  line: string,
  lineNumber: number,
  columns: ReadonlyMap<Column, number>,
  knownLeagues: readonly string[],
): RefereeCsvRow => {
  const cells = line.split(SEPARATOR).map((cell) => cell.trim());
  /* Die Spalte steht dort, wo die Kopfzeile sie genannt hat. */
  const cell = (column: Column): string => {
    const position = columns.get(column);
    return position === undefined ? '' : (cells[position] ?? '');
  };

  const name = cell('Name');
  const rawPhone = cell('Telefon');
  const initialsCell = cell('Kürzel');
  const firstNameCell = cell('Vorname');

  const initialsFromName = initialsCell === '';
  const initials = (initialsFromName ? initialsSuggestion(name) : initialsCell).toUpperCase();

  const base: Omit<RefereeCsvRow, 'problem'> = {
    line: lineNumber,
    name,
    firstName: firstNameCell === '' ? firstNameSuggestion(name) : firstNameCell,
    initials,
    initialsFromName,
    rawPhone,
    phone: null,
    role: 'referee',
    license: null,
    leagueIds: [],
  };
  const fail = (problem: string): RefereeCsvRow => ({ ...base, problem });

  if (name === '') return fail('Name fehlt.');
  if (!hasUsableStartPassword(name)) {
    return fail('Aus diesem Namen lässt sich kein Start-Passwort bilden — bitte ausschreiben.');
  }
  if (!/^[A-ZÄÖÜ]{2,4}$/.test(initials)) {
    return fail(
      initialsFromName
        ? `Aus „${name}“ lässt sich kein Kürzel bilden — bitte eine Spalte „Kürzel“ ergänzen.`
        : `Das Kürzel „${initialsCell}“ besteht nicht aus zwei bis vier Buchstaben.`,
    );
  }

  const phone = normalisePhone(rawPhone);
  if (!phone.ok) return fail(phone.message);
  base.phone = phone.phone;

  const role = readRole(cell('Rolle'));
  if (role === null) {
    return fail(`Rolle „${cell('Rolle')}“ gibt es nicht — erlaubt sind Schiri und Admin.`);
  }
  base.role = role;

  const licenseCell = cell('Lizenz').toUpperCase();
  if (licenseCell !== '' && !isLicense(licenseCell)) {
    return fail(`Lizenz „${cell('Lizenz')}“ gibt es nicht — erlaubt sind ${LICENSES.join(', ')}.`);
  }
  base.license = licenseCell === '' ? null : licenseCell;

  const leagues = readLeagues(cell('Ligen'));
  const unknown = leagues.filter((league) => !knownLeagues.includes(league));
  if (unknown.length > 0) {
    return fail(`Liga „${unknown[0]}“ ist im Verein nicht angelegt.`);
  }
  base.leagueIds = [...new Set(leagues)];

  return { ...base, problem: '' };
};

/** Was es schon gibt — beides ist in der Datenbank eindeutig. */
export interface ExistingReferees {
  phones: readonly string[];
  initials: readonly string[];
}

export interface RefereeDedupeResult {
  /** Zeilen, aus denen ein Konto entsteht. */
  fresh: readonly RefereeCsvRow[];
  /** Die Nummer gibt es schon — dieselbe Person, wird uebersprungen. */
  duplicates: readonly RefereeCsvRow[];
  /** Neue Nummer, aber das Kuerzel ist vergeben. Das muss der Admin klaeren. */
  conflicts: readonly RefereeCsvRow[];
}

/**
 * Trennt neue Personen von schon vorhandenen.
 *
 * Anders als beim Spielplan wird nicht gezaehlt, sondern gesehen: zweimal
 * dieselbe Nummer sind nicht zwei Leute. Die zweite Zeile faellt deshalb weg,
 * egal ob die erste in der Datei oder schon in der Datenbank stand. Damit ist
 * der Import wiederholbar — derselbe Lauf ein zweites Mal legt nichts an.
 *
 * Ein vergebenes Kuerzel bei neuer Nummer ist etwas anderes als ein Duplikat:
 * es sind zwei verschiedene Leute, die sich dieselben zwei Buchstaben teilen
 * wollen. Das kann nur der Admin entscheiden, also wird die Zeile nicht still
 * uebersprungen, sondern ausgewiesen.
 */
export const dedupeReferees = (
  rows: readonly RefereeCsvRow[],
  existing: ExistingReferees,
): RefereeDedupeResult => {
  const phones = new Set(existing.phones);
  const initials = new Set(existing.initials);
  const fresh: RefereeCsvRow[] = [];
  const duplicates: RefereeCsvRow[] = [];
  const conflicts: RefereeCsvRow[] = [];

  for (const row of rows) {
    if (row.phone === null) continue;
    if (phones.has(row.phone)) {
      duplicates.push(row);
      continue;
    }
    if (initials.has(row.initials)) {
      conflicts.push(row);
      continue;
    }
    phones.add(row.phone);
    initials.add(row.initials);
    fresh.push(row);
  }

  return { fresh, duplicates, conflicts };
};

/** Was an einer Zeile mit vergebenem Kuerzel zu tun ist. */
export const conflictMessage = (row: RefereeCsvRow): string =>
  row.initialsFromName
    ? `Kürzel „${row.initials}“ ist schon vergeben — bitte eines in der Spalte „Kürzel“ eintragen.`
    : `Kürzel „${row.initials}“ ist schon vergeben.`;

/** Die Beispiel-Datei als Vorbelegung des Eingabefelds. */
export const REFEREE_CSV_EXAMPLE = [
  'Name;Vorname;Kürzel;Telefon;Rolle;Lizenz;Ligen',
  'Jan Schnorrenberger;Jan;JS;0152 23529220;Schiri;E;U14,U16',
  'Lena Vogt;;LV;0171 2345678;Schiri;D;U12,Senioren',
  'Mara Kern;;;+49 160 5551234;Admin;D;U10,U12',
].join('\n');
