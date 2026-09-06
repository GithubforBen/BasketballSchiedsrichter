import { describe, expect, it } from 'vitest';
import { KNOWN_SCREENS, landingScreen } from './landing';

describe('Bildschirm nach dem Login', () => {
  it('öffnet beim ersten Mal Kalender & Verlauf', () => {
    expect(landingScreen(null)).toBe('/kalender');
    expect(landingScreen(null, 'referee')).toBe('/kalender');
  });

  it('setzt einen Admin beim ersten Mal in seinen eigenen Bereich', () => {
    // `/kalender` traegt die Navigation der Schiedsrichter: ein Admin saehe
    // dort keinen Weg in die Verwaltung und hielte sich fuer keinen Admin.
    expect(landingScreen(null, 'admin')).toBe('/uebersicht');
  });

  it('öffnet den zuletzt benutzten Bildschirm wieder', () => {
    for (const screen of KNOWN_SCREENS) {
      expect(landingScreen(screen)).toBe(screen);
    }
  });

  it('lässt sich nicht auf ein fremdes Ziel umbiegen', () => {
    // Der gespeicherte Wert kommt aus der Datenbank und wird für eine
    // Weiterleitung benutzt — ungeprüft wäre er ein offenes Ziel.
    for (const evil of ['https://example.org', '//example.org', '/../admin', '/gibtesnicht']) {
      expect(landingScreen(evil)).toBe('/kalender');
      expect(landingScreen(evil, 'admin')).toBe('/uebersicht');
    }
  });
});
