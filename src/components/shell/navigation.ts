import type { NavTarget } from './nav';

/**
 * Die Navigation je Rolle.
 *
 * Reihenfolge wie im Mockup: die oeffentliche Ansicht steht oben, danach die
 * Bereiche der jeweiligen Rolle.
 */

export const PUBLIC_NAV: readonly NavTarget[] = [
  { href: '/', label: 'Öffentliche Ansicht', short: 'Spiele' },
  { href: '/anmelden', label: 'Anmelden', short: 'Anmelden' },
];

export const FOOTER_NAV: readonly NavTarget[] = [
  { href: '/regeln', label: 'Regeln', short: 'Regeln' },
  { href: '/impressum', label: 'Impressum & Datenschutz', short: 'Impressum' },
];

/**
 * Navigation fuer angemeldete Schiedsrichter. Die oeffentliche Ansicht steht
 * oben, wie im Mockup.
 */
export const REFEREE_NAV: readonly NavTarget[] = [
  { href: '/', label: 'Öffentliche Ansicht', short: 'Spielplan' },
  { href: '/kalender', label: 'Kalender & Verlauf', short: 'Kalender' },
  { href: '/spiele', label: 'Offene Spiele', short: 'Offene' },
  { href: '/profil', label: 'Profil & Erinnerungen', short: 'Profil' },
];

/** Tab-Leiste fuer Schiedsrichter — vier Ziele, mehr traegt die Leiste nicht. */
export const REFEREE_TABS: readonly NavTarget[] = [
  { href: '/spiele', label: 'Offene Spiele', short: 'Offene' },
  { href: '/kalender', label: 'Kalender & Verlauf', short: 'Kalender' },
  { href: '/profil', label: 'Profil & Erinnerungen', short: 'Profil' },
  { href: '/regeln', label: 'Regeln', short: 'Regeln' },
];

/** Tab-Leiste ohne Login: vier Ziele, mehr traegt die Leiste nicht. */
export const PUBLIC_TABS: readonly NavTarget[] = [
  { href: '/', label: 'Öffentliche Ansicht', short: 'Spiele' },
  { href: '/anmelden', label: 'Anmelden', short: 'Anmelden' },
  { href: '/regeln', label: 'Regeln', short: 'Regeln' },
  { href: '/impressum', label: 'Impressum & Datenschutz', short: 'Rechtliches' },
];
