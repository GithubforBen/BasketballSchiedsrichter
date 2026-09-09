import { describe, expect, it } from 'vitest';
import { compareAdminsFirst, compareByName, composeName, surnameOf } from './name';

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

describe('Reihenfolge einer Personenliste', () => {
  const person = (id: string, name: string, firstName: string) => ({ id, name, firstName });
  const order = (list: readonly { id: string; name: string; firstName: string }[]) =>
    [...list].sort(compareByName).map((p) => p.name);

  it('ordnet nach dem Nachnamen und nicht nach dem vollen Namen', () => {
    // Nach dem vollen Namen stünde Anna vorn — sie heißt aber Zwingli.
    expect(
      order([
        person('1', 'Anna Zwingli', 'Anna'),
        person('2', 'Zacharias Auer', 'Zacharias'),
      ]),
    ).toEqual(['Zacharias Auer', 'Anna Zwingli']);
  });

  it('entscheidet bei gleichem Nachnamen über den Vornamen', () => {
    expect(
      order([
        person('1', 'Linda Schnorrenberger', 'Linda'),
        person('2', 'Ben Schnorrenberger', 'Ben'),
      ]),
    ).toEqual(['Ben Schnorrenberger', 'Linda Schnorrenberger']);
  });

  /*
   * Der Fall aus der importierten Vereinsliste: in `name` steht nur der
   * Nachname. Auch dann muss die Liste an derselben Stelle einsortieren.
   */
  it('kommt mit Zeilen zurecht, in denen nur der Nachname steht', () => {
    expect(
      order([
        person('1', 'Zwingli', 'Anna'),
        person('2', 'Auer', 'Zacharias'),
      ]),
    ).toEqual(['Auer', 'Zwingli']);
  });

  it('sortiert Umlaute wie im Telefonbuch', () => {
    expect(
      order([
        person('1', 'Bea Auer', 'Bea'),
        person('2', 'Cem Ätzel', 'Cem'),
        person('3', 'Dora Atzel', 'Dora'),
      ]),
    ).toEqual(['Dora Atzel', 'Cem Ätzel', 'Bea Auer']);
  });

  /*
   * Zwei Menschen dürfen denselben Namen tragen. Ohne den letzten Vergleich
   * stünde ihre Reihenfolge nicht fest, und die Liste sprang zwischen zwei
   * Aufrufen um — genau das, was die Sortierung verhindern soll.
   */
  it('steht auch bei gleichem Namen still', () => {
    const a = person('r-2', 'Jan Meier', 'Jan');
    const b = person('r-1', 'Jan Meier', 'Jan');
    expect([...[a, b]].sort(compareByName).map((p) => p.id)).toEqual(['r-1', 'r-2']);
    expect([...[b, a]].sort(compareByName).map((p) => p.id)).toEqual(['r-1', 'r-2']);
  });
});

describe('Reihenfolge der Verwaltungsliste', () => {
  const person = (id: string, name: string, firstName: string, role: 'referee' | 'admin') => ({
    id,
    name,
    firstName,
    role,
  });

  it('stellt Admins voran und bleibt innerhalb beider Gruppen alphabetisch', () => {
    const list = [
      person('1', 'Anna Auer', 'Anna', 'referee'),
      person('2', 'Zacharias Zwingli', 'Zacharias', 'admin'),
      person('3', 'Bea Berger', 'Bea', 'referee'),
      person('4', 'Cem Cetin', 'Cem', 'admin'),
    ];
    expect([...list].sort(compareAdminsFirst).map((p) => p.name)).toEqual([
      'Cem Cetin',
      'Zacharias Zwingli',
      'Anna Auer',
      'Bea Berger',
    ]);
  });
});
