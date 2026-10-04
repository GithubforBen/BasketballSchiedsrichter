import { leagueDisplay } from './league';
import { dateLabel, matchTitle } from './schedule';
import { hours } from './time';
import type { Game } from './types';

/**
 * Der eigene Einsatzplan als Kalenderdatei (iCalendar, RFC 5545).
 *
 * Wozu: Google Kalender und Apple Kalender lesen beide dieses Format, und ein
 * Schiedsrichter traegt seine Spiele sonst von Hand ab. Die Datei wird
 * **importiert**, nicht abonniert — sie ist eine Momentaufnahme. Wer sie
 * erneut herunterlaedt, bekommt dieselben `UID`s: ein Kalender erkennt die
 * Termine daran wieder und legt sie nicht ein zweites Mal an, sondern
 * aktualisiert sie.
 *
 * Was bewusst **nicht** drinsteht:
 *
 * - **Keine Erinnerung (`VALARM`).** Die App erinnert selbst und jeder stellt
 *   den Vorlauf im Profil ein (Regel 21). Eine zweite Erinnerung aus dem
 *   Kalender waere eine, die niemand bestellt hat und niemand abstellen kann.
 * - **Keine Namen anderer Schiedsrichter.** Regel 29: den vollen Namen sieht
 *   nur, wer angemeldet ist. Eine Kalenderdatei verlaesst die App und landet
 *   auf fremden Servern.
 */

const LINE_BREAK = '\r\n';

/**
 * Wie lange ein Termin im Kalender steht.
 *
 * Der Spielplan kennt nur den Anpfiff; ein Kalendereintrag braucht ein Ende.
 * Zwei Stunden sind der Erfahrungswert fuer ein Jugendspiel samt Einlaufen,
 * Schiedsrichterbesprechung und Spielbericht. Genauer geht es nicht, und ein
 * Termin ohne Ende waere fuer die Tagesplanung unbrauchbar.
 */
export const EVENT_DURATION_MS = hours(2);

/** Ein Einsatz, wie er in der Datei landet. */
export interface CalendarEntry {
  game: Game;
  /** „Schiedsrichter 1“, „Ersatz 2“ — steht im Titel des Termins. */
  role: string;
}

/**
 * Ein Zeitpunkt in der Schreibweise von RFC 5545, in Weltzeit.
 *
 * Absichtlich UTC und keine Ortszeit: eine Ortszeit verlangt einen
 * mitgelieferten `VTIMEZONE`-Block mit allen Umstellungsregeln, und den liest
 * nicht jeder Kalender gleich. `Z` ist eindeutig, und jeder Kalender rechnet
 * selbst in die Zeitzone des Geraets um.
 */
export const icsTimestamp = (date: Date): string =>
  `${date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`;

/**
 * Maskiert einen Textwert. Semikolon, Komma und Backslash trennen in dieser
 * Sprache Felder — in „Halle 1, Feld 2“ taeten sie das faelschlich.
 */
export const icsText = (value: string): string =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

/**
 * Bricht eine Zeile nach 75 Oktetten um, wie es die Norm verlangt.
 *
 * Gezaehlt werden **Oktette, nicht Zeichen**: ein „ß“ belegt in UTF-8 zwei.
 * Mitten in einem Zeichen zu trennen ergaebe kaputte Umlaute, deshalb bricht
 * die Schleife nur an Zeichengrenzen um. Die Fortsetzungszeile beginnt mit
 * einem Leerzeichen.
 */
export const foldLine = (line: string): string => {
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  /* Ueber Codepoints laufen, nicht ueber UTF-16-Einheiten — Emoji zaehlen einfach. */
  for (const char of line) {
    const size = Buffer.byteLength(char, 'utf8');
    /* Die Fortsetzungszeile traegt ein fuehrendes Leerzeichen und hat deshalb 74 uebrig. */
    const limit = parts.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      parts.push(current);
      current = '';
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.map((part, index) => (index === 0 ? part : ` ${part}`)).join(LINE_BREAK);
};

/**
 * Die eindeutige Kennung eines Termins.
 *
 * Sie haengt allein an der Spiel-Id — nicht an der Rolle und nicht am
 * Zeitpunkt des Exports. Nur so erkennt der Kalender beim zweiten Import
 * denselben Termin wieder, auch wenn der Schiedsrichter inzwischen von Ersatz
 * auf Schiri 2 nachgerueckt ist.
 */
export const eventUid = (gameId: string): string => `${gameId}@schiriplan`;

const event = (entry: CalendarEntry, stamp: Date): readonly string[] => {
  const { game } = entry;
  return [
    'BEGIN:VEVENT',
    `UID:${eventUid(game.id)}`,
    `DTSTAMP:${icsTimestamp(stamp)}`,
    `DTSTART:${icsTimestamp(game.kickoff)}`,
    `DTEND:${icsTimestamp(new Date(game.kickoff.getTime() + EVENT_DURATION_MS))}`,
    `SUMMARY:${icsText(`${entry.role}: ${matchTitle(game)}`)}`,
    `LOCATION:${icsText(game.venue)}`,
    `DESCRIPTION:${icsText(
      `${leagueDisplay(game)} · ${entry.role} · Lizenz ${game.requiredLicense}`,
    )}`,
    /*
     * `TRANSP:OPAQUE` heisst „diese Zeit ist belegt“. Genau das ist der Punkt
     * der Uebung: wer ein Spiel pfeift, soll fuer andere Termine als besetzt
     * gelten.
     */
    'TRANSP:OPAQUE',
    'END:VEVENT',
  ];
};

export const buildCalendar = (
  entries: readonly CalendarEntry[],
  stamp: Date,
): string => {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SCHIRIPLAN//Schiedsrichter-Planung//DE',
    'CALSCALE:GREGORIAN',
    /*
     * `PUBLISH` und nicht `REQUEST`: die Datei lädt jemand für sich selbst
     * herunter. `REQUEST` waere eine Einladung, auf die ein Kalender mit
     * Zusage oder Absage antworten will — an niemanden.
     */
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsText('Schiedsrichter-Einsätze')}`,
    ...entries.flatMap((entry) => event(entry, stamp)),
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join(LINE_BREAK) + LINE_BREAK;
};

/** „schiri-termine-2026-09-20.ics“ — das Datum macht mehrere Dateien unterscheidbar. */
export const calendarFileName = (now: Date, timeZone: string): string => {
  const [day = '', month = '', year = ''] = dateLabel(now, timeZone).split('.');
  return `schiri-termine-${year}-${month}-${day}.ics`;
};
