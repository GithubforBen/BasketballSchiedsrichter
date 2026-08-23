import { describe, expect, it } from 'vitest';
import { slotsFrom } from './__fixtures__/build';
import { gameStatus, occupancyLabel } from './status';

describe('Statusampel', () => {
  it('meldet "offen", solange kein Schiedsrichter eingetragen ist', () => {
    expect(gameStatus(slotsFrom([null, null, null, null])).status).toBe('open');
    expect(gameStatus(slotsFrom([null, null, 'c', 'd'])).status).toBe('open');
  });

  it('meldet "Schiri fehlt" bei genau einem Schiedsrichter', () => {
    const view = gameStatus(slotsFrom(['a', null, 'c', 'd']));
    expect(view.status).toBe('refereeMissing');
    expect(view.label).toBe('Schiri fehlt');
  });

  it('meldet "Ersatz fehlt", wenn beide Schiedsrichter stehen und Ersatz fehlt', () => {
    expect(gameStatus(slotsFrom(['a', 'b', null, null])).status).toBe('substituteMissing');
    expect(gameStatus(slotsFrom(['a', 'b', 'c', null])).status).toBe('substituteMissing');
  });

  it('meldet "besetzt" erst bei allen vier Plaetzen', () => {
    expect(gameStatus(slotsFrom(['a', 'b', 'c', 'd'])).status).toBe('filled');
  });

  it('nimmt die Farbe aus einer Custom Property, nie aus einem Hex-Wert', () => {
    for (const occupants of [
      [null, null, null, null],
      ['a', null, null, null],
      ['a', 'b', null, null],
      ['a', 'b', 'c', 'd'],
    ] as const) {
      expect(gameStatus(slotsFrom(occupants)).colorVar).toMatch(/^var\(--status-[a-z-]+\)$/);
    }
  });

  it('fasst die Besetzung kurz zusammen', () => {
    expect(occupancyLabel(slotsFrom(['a', null, 'c', null]))).toBe('1/2 Schiris · 1/2 Ersatz');
  });
});
