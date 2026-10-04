import { describe, expect, it } from 'vitest';
import { navItems, tabTargets, type NavGroup, type NavTarget } from './nav';
import {
  ADMIN_NAV,
  ADMIN_TABS,
  FOOTER_NAV,
  PUBLIC_NAV,
  PUBLIC_TABS,
  REFEREE_NAV,
  REFEREE_TABS,
  navFor,
  navForViewer,
} from './navigation';

/**
 * Gleichstand zwischen Telefon und Rechner.
 *
 * Am Rechner steht die Seitenleiste, am Telefon dasselbe im Menue der
 * Kopfzeile — beide bekommen in `Shell` denselben Baustein mit denselben
 * Daten. Diese Tests halten fest, was daraus folgen muss: **kein Ziel ist nur
 * auf einem der beiden Wege zu erreichen.**
 *
 * Der Anlass ist kein erfundener. Die Tab-Leiste traegt vier Ziele, die
 * Admin-Navigation hat zehn; solange die Leiste der einzige Weg am Telefon
 * war, fehlten dort sechs davon — Einstellungen, Nachrichten-Protokoll und
 * der gesamte eigene Bereich, also auch der eigene Kalender.
 */

/** Was am Rechner in der Seitenleiste steht — samt ihrer Fusszeile. */
const aufDemRechner = (
  nav: readonly NavGroup[],
  footer: readonly NavTarget[],
): ReadonlySet<string> =>
  new Set([...navItems(nav), ...footer].map((target) => target.href));

/**
 * Was am Telefon erreichbar ist: das Menue zeigt `nav` und `footer`
 * vollstaendig, die Tab-Leiste daneben ihre Auswahl.
 */
const aufDemTelefon = (
  nav: readonly NavGroup[],
  tabs: readonly NavTarget[] | undefined,
  footer: readonly NavTarget[],
): ReadonlySet<string> =>
  new Set(
    [...navItems(nav), ...footer, ...tabTargets(nav, tabs)].map((target) => target.href),
  );

const rollen = [
  { name: 'Schiedsrichter', nav: REFEREE_NAV, tabs: REFEREE_TABS, footer: FOOTER_NAV },
  { name: 'Admin', nav: ADMIN_NAV, tabs: ADMIN_TABS, footer: FOOTER_NAV },
  { name: 'ohne Anmeldung', nav: PUBLIC_NAV, tabs: PUBLIC_TABS, footer: FOOTER_NAV },
] as const;

describe('Telefon und Rechner erreichen dieselben Ziele', () => {
  for (const rolle of rollen) {
    it(`${rolle.name}: kein Ziel fehlt am Telefon`, () => {
      const rechner = aufDemRechner(rolle.nav, rolle.footer);
      const telefon = aufDemTelefon(rolle.nav, rolle.tabs, rolle.footer);
      const fehlt = [...rechner].filter((href) => !telefon.has(href));
      expect(fehlt).toEqual([]);
    });

    it(`${rolle.name}: die Tab-Leiste erfindet kein eigenes Ziel`, () => {
      /*
       * Andersherum genauso: ein Tab, den die Seitenleiste nicht kennt, waere
       * ein Ziel, das nur am Telefon existiert. Auch das ist ein Bruch — nur
       * in die andere Richtung.
       */
      const rechner = aufDemRechner(rolle.nav, rolle.footer);
      const nurAmTelefon = rolle.tabs.filter((tab) => !rechner.has(tab.href));
      expect(nurAmTelefon.map((t) => t.href)).toEqual([]);
    });
  }
});

describe('Die Navigation des Adminbereichs', () => {
  it('fuehrt in den eigenen Bereich — ein Admin ist auch Schiedsrichter', () => {
    const ziele = navItems(ADMIN_NAV).map((target) => target.href);
    expect(ziele).toEqual(expect.arrayContaining(['/spiele', '/kalender', '/profil']));
  });

  it('haelt jedes Verwaltungsziel bereit', () => {
    const ziele = navItems(ADMIN_NAV).map((target) => target.href);
    expect(ziele).toEqual(
      expect.arrayContaining([
        '/',
        '/uebersicht',
        '/meldungen',
        '/anlegen',
        '/schiris',
        '/nachrichten',
        '/einstellungen',
      ]),
    );
  });

  it('nennt kein Ziel zweimal', () => {
    const ziele = navItems(ADMIN_NAV).map((target) => target.href);
    expect(new Set(ziele).size).toBe(ziele.length);
  });
});

describe('Die Navigation der Schiedsrichter', () => {
  it('enthaelt den eigenen Bereich und die oeffentliche Ansicht', () => {
    expect(navItems(REFEREE_NAV).map((t) => t.href)).toEqual([
      '/',
      '/spiele',
      '/kalender',
      '/profil',
    ]);
  });

  it('nennt die Startseite Spielübersicht — angemeldet ist sie keine oeffentliche Ansicht', () => {
    /*
     * Fuer einen angemeldeten Schiedsrichter zeigt `/` die Spiele mit vollen
     * Namen. "Öffentliche Ansicht" stuende dann ueber einer Seite, die gerade
     * nicht zeigt, was die Oeffentlichkeit sieht.
     */
    expect(navItems(REFEREE_NAV).find((t) => t.href === '/')?.label).toBe('Spielübersicht');
    /* Der Admin sieht unter `/` weiterhin die oeffentliche Ansicht. */
    expect(navItems(ADMIN_NAV).find((t) => t.href === '/')?.label).toBe('Öffentliche Ansicht');
    expect(navItems(PUBLIC_NAV).find((t) => t.href === '/')?.label).toBe('Öffentliche Ansicht');
  });

  it('zeigt keinen Verwaltungsweg', () => {
    const ziele = navItems(REFEREE_NAV).map((t) => t.href);
    for (const verwaltung of ['/uebersicht', '/schiris', '/einstellungen', '/nachrichten']) {
      expect(ziele).not.toContain(verwaltung);
    }
  });
});

describe('Welche Navigation zu welcher Rolle gehoert', () => {
  it('gibt dem Admin die Admin-Navigation, auch auf den geteilten Seiten', () => {
    expect(navFor('admin').nav).toBe(ADMIN_NAV);
    expect(navFor('referee').nav).toBe(REFEREE_NAV);
  });

  it('faellt ohne Anmeldung auf die oeffentliche Navigation zurueck', () => {
    expect(navForViewer(null).nav).toBe(PUBLIC_NAV);
    expect(navForViewer(undefined).nav).toBe(PUBLIC_NAV);
    expect(navForViewer({ role: 'admin' }).nav).toBe(ADMIN_NAV);
  });
});
