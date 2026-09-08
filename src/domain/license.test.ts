import { describe, expect, it } from 'vitest';
import {
  LICENSES,
  isLicense,
  licenseCovers,
  licenseLabel,
  licenseRequirementLabel,
} from './license';

describe('Die Lizenzstufen', () => {
  it('stehen aufsteigend, die niedrigste zuerst', () => {
    // Die Reihenfolge ist die Anzeigereihenfolge in jedem Auswahlfeld.
    expect(LICENSES).toEqual(['E', 'D', 'C']);
  });

  it('deckt jede Stufe genau sich selbst und alles darunter ab', () => {
    for (const [index, held] of LICENSES.entries()) {
      for (const [required, needed] of LICENSES.entries()) {
        expect(licenseCovers(held, needed)).toBe(index >= required);
      }
    }
  });

  it('erkennt C als gültige Lizenz und alles andere nicht', () => {
    expect(isLicense('C')).toBe(true);
    expect(isLicense('B')).toBe(false);
    expect(isLicense('c')).toBe(false);
    expect(isLicense('')).toBe(false);
  });
});

describe('Beschriftungen', () => {
  it('nennt die Lizenz einer Person, ohne Lizenz ausdrücklich', () => {
    expect(licenseLabel('C')).toBe('Lizenz C');
    expect(licenseLabel(null)).toBe('keine Lizenz');
  });

  it('sagt bei der niedrigsten Stufe, dass jede Lizenz reicht', () => {
    expect(licenseRequirementLabel('E')).toBe('E — jede Lizenz reicht');
  });

  it('sagt „mindestens“ und nicht „nur mit“', () => {
    // Ein D-Spiel darf auch pfeifen, wer C hat — "nur mit D-Lizenz" waere
    // falsch, seit es ueber D noch eine Stufe gibt.
    expect(licenseRequirementLabel('D')).toBe('D — mindestens D-Lizenz');
    expect(licenseRequirementLabel('C')).toBe('C — mindestens C-Lizenz');
  });
});
