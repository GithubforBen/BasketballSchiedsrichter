/**
 * Vereinsdaten. Die App bedient genau einen Verein (PLAN.md Abschnitt 1);
 * alles, was sonst aus einer Mandantentabelle kaeme, steht hier.
 */
export const CLUB = {
  name: 'BG Nordstadt',
  shortName: 'BG Nordstadt',
  appName: 'SCHIRIPLAN',
  timeZone: 'Europe/Berlin',
  locale: 'de-DE',
} as const;

/** Ligen, mit denen ein frischer Verein startet. Der Admin kann sie aendern. */
export const INITIAL_LEAGUES = ['U14', 'U16', 'U18', 'Erwachsene', 'Senioren'] as const;
