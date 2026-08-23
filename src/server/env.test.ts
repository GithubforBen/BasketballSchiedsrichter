import { afterEach, describe, expect, it } from 'vitest';
import { env } from './env';

/**
 * Die Umgebungspruefungen sind selbst eine Zusicherung: eine fehlende Angabe
 * soll auffallen und nicht stillschweigend durch einen Entwicklungswert
 * ersetzt werden.
 */
const original = { ...process.env };

/**
 * NODE_ENV ist in den Typen als schreibgeschuetzt gefuehrt. Fuer den Test muss
 * es trotzdem umgestellt werden — die Zusicherung lautet ja gerade, dass sich
 * die Anwendung im Echtbetrieb anders verhaelt als in der Entwicklung.
 */
const setNodeEnv = (value: string): void => {
  Object.defineProperty(process.env, 'NODE_ENV', { value, configurable: true });
};

afterEach(() => {
  process.env = { ...original };
});

describe('Öffentliche Adresse', () => {
  it('nimmt den gesetzten Wert und schneidet einen Schrägstrich am Ende ab', () => {
    process.env.PUBLIC_BASE_URL = 'https://schiriplan.example/';
    expect(env.baseUrl).toBe('https://schiriplan.example');
  });

  it('fällt in der Entwicklung auf localhost zurück', () => {
    delete process.env.PUBLIC_BASE_URL;
    setNodeEnv('development');
    expect(env.baseUrl).toBe('http://localhost:3000');
  });

  it('bricht im Echtbetrieb ab, statt still auf localhost zu zeigen', () => {
    delete process.env.PUBLIC_BASE_URL;
    setNodeEnv('production');
    expect(() => env.baseUrl).toThrow(/PUBLIC_BASE_URL/);
  });
});

describe('Sitzungsschlüssel', () => {
  it('verlangt einen Wert', () => {
    delete process.env.SESSION_SECRET;
    expect(() => env.sessionSecret).toThrow(/SESSION_SECRET/);
  });

  it('lehnt den Beispielwert im Echtbetrieb ab', () => {
    process.env.SESSION_SECRET = 'bitte-ersetzen';
    setNodeEnv('production');
    expect(() => env.sessionSecret).toThrow(/Beispielwert/);
  });
});

describe('Versandkanal', () => {
  it('kennt genau drei Kanäle', () => {
    for (const channel of ['dev', 'email', 'whatsapp'] as const) {
      process.env.NOTIFICATION_CHANNEL = channel;
      expect(env.channel).toBe(channel);
    }
  });

  it('lehnt einen unbekannten Kanal ab, statt still nichts zu verschicken', () => {
    process.env.NOTIFICATION_CHANNEL = 'telegramm';
    expect(() => env.channel).toThrow(/dev, email oder whatsapp/);
  });

  it('nimmt ohne Angabe den Kanal, der nichts verschickt', () => {
    delete process.env.NOTIFICATION_CHANNEL;
    expect(env.channel).toBe('dev');
  });
});
