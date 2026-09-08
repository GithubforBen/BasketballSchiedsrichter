import { describe, expect, it } from 'vitest';
import { composeName, surnameOf } from './name';

describe('Nachname aus dem vollen Namen', () => {
  it('schneidet den Vornamen ab, wenn er vorn steht', () => {
    expect(surnameOf('Ben Schnorrenberger', 'Ben')).toBe('Schnorrenberger');
  });

  it('lässt den Wert stehen, wenn nur der Nachname darin steht', () => {
    // Der Fall aus der importierten Vereinsliste: Spalte „Name“ trug den
    // Nachnamen, Spalte „Vorname“ den Vornamen.
    expect(surnameOf('Schnorrenberger', 'Linda')).toBe('Schnorrenberger');
  });

  it('schneidet nur ganze Wörter ab', () => {
    expect(surnameOf('Bengt Meier', 'Ben')).toBe('Bengt Meier');
  });

  it('achtet nicht auf Groß- und Kleinschreibung', () => {
    expect(surnameOf('BEN Schnorrenberger', 'ben')).toBe('Schnorrenberger');
  });

  it('lässt nichts übrig, wenn beide Felder dasselbe sagen', () => {
    expect(surnameOf('Jan', 'Jan')).toBe('');
  });

  it('kommt ohne Vornamen aus', () => {
    expect(surnameOf('Ben Schnorrenberger', '')).toBe('Ben Schnorrenberger');
  });
});

describe('Voller Name aus beiden Feldern', () => {
  it('setzt Vorname und Nachname zusammen', () => {
    expect(composeName('Linda', 'Schnorrenberger')).toBe('Linda Schnorrenberger');
  });

  it('räumt Leerraum auf', () => {
    expect(composeName('  Linda ', ' Schnorrenberger  ')).toBe('Linda Schnorrenberger');
  });

  it('kommt mit einem leeren Feld aus', () => {
    expect(composeName('', 'Schnorrenberger')).toBe('Schnorrenberger');
    expect(composeName('Linda', '')).toBe('Linda');
  });

  /*
   * Die eigentliche Zusicherung: ein Konto, in dem der volle Name im falschen
   * Feld steht, darf durch blosses Speichern nicht schlechter werden. Sonst
   * waere aus "Jan" + "Jan Schnorrenberger" ein "Jan Schnorrenberger Jan"
   * geworden — und daraus ein Start-Passwort, das niemand erraet.
   */
  it('hängt nicht an, was schon dasteht', () => {
    expect(composeName('Jan Schnorrenberger', 'Jan')).toBe('Jan Schnorrenberger');
    expect(composeName('Ben', 'Ben Schnorrenberger')).toBe('Ben Schnorrenberger');
  });

  it('bleibt beim zweiten Speichern gleich', () => {
    const first = composeName('Jan Schnorrenberger', 'Jan');
    const again = composeName('Jan Schnorrenberger', surnameOf(first, 'Jan Schnorrenberger'));
    expect(again).toBe(first);
  });
});
