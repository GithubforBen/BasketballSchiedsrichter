import { describe, expect, it } from 'vitest';
import { at, makeGame } from './__fixtures__/build';
import {
  buildCalendar,
  calendarFileName,
  eventUid,
  foldLine,
  icsText,
  icsTimestamp,
  type CalendarEntry,
} from './ics';

/**
 * Die Kalenderdatei.
 *
 * Geprueft wird nicht, ob Google und Apple sie moegen — das kann nur ein
 * echter Import zeigen. Geprueft wird, dass die Datei die Zusagen der Norm
 * einhaelt, an denen ein Import sonst scheitert: Zeilenenden, Maskierung,
 * Zeilenlaenge, Zeitpunkte in Weltzeit und stabile Kennungen.
 */

const entry = (over: Partial<CalendarEntry> = {}): CalendarEntry => ({
  game: makeGame({ kickoff: at('2026-09-26T12:00:00Z') }),
  role: 'Schiedsrichter 1',
  ...over,
});

const lines = (ics: string): readonly string[] => ics.split('\r\n');

const valueOf = (ics: string, property: string): string | undefined =>
  lines(ics)
    .find((line) => line.startsWith(`${property}:`))
    ?.slice(property.length + 1);

describe('Kalenderdatei — Geruest', () => {
  it('umschliesst die Termine mit einem Kalender', () => {
    const ics = buildCalendar([entry()], at('2026-09-20T10:00:00Z'));
    expect(lines(ics)[0]).toBe('BEGIN:VCALENDAR');
    expect(lines(ics).filter((l) => l !== '')).toContain('END:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
  });

  it('trennt Zeilen mit CRLF, wie die Norm es verlangt', () => {
    const ics = buildCalendar([entry()], at('2026-09-20T10:00:00Z'));
    /* Kein einziges nacktes \n: daran scheitern strenge Leser. */
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n');
    expect(ics.endsWith('\r\n')).toBe(true);
  });

  it('schreibt auch ohne einen einzigen Termin eine gueltige Datei', () => {
    const ics = buildCalendar([], at('2026-09-20T10:00:00Z'));
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).not.toContain('BEGIN:VEVENT');
  });

  it('schreibt je Einsatz genau einen Termin', () => {
    const ics = buildCalendar(
      [entry(), entry({ game: makeGame({ id: 'g2', kickoff: at('2026-10-01T16:00:00Z') }) })],
      at('2026-09-20T10:00:00Z'),
    );
    expect(lines(ics).filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(2);
  });
});

describe('Kalenderdatei — ein Termin', () => {
  const ics = buildCalendar([entry()], at('2026-09-20T10:00:00Z'));

  it('nennt Rolle und Begegnung im Titel', () => {
    expect(valueOf(ics, 'SUMMARY')).toBe('Schiedsrichter 1: BG Nordstadt — TV Ostheim');
  });

  it('setzt den Anpfiff als Beginn, in Weltzeit', () => {
    expect(valueOf(ics, 'DTSTART')).toBe('20260926T120000Z');
  });

  it('haengt zwei Stunden als Dauer an — der Spielplan kennt nur den Anpfiff', () => {
    expect(valueOf(ics, 'DTEND')).toBe('20260926T140000Z');
  });

  it('traegt die Halle als Ort ein', () => {
    expect(valueOf(ics, 'LOCATION')).toBe('Sporthalle Nordstadt\\, Feld 2');
  });

  it('haelt die Zeit als belegt — darum geht es beim Eintragen', () => {
    expect(ics).toContain('TRANSP:OPAQUE');
  });

  it('nennt weder einen anderen Schiedsrichter noch dessen Namen — Regel 29', () => {
    /*
     * Die Datei verlaesst die App und landet bei Google oder Apple. Was darin
     * steht, steht dort dauerhaft — der volle Name eines anderen gehoert
     * nicht dazu.
     */
    expect(ics).not.toContain('ATTENDEE');
    expect(ics).not.toContain('ORGANIZER');
  });

  it('bringt keine eigene Erinnerung mit — die App erinnert selbst', () => {
    expect(ics).not.toContain('VALARM');
  });
});

describe('Kalenderdatei — Wiedererkennen beim zweiten Import', () => {
  it('haengt die Kennung allein an der Spiel-Id', () => {
    expect(eventUid('abc')).toBe('abc@schiriplan');
  });

  it('behaelt die Kennung, wenn jemand die Rolle wechselt', () => {
    const alsErsatz = buildCalendar([entry({ role: 'Ersatz 1' })], at('2026-09-20T10:00:00Z'));
    const alsSchiri = buildCalendar([entry()], at('2026-09-20T10:00:00Z'));
    expect(valueOf(alsErsatz, 'UID')).toBe(valueOf(alsSchiri, 'UID'));
    /* Der Titel aendert sich sehr wohl — sonst waere der Wechsel unsichtbar. */
    expect(valueOf(alsErsatz, 'SUMMARY')).not.toBe(valueOf(alsSchiri, 'SUMMARY'));
  });
});

describe('Kalenderdatei — Maskierung', () => {
  it('maskiert Komma, Semikolon und Backslash', () => {
    expect(icsText('a,b;c\\d')).toBe('a\\,b\\;c\\\\d');
  });

  it('macht aus einem Zeilenumbruch die Folge \\n', () => {
    expect(icsText('Halle 1\nFeld 2')).toBe('Halle 1\\nFeld 2');
  });

  it('laesst Umlaute unangetastet — die Datei ist UTF-8', () => {
    expect(icsText('Großsporthalle')).toBe('Großsporthalle');
  });
});

describe('Kalenderdatei — Zeilenlaenge', () => {
  it('laesst eine kurze Zeile in Ruhe', () => {
    expect(foldLine('SUMMARY:kurz')).toBe('SUMMARY:kurz');
  });

  it('bricht nach 75 Oktetten um und rueckt die Fortsetzung ein', () => {
    const folded = foldLine(`SUMMARY:${'x'.repeat(200)}`);
    const parts = folded.split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    expect(parts[0]).toHaveLength(75);
    expect(parts.slice(1).every((part) => part.startsWith(' '))).toBe(true);
  });

  it('zaehlt Oktette und trennt kein Zeichen in der Mitte', () => {
    /*
     * „ß“ belegt in UTF-8 zwei Oktette. Wer nach Zeichen zaehlt, schreibt zu
     * lange Zeilen; wer mitten im Zeichen trennt, zerlegt den Umlaut in zwei
     * kaputte Haelften. Beides faellt hier auf.
     */
    const folded = foldLine(`LOCATION:${'ß'.repeat(80)}`);
    for (const part of folded.split('\r\n')) {
      expect(Buffer.byteLength(part, 'utf8')).toBeLessThanOrEqual(75);
      expect(part).not.toContain('�');
    }
    expect(folded.replace(/\r\n /g, '')).toBe(`LOCATION:${'ß'.repeat(80)}`);
  });
});

describe('Kalenderdatei — Zeitpunkte und Dateiname', () => {
  it('schreibt den Zeitpunkt ohne Trenner und mit Z', () => {
    expect(icsTimestamp(at('2026-09-26T12:00:00Z'))).toBe('20260926T120000Z');
  });

  it('nennt den Tag des Exports im Dateinamen', () => {
    expect(calendarFileName(at('2026-09-20T22:00:00Z'), 'Europe/Berlin')).toBe(
      'schiri-termine-2026-09-21.ics',
    );
  });
});
