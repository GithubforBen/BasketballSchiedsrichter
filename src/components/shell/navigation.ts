import type { NavGroup, NavTarget } from './nav';

/**
 * Die Navigation je Rolle.
 *
 * Gruppiert statt aufgereiht. Der Adminbereich hat elf Ziele; als eine Liste
 * standen "Offene Spiele & Meldungen" (was der Verein noch besetzen muss) und
 * "Offene Spiele" (wo ich mich selbst eintrage) unmittelbar untereinander und
 * waren am Namen kaum zu unterscheiden. Die Gruppen sagen, aus welcher Rolle
 * heraus man auf ein Ziel klickt — das ist der Unterschied zwischen den
 * beiden, und ohne ihn ist er nicht zu sehen.
 */

/** Die oeffentliche Ansicht — sie steht in jeder Rolle zuoberst. */
const PUBLIC_ENTRY: NavTarget = { href: '/', label: 'Öffentliche Ansicht', short: 'Spielplan' };

/** Was jeder Angemeldete fuer sich selbst tut. */
const OWN_AREA: readonly NavTarget[] = [
  { href: '/spiele', label: 'Offene Spiele', short: 'Offene' },
  { href: '/kalender', label: 'Kalender & Verlauf', short: 'Kalender' },
  { href: '/profil', label: 'Profil & Erinnerungen', short: 'Profil' },
];

export const PUBLIC_NAV: readonly NavGroup[] = [
  { label: null, items: [PUBLIC_ENTRY, { href: '/anmelden', label: 'Anmelden', short: 'Anmelden' }] },
];

export const FOOTER_NAV: readonly NavTarget[] = [
  { href: '/regeln', label: 'Regeln', short: 'Regeln' },
  { href: '/impressum', label: 'Impressum & Datenschutz', short: 'Rechtliches' },
];

/** Navigation fuer angemeldete Schiedsrichter. */
export const REFEREE_NAV: readonly NavGroup[] = [
  { label: null, items: [PUBLIC_ENTRY] },
  { label: 'Mein Bereich', items: OWN_AREA },
];

/** Tab-Leiste fuer Schiedsrichter — vier Ziele, mehr traegt die Leiste nicht. */
export const REFEREE_TABS: readonly NavTarget[] = [
  { href: '/spiele', label: 'Offene Spiele', short: 'Offene' },
  { href: '/kalender', label: 'Kalender & Verlauf', short: 'Kalender' },
  { href: '/profil', label: 'Profil & Erinnerungen', short: 'Profil' },
  { href: '/regeln', label: 'Regeln', short: 'Regeln' },
];

/**
 * Navigation fuer Admins.
 *
 * Ein Admin ist auch Schiedsrichter — er traegt eine Lizenz und darf sich in
 * Spiele eintragen. Deshalb steht "Mein Bereich" auch hier: ohne ihn kaeme er
 * an seine eigenen Eintragungen und an seine Tagesuebersicht gar nicht heran.
 */
export const ADMIN_NAV: readonly NavGroup[] = [
  { label: null, items: [PUBLIC_ENTRY] },
  {
    label: 'Spielbetrieb',
    items: [
      { href: '/uebersicht', label: 'Spielübersicht', short: 'Spiele' },
      { href: '/meldungen', label: 'Offene Spiele & Meldungen', short: 'Meldungen' },
      { href: '/anlegen', label: 'Spiele anlegen', short: 'Neu' },
      { href: '/nachpflegen', label: 'Spiele nachpflegen', short: 'Nachpflegen' },
    ],
  },
  {
    label: 'Verwaltung',
    items: [
      { href: '/schiris', label: 'Schiedsrichter', short: 'Schiris' },
      { href: '/nachrichten', label: 'Nachrichten-Protokoll', short: 'Nachrichten' },
      { href: '/einstellungen', label: 'Einstellungen', short: 'Einstellungen' },
    ],
  },
  { label: 'Mein Bereich', items: OWN_AREA },
];

export const ADMIN_TABS: readonly NavTarget[] = [
  { href: '/uebersicht', label: 'Spielübersicht', short: 'Spiele' },
  { href: '/meldungen', label: 'Offene Spiele & Meldungen', short: 'Meldungen' },
  { href: '/anlegen', label: 'Spiele anlegen', short: 'Neu' },
  { href: '/schiris', label: 'Schiedsrichter', short: 'Schiris' },
];

/** Tab-Leiste ohne Login: vier Ziele, mehr traegt die Leiste nicht. */
export const PUBLIC_TABS: readonly NavTarget[] = [
  { href: '/', label: 'Öffentliche Ansicht', short: 'Spiele' },
  { href: '/anmelden', label: 'Anmelden', short: 'Anmelden' },
  { href: '/regeln', label: 'Regeln', short: 'Regeln' },
  { href: '/impressum', label: 'Impressum & Datenschutz', short: 'Rechtliches' },
];

/**
 * Die Navigation, die zur Rolle gehoert.
 *
 * Die Seiten `/spiele`, `/kalender` und `/profil` gibt es fuer beide Rollen.
 * Ohne diese Weiche trugen sie fest die Navigation der Schiedsrichter — ein
 * Admin, der dort landete, sah keinen Weg in seinen eigenen Bereich und hielt
 * sich fuer keinen Admin.
 */
export const navFor = (
  role: 'referee' | 'admin',
): { nav: readonly NavGroup[]; tabs: readonly NavTarget[] } =>
  role === 'admin'
    ? { nav: ADMIN_NAV, tabs: ADMIN_TABS }
    : { nav: REFEREE_NAV, tabs: REFEREE_TABS };

/**
 * Die Navigation fuer eine Seite, die es mit und ohne Anmeldung gibt.
 *
 * Betrifft die oeffentliche Ansicht, die Regeln und das Rechtliche. Sie trugen
 * fest `PUBLIC_NAV` — wer angemeldet dorthin ging, sah in der Kopfzeile
 * weiterhin seinen Namen, in der Seitenleiste aber nur noch "Anmelden". Der
 * erste Klick auf "Spiele" fuehrte dann auf die oeffentliche Ansicht statt in
 * den eigenen Bereich, und erst der zweite kam an.
 */
export const navForViewer = (
  user: { role: 'referee' | 'admin' } | null | undefined,
): { nav: readonly NavGroup[]; tabs: readonly NavTarget[] } =>
  user ? navFor(user.role) : { nav: PUBLIC_NAV, tabs: PUBLIC_TABS };
