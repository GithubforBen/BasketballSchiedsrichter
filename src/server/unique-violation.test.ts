import { describe, expect, it } from 'vitest';
import { isUniqueViolation } from './assignments';

/**
 * Die Erkennung der Eindeutigkeitsverletzung ist der Unterschied zwischen
 * „jemand war schneller“ und einer Fehlerseite. Sie wird hier ohne Datenbank
 * festgehalten, damit die Ursachenkette nicht versehentlich wieder verloren geht.
 */
describe('Eindeutigkeitsverletzung erkennen', () => {
  it('erkennt den Fehler unmittelbar', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
  });

  it('erkennt ihn auch eingewickelt, so wie ihn eine Transaktion liefert', () => {
    const inner = Object.assign(new Error('duplicate key'), { code: '23505' });
    const outer = new Error('transaction failed', { cause: inner });
    expect(isUniqueViolation(outer)).toBe(true);
  });

  it('erkennt ihn durch mehrere Ebenen hindurch', () => {
    const inner = Object.assign(new Error('duplicate key'), { code: '23505' });
    const wrapped = new Error('a', { cause: new Error('b', { cause: inner }) });
    expect(isUniqueViolation(wrapped)).toBe(true);
  });

  it('verwechselt ihn nicht mit anderen Fehlern', () => {
    expect(isUniqueViolation(new Error('irgendwas'))).toBe(false);
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation('23505')).toBe(false);
  });

  it('läuft sich an einer ringförmigen Ursachenkette nicht fest', () => {
    const loop: { cause?: unknown } = {};
    loop.cause = loop;
    expect(isUniqueViolation(loop)).toBe(false);
  });
});
