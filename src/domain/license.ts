import type { License, Referee } from './types';

/**
 * Lizenzen. E ist die Einstiegslizenz, darueber D, darueber C.
 *
 * Zwei Saetze, und beide sind Absicht:
 *
 * 1. **Die hoehere deckt die niedrigeren mit ab.** C darf C, D und E pfeifen,
 *    D darf D und E, E nur E. Umgekehrt nie: mit D oder E bleibt ein
 *    C-Spiel gesperrt.
 * 2. **Ohne Lizenz geht gar nichts.** Ein Konto ohne Lizenz kann sich in kein
 *    Spiel eintragen, auch nicht in eine Liga, fuer die die Qualifikation
 *    vorliegt. Sehen darf es weiterhin jedes Spiel — die Lizenz beschraenkt
 *    das Eintragen, nicht den Spielplan.
 *
 * Die Qualifikation je Liga (Regel 4) bleibt davon unberuehrt: sie sagt, fuer
 * welche Altersklasse jemand eingeteilt werden darf, die Lizenz sagt, welche
 * Spiele er ueberhaupt pfeifen darf. Beides muss zusammenkommen.
 *
 * Verglichen wird ueber den Rang und nicht ueber die Buchstaben: alphabetisch
 * stuende C vor D und E, der Rangfolge nach steht es darueber.
 */

/** Aufsteigend: die niedrigste zuerst. In dieser Reihenfolge wird sie angezeigt. */
export const LICENSES: readonly License[] = ['E', 'D', 'C'];

/** Rangfolge. Groesser heisst: deckt mehr ab. */
const RANK: Readonly<Record<License, number>> = { E: 0, D: 1, C: 2 };

export const isLicense = (value: unknown): value is License =>
  typeof value === 'string' && (LICENSES as readonly string[]).includes(value);

/** Reicht `held` fuer ein Spiel, das `required` verlangt? */
export const licenseCovers = (held: License | null, required: License): boolean =>
  held !== null && RANK[held] >= RANK[required];

/**
 * Die Stufe eines Spiels, wie sie im Formular danebensteht.
 *
 * "mindestens" und nicht "nur mit": ein D-Spiel darf auch pfeifen, wer C hat.
 * Solange D die hoechste Lizenz war, sagten beide Formulierungen dasselbe;
 * seit es C gibt, waere "nur mit D-Lizenz" schlicht falsch. Fuer die
 * niedrigste Stufe steht gar keine Zahl da — dort reicht jede Lizenz.
 */
export const licenseRequirementLabel = (license: License): string =>
  license === LICENSES[0]
    ? `${license} — jede Lizenz reicht`
    : `${license} — mindestens ${license}-Lizenz`;

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
