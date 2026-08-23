import { describe, expect, it } from 'vitest';
import { absoluteUrl, pathWithQuery } from './http';

const BASE = 'https://schiriplan.example';

describe('Weiterleitungsziele', () => {
  it('löst gegen die öffentliche Adresse auf, nicht gegen die Bindeadresse', () => {
    expect(absoluteUrl('/anmelden', BASE)).toBe('https://schiriplan.example/anmelden');
  });

  it('nennt nie die Bindeadresse — sonst ginge das Sitzungscookie verloren', () => {
    const url = absoluteUrl('/', BASE);
    expect(url).not.toContain('0.0.0.0');
    expect(url.startsWith(BASE)).toBe(true);
  });

  it('lehnt ein Ziel außerhalb der Anwendung ab', () => {
    // Ohne diese Sperre wäre ein Parameter eine Weiterleitung nach außen.
    expect(() => absoluteUrl('https://example.org/', BASE)).toThrow(/eigener Pfad/);
    expect(() => absoluteUrl('//example.org/', BASE)).toThrow(/eigener Pfad/);
    expect(() => absoluteUrl('anmelden', BASE)).toThrow(/eigener Pfad/);
  });

  it('lässt sich nicht über einen Rückwärtspfad hinausschieben', () => {
    expect(absoluteUrl('/../../etc', BASE)).toBe('https://schiriplan.example/etc');
  });

  it('verträgt eine Basisadresse mit Pfadanteil', () => {
    expect(absoluteUrl('/anmelden', 'https://verein.example/schiri')).toBe(
      'https://verein.example/anmelden',
    );
  });

  it('setzt den Abfrageteil zusammen und kodiert ihn', () => {
    expect(pathWithQuery('/anmelden', { fehler: 'Der Code stimmt nicht.' })).toBe(
      '/anmelden?fehler=Der+Code+stimmt+nicht.',
    );
    expect(pathWithQuery('/anmelden', {})).toBe('/anmelden');
  });
});
