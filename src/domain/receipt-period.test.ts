import { describe, expect, it } from 'vitest';
import { defaultReceiptPeriod, validateReceiptPeriod } from './receipt-period';

const TZ = 'Europe/Berlin';

describe('Standardzeitraum', () => {
  // spec: schiri-quittung#default-period
  it('ist der letzte volle Monat', () => {
    expect(defaultReceiptPeriod(new Date('2026-11-22T10:00:00Z'), TZ)).toEqual({
      von: '2026-10-01',
      bis: '2026-10-31',
    });
  });

  it('springt im Januar ins Vorjahr', () => {
    expect(defaultReceiptPeriod(new Date('2027-01-15T10:00:00Z'), TZ)).toEqual({
      von: '2026-12-01',
      bis: '2026-12-31',
    });
  });

  it('kennt das Schaltjahr', () => {
    expect(defaultReceiptPeriod(new Date('2028-03-05T10:00:00Z'), TZ).bis).toBe('2028-02-29');
  });

  it('zaehlt den Monat in Berliner Zeit: 31.12. 23:30 UTC ist schon Januar', () => {
    expect(defaultReceiptPeriod(new Date('2026-12-31T23:30:00Z'), TZ)).toEqual({
      von: '2026-12-01',
      bis: '2026-12-31',
    });
  });
});

describe('Zeitraum pruefen', () => {
  it('nimmt einen gueltigen Zeitraum an, auch einen einzelnen Tag', () => {
    expect(validateReceiptPeriod('2026-10-01', '2026-10-31')).toEqual({
      ok: true,
      period: { von: '2026-10-01', bis: '2026-10-31' },
    });
    expect(validateReceiptPeriod('2026-10-05', '2026-10-05').ok).toBe(true);
  });

  // spec: schiri-quittung#invalid-period
  it('lehnt Start nach Ende mit Meldung ab', () => {
    const r = validateReceiptPeriod('2026-10-31', '2026-10-01');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).not.toBe('');
  });

  it('lehnt fehlende und unmoegliche Daten ab', () => {
    expect(validateReceiptPeriod(null, '2026-10-01').ok).toBe(false);
    expect(validateReceiptPeriod('2026-10-01', '').ok).toBe(false);
    expect(validateReceiptPeriod('2026-02-30', '2026-03-01').ok).toBe(false);
    expect(validateReceiptPeriod('abc', '2026-03-01').ok).toBe(false);
  });
});
