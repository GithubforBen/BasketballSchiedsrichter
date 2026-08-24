import { afterEach, describe, expect, it, vi } from 'vitest';
import { logEvent, logFailure } from './log';

/**
 * Die Zusicherung: im Protokoll steht nichts, was zu einer Person fuehrt.
 *
 * Sie steht und faellt damit, dass der Fehlertext nicht uebernommen wird — er
 * ist die Stelle, an der eine Telefonnummer aus einer Datenbankabfrage ins
 * Protokoll rutschen wuerde, ohne dass es jemandem auffaellt.
 */

const captured = (run: () => void): string => {
  const lines: string[] = [];
  const log = vi.spyOn(console, 'log').mockImplementation((line: unknown) => {
    lines.push(String(line));
  });
  const error = vi.spyOn(console, 'error').mockImplementation((line: unknown) => {
    lines.push(String(line));
  });
  run();
  log.mockRestore();
  error.mockRestore();
  return lines.join('\n');
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Ein Vorgang landet mit seinen Zahlen im Protokoll', () => {
  it('schreibt Name des Vorgangs und Felder', () => {
    const line = captured(() => {
      logEvent('cron.lauf', { angelegt: 3, zugestellt: 3 });
    });
    expect(line).toContain('cron.lauf');
    expect(line).toContain('angelegt=3');
    expect(line).toContain('zugestellt=3');
  });

  it('setzt einen Zeitstempel davor, damit die Reihenfolge nachvollziehbar bleibt', () => {
    const line = captured(() => {
      logEvent('cron.lauf');
    });
    expect(line).toMatch(/^\[\d{4}-\d{2}-\d{2}T/);
  });
});

describe('Ein Fehler landet ohne seine Meldung im Protokoll', () => {
  it('uebernimmt die Fehlerart, nicht den Text', () => {
    const line = captured(() => {
      logFailure('outbox.versand', new TypeError('Zustellung an +49 151 23456789 gescheitert'));
    });
    expect(line).toContain('fehlerart=TypeError');
    expect(line).not.toContain('23456789');
    expect(line).not.toContain('Zustellung an');
  });

  it('laesst auch einen geworfenen Text nicht durch', () => {
    const line = captured(() => {
      logFailure('outbox.versand', 'Jonas Keller ist nicht erreichbar');
    });
    expect(line).not.toContain('Jonas Keller');
    expect(line).toContain('fehlerart=string');
  });

  it('behaelt die Felder, die zum Einordnen noetig sind', () => {
    const line = captured(() => {
      logFailure('outbox.versand', new Error('egal'), { art: 'personal-reminder', versuche: 2 });
    });
    expect(line).toContain('art=personal-reminder');
    expect(line).toContain('versuche=2');
  });
});
