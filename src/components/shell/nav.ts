import type { Route } from 'next';

/**
 * Navigationsziele und ihre Markierung.
 *
 * Bewusst ohne JSX: die Frage "welcher Eintrag ist der aktuelle" ist reine
 * Logik und laesst sich so ohne Renderer testen.
 */

export interface NavTarget {
  /**
   * Typisiert gegen die tatsaechlich vorhandenen Routen. Ein Tippfehler oder
   * ein Link auf eine noch nicht gebaute Seite faellt damit beim Build auf,
   * nicht erst beim Klicken.
   */
  href: Route;
  label: string;
  /** Kurzform fuer die Tab-Leiste, wo nur wenig Platz ist. */
  short: string;
  /** Zahl neben dem Eintrag, z. B. offene Meldungen. */
  badge?: number;
}

/** Ein Ziel gilt als aktuell, wenn der Pfad darauf oder darunter liegt. */
export const isCurrent = (current: string, href: string): boolean =>
  current === href || (href !== '/' && current.startsWith(`${href}/`));

/** Wie viele Ziele die Tab-Leiste am Handy traegt, ohne zu ueberlaufen. */
export const MAX_TABS = 4;

/**
 * Die Ziele der Tab-Leiste.
 *
 * Ohne ausdrueckliche Auswahl gilt die Hauptnavigation — aber nur, solange sie
 * hineinpasst. Laengere Navigationen ohne Auswahl sind ein Fehler im Aufruf und
 * fallen hier auf, statt am Handy als gequetschte Leiste zu erscheinen.
 */
export const tabTargets = (
  nav: readonly NavTarget[],
  tabs?: readonly NavTarget[],
): readonly NavTarget[] => {
  if (tabs) return tabs.slice(0, MAX_TABS);
  if (nav.length > MAX_TABS) {
    throw new Error(
      `Die Tab-Leiste traegt hoechstens ${MAX_TABS} Ziele, bekommen hat sie ${nav.length}. ` +
        'Uebergib der Shell eine eigene "tabs"-Auswahl.',
    );
  }
  return nav;
};
