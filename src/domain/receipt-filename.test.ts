import { describe, expect, it } from 'vitest';
import { receiptFilename } from './receipt-filename';

const TZ = 'Europe/Berlin';

describe('Dateiname der Quittung', () => {
  it('nutzt Datum und beide Mannschaften als ASCII', () => {
    const game = {
      kickoff: new Date('2026-11-29T14:00:00Z'),
      home: 'SC Bergstraße',
      away: 'TV Ober-Ramstadt',
    };
    expect(receiptFilename(game, TZ)).toBe(
      'quittung-2026-11-29-sc-bergstrasse-tv-ober-ramstadt.pdf',
    );
  });

  it('nimmt den Tag der Vereinszeit', () => {
    const game = {
      kickoff: new Date('2026-11-29T23:30:00Z'),
      home: 'A',
      away: 'B',
    };
    expect(receiptFilename(game, TZ)).toBe('quittung-2026-11-30-a-b.pdf');
  });

  it('setzt Umlaute um und kuerzt lange Namen', () => {
    const game = {
      kickoff: new Date('2026-01-10T12:00:00Z'),
      home: 'Ärzte Öl Üb',
      away: 'x'.repeat(80),
    };
    const name = receiptFilename(game, TZ);
    expect(name).toBe(`quittung-2026-01-10-aerzte-oel-ueb-${'x'.repeat(40)}.pdf`);
    expect(name).toMatch(/^[a-z0-9.-]+$/);
  });
});
