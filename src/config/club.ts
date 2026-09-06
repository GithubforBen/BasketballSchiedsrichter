/**
 * Vereinsdaten. Die App bedient genau einen Verein (PLAN.md Abschnitt 1);
 * alles, was sonst aus einer Mandantentabelle kaeme, steht hier.
 */
export const CLUB = {
  /** Der Verein, wie er im Spielplan und im Seitentitel erscheint. */
  name: 'Schulsportclub Bergstraße',
  /** Kurzform fuer die Kopfzeile, wo wenig Platz ist. */
  shortName: 'SSC Bergstraße',
  appName: 'SCHIRIPLAN',
  timeZone: 'Europe/Berlin',
  locale: 'de-DE',
} as const;

/**
 * Ligen, mit denen ein frischer Verein startet. Der Admin kann sie aendern.
 *
 * "Erwachsene" stand hier einmal neben "Senioren" und meinte dieselbe Gruppe.
 * Zusammengelegt wurde beides in Migration 0008; eine neue Installation legt
 * die zweite Liga deshalb gar nicht erst an.
 */
export const INITIAL_LEAGUES = ['U10', 'U12', 'U14', 'U16', 'U18', 'Senioren'] as const;
