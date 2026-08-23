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

/** Tab-Leiste ohne Login: vier Ziele, mehr traegt die Leiste nicht. */
export const PUBLIC_TABS: readonly NavTarget[] = [
  { href: '/', label: 'Öffentliche Ansicht', short: 'Spiele' },
  { href: '/anmelden', label: 'Anmelden', short: 'Anmelden' },
  { href: '/regeln', label: 'Regeln', short: 'Regeln' },
  { href: '/impressum', label: 'Impressum & Datenschutz', short: 'Rechtliches' },
];
