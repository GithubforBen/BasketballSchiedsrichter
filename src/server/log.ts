import 'server-only';

/**
 * Protokollierung ohne personenbezogene Daten.
 *
 * Der Verein verarbeitet Namen und Telefonnummern. Ein Protokoll, das sie
 * mitschreibt, ist eine zweite Datenhaltung — eine, die niemand loescht, die in
 * keinem Loeschkonzept steht und die beim naechsten Auskunftsersuchen niemand
 * durchsuchen kann. Deshalb gibt es hier nur diese zwei Funktionen, und sie
 * nehmen ausdruecklich keine freien Texte entgegen: was mitgeschrieben wird,
 * sind Zahlen, feste Kennungen und Fehlerarten.
 *
 * Wer eine Person benennen muss, nimmt ihre Id — sie ist ohne Zugriff auf die
 * Datenbank nichtssagend und laesst sich beim Loeschen der Person mitloeschen.
 */

/** Werte, die im Protokoll stehen duerfen: nichts Freies, nichts Benanntes. */
export type LogValue = string | number | boolean | null;

const format = (event: string, fields: Readonly<Record<string, LogValue>>): string => {
  const parts = Object.entries(fields).map(([key, value]) => `${key}=${String(value)}`);
  return [`[${new Date().toISOString()}]`, event, ...parts].join(' ');
};

/** Ein normaler Vorgang, der spaeter nachvollziehbar sein soll. */
export const logEvent = (event: string, fields: Readonly<Record<string, LogValue>> = {}): void => {
  console.log(format(event, fields));
};

/**
 * Ein Fehler. Die Meldung selbst wird bewusst **nicht** uebernommen: sie kann
 * eine Datenbankabfrage samt Telefonnummer enthalten. Uebrig bleibt die Art des
 * Fehlers — genug, um zu erkennen, was los ist, ohne ein zweites Melderegister
 * anzulegen. Der ausfuehrliche Text steht in der Outbox-Zeile beziehungsweise
 * im Prüfprotokoll, wo er zur Person gehoert und mit ihr geloescht wird.
 */
export const logFailure = (
  event: string,
  error: unknown,
  fields: Readonly<Record<string, LogValue>> = {},
): void => {
  const kind = error instanceof Error ? error.name : typeof error;
  console.error(format(event, { ...fields, fehlerart: kind }));
};
