import type { License, Referee } from './types';

/**
 * Lizenzen. E ist die Einstiegslizenz, D die hoehere.
 *
 * Zwei Saetze, und beide sind Absicht:
 *
 * 1. **D deckt E mit ab.** Wer die hoehere Lizenz hat, darf auch die Spiele
 *    pfeifen, fuer die die niedrigere genuegt. Umgekehrt nicht.
 * 2. **Ohne Lizenz geht gar nichts.** Ein Konto ohne Lizenz kann sich in kein
 *    Spiel eintragen, auch nicht in eine Liga, fuer die die Qualifikation
 *    vorliegt. Sehen darf es weiterhin jedes Spiel — die Lizenz beschraenkt
 *    das Eintragen, nicht den Spielplan.
 *
 * Die Qualifikation je Liga (Regel 4) bleibt davon unberuehrt: sie sagt, fuer
 * welche Altersklasse jemand eingeteilt werden darf, die Lizenz sagt, welche
 * Spiele er ueberhaupt pfeifen darf. Beides muss zusammenkommen.
 */

export const LICENSES: readonly License[] = ['E', 'D'];

/** Rangfolge. Groesser heisst: deckt mehr ab. */
const RANK: Readonly<Record<License, number>> = { E: 0, D: 1 };

export const isLicense = (value: unknown): value is License =>
  typeof value === 'string' && (LICENSES as readonly string[]).includes(value);

/** Reicht `held` fuer ein Spiel, das `required` verlangt? */
export const licenseCovers = (held: License | null, required: License): boolean =>
  held !== null && RANK[held] >= RANK[required];

/** Lizenz zum Anzeigen. Ohne Lizenz steht das ausdruecklich da. */
export const licenseLabel = (license: License | null): string =>
  license === null ? 'keine Lizenz' : `Lizenz ${license}`;

export const hasLicenseFor = (referee: Referee, required: License): boolean =>
  licenseCovers(referee.license, required);

/**
 * Vorschlag fuer den Vornamen aus dem vollen Namen — das erste Wort.
 *
 * Nur ein Vorschlag beim Anlegen: gespeichert wird eine eigene Spalte, weil
 * das erste Wort bei "von der Heide Tim" das falsche waere. Der Admin
 * korrigiert es dort, wo es nicht passt.
 */
export const firstNameSuggestion = (name: string): string =>
  name.trim().split(/\s+/)[0] ?? '';

/**
 * Die Anrede einer Nachricht.
 *
 * Faellt der Vorname aus — ein Konto aus der Zeit vor der Spalte, das noch
 * niemand nachgepflegt hat —, bleibt der volle Name. Eine Nachricht ohne
 * Anrede waere schlimmer als eine zu foermliche.
 */
export const salutationName = (referee: {
  firstName: string;
  name: string;
}): string => (referee.firstName.trim() === '' ? referee.name : referee.firstName.trim());
