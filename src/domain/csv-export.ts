import { leagueDisplay } from './league';
import { dateLabel, timeLabel, type GameWithSlots } from './schedule';
import { SLOT_LABELS_SHORT } from './slots';
import { SLOT_INDEXES } from './types';

/**
 * CSV-Export des Spielplans mit Besetzung.
 *
 * Die Gegenrichtung zum Import in `csv.ts`, und absichtlich in derselben
 * Sprache: die ersten sieben Spalten sind Zeichen fuer Zeichen die des
 * Imports, dahinter stehen die vier Plaetze. Eine Datei, die hier herauskommt,
 * laesst sich damit ohne Umbau wieder einlesen — die Besetzungsspalten
 * ignoriert der Import, weil er nur die Breite der Kopfzeile misst und die
 * Lizenz an Position sieben findet.
 *
 * Rein und ohne Datenbankbezug: was in der Datei steht, ist hier vollstaendig
 * testbar, das Laden der Zeilen passiert woanders.
 */

const SEPARATOR = ';';

/**
 * Zeilenende nach RFC 4180.
 *
 * Excel unter Windows braucht es; der Import liest `\r?\n` und nimmt beides.
 */
const LINE_BREAK = '\r\n';

/**
 * Das Byte-Order-Mark vor der Kopfzeile.
 *
 * Ohne es haelt Excel eine UTF-8-Datei fuer Windows-1252 und macht aus
 * „Sporthalle Süd“ ein „Sporthalle SÃ¼d“ — der haeufigste Grund, warum ein
 * Export beim Empfaenger kaputt aussieht, obwohl die Datei in Ordnung ist.
 * LibreOffice und jedes Programm, das UTF-8 ohnehin annimmt, ueberlesen es.
 */
export const BOM = '\uFEFF';

/** Kopfzeile: die sieben Spalten des Imports, dann die vier Plaetze. */
export const GAME_EXPORT_COLUMNS = [
  'Datum',
  'Zeit',
  'Liga',
  'Heim',
  'Gast',
  'Ort',
  'Lizenz',
  ...SLOT_INDEXES.map((index) => SLOT_LABELS_SHORT[index]),
] as const;

/**
 * Ein Feld so, dass es beim Einlesen wieder dasselbe ergibt.
 *
 * Semikolon, Anfuehrungszeichen und Zeilenumbruch sind die drei Zeichen, an
 * denen eine CSV-Zeile zerfaellt. Sie kommen in Hallennamen zwar selten vor,
 * aber „Sporthalle Nord; Halle 2“ ist kein ausgedachter Fall — und ohne
 * Anfuehrungszeichen waere daraus eine Zeile mit einer Spalte zuviel.
 */
export const csvField = (value: string): string =>
  /[";\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

/** Die Namen der vier Plaetze in Platzreihenfolge, leer wo niemand steht. */
const slotNames = (
  entry: GameWithSlots,
  nameOf: (refereeId: string) => string,
): readonly string[] =>
  SLOT_INDEXES.map((index) => {
    const assignment = entry.slots.find((slot) => slot.index === index)?.assignment;
    return assignment ? nameOf(assignment.refereeId) : '';
  });

/** Eine Zeile als Felder — ungetrennt, damit der Test sie einzeln pruefen kann. */
export const gameExportRow = (
  entry: GameWithSlots,
  nameOf: (refereeId: string) => string,
  timeZone: string,
): readonly string[] => [
  dateLabel(entry.game.kickoff, timeZone),
  timeLabel(entry.game.kickoff, timeZone),
  leagueDisplay(entry.game),
  entry.game.home,
  entry.game.away,
  entry.game.venue,
  entry.game.requiredLicense,
  ...slotNames(entry, nameOf),
];

/**
 * Die vollstaendige Datei.
 *
 * Die Reihenfolge der Spiele kommt von aussen und wird hier nicht angetastet:
 * die Abfrage sortiert bereits nach Anpfiff, und ein zweites Sortieren an
 * dieser Stelle wuerde die beiden Vorstellungen davon, was "der Reihe nach"
 * heisst, auseinanderlaufen lassen.
 */
export const buildGameCsv = (
  entries: readonly GameWithSlots[],
  nameOf: (refereeId: string) => string,
  timeZone: string,
): string =>
  BOM +
  [
    GAME_EXPORT_COLUMNS.join(SEPARATOR),
    ...entries.map((entry) =>
      gameExportRow(entry, nameOf, timeZone).map(csvField).join(SEPARATOR),
    ),
  ].join(LINE_BREAK) +
  LINE_BREAK;

/**
 * Der Dateiname, unter dem der Browser die Datei ablegt.
 *
 * Mit Datum, weil ein Export eine Momentaufnahme ist: wer zwei davon im
 * Download-Ordner liegen hat, muss sehen koennen, welcher der neuere ist.
 * Ohne Umlaute und Leerzeichen, damit kein Mailprogramm und kein Server den
 * Namen unterwegs umschreibt.
 */
export const gameExportFileName = (now: Date, timeZone: string): string => {
  const [day = '', month = '', year = ''] = dateLabel(now, timeZone).split('.');
  return `spielplan-${year}-${month}-${day}.csv`;
};
