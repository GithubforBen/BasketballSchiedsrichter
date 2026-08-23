import { describe, expect, it } from 'vitest';
import { KNOWN_SCREENS, landingScreen } from './landing';

describe('Bildschirm nach dem Login', () => {
  it('öffnet beim ersten Mal Kalender & Verlauf', () => {
    expect(landingScreen(null)).toBe('/kalender');
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
    }
  });
});
