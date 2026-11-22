import { describe, expect, it } from 'vitest';
import {
  buildReceiptView,
  formatEuro,
  type ReceiptExpenses,
  type ReceiptGame,
} from './receipt';

const game: ReceiptGame = {
  leagueLabel: 'U14',
  home: 'SC Bergstrasse',
  away: 'TV Gast',
  kickoff: new Date('2026-10-10T13:00:00Z'),
  venue: 'Sporthalle',
};
const rates = { soloCents: 30, sharedCents: 32 };
const expenses = (e: Partial<ReceiptExpenses>): ReceiptExpenses => ({
  travelMode: null,
  km: null,
  perDiemCents: null,
  otherCents: null,
  otherLabel: null,
  ...e,
});

describe('Quittung: Betraege', () => {
  // spec: schiri-quittung#driver-with-passenger
  it('Fahrer mit Mitfahrer: 25 km zu 0,32 EUR plus Gebuehr', () => {
    const v = buildReceiptView(
      game,
      [{ name: 'A', expenses: expenses({ travelMode: 'with_passenger', km: 25 }) }, null],
      rates,
      2000,
    );
    expect(v.columns[0].travel).toBe('8,00');
    expect(v.columns[0].km).toBe('25');
    expect(v.columns[0].total).toBe('28,00');
  });

  it('Fahrer allein rechnet mit dem Einzelsatz', () => {
    const v = buildReceiptView(
      game,
      [{ name: 'A', expenses: expenses({ travelMode: 'alone', km: 10 }) }, null],
      rates,
      null,
    );
    expect(v.columns[0].travel).toBe('3,00');
    expect(v.columns[0].fee).toBeNull();
  });

  // spec: schiri-quittung#rode-along
  it('Mitgefahren: Fahrtkosten 0,00 ohne Kilometer', () => {
    const v = buildReceiptView(
      game,
      [{ name: 'A', expenses: expenses({ travelMode: 'rode_along', km: 40 }) }, null],
      rates,
      2000,
    );
    expect(v.columns[0].travel).toBe('0,00');
    expect(v.columns[0].km).toBeNull();
    expect(v.columns[0].total).toBe('20,00');
  });

  // spec: schiri-quittung#overall-total
  it('Gesamtsumme addiert beide Schiedsrichter', () => {
    const v = buildReceiptView(
      game,
      [
        { name: 'A', expenses: expenses({ travelMode: 'with_passenger', km: 25 }) },
        { name: 'B', expenses: expenses({ perDiemCents: 600 }) },
      ],
      rates,
      2000,
    );
    expect(v.columns[0].total).toBe('28,00');
    expect(v.columns[1].total).toBe('26,00');
    expect(v.overallTotal).toBe('54,00');
  });

  // spec: schiri-quittung#only-one-referee
  it('Nur ein Schiedsrichter: zweite Spalte ist komplett leer', () => {
    const v = buildReceiptView(game, [{ name: 'A', expenses: null }, null], rates, 2000);
    expect(Object.values(v.columns[1]).every((x) => x === null)).toBe(true);
    expect(v.overallTotal).toBe('20,00');
  });

  it('Ohne Schiedsrichter ist auch die Gesamtsumme leer', () => {
    expect(buildReceiptView(game, [null, null], rates, 2000).overallTotal).toBeNull();
  });

  // spec: schiri-quittung#no-kilometres-entered
  it('Nichts eingetragen: Kilometer und Fahrtkosten leer, Summe nur Gebuehr', () => {
    const v = buildReceiptView(game, [{ name: 'A', expenses: null }, null], rates, 2000);
    expect(v.columns[0].km).toBeNull();
    expect(v.columns[0].travel).toBeNull();
    expect(v.columns[0].total).toBe('20,00');
  });

  it('Tagegeld und Sonstiges zaehlen mit, das Label nur bei Betrag', () => {
    const v = buildReceiptView(
      game,
      [
        {
          name: 'A',
          expenses: expenses({ perDiemCents: 500, otherCents: 250, otherLabel: ' Parken ' }),
        },
        { name: 'B', expenses: expenses({ otherLabel: 'Parken' }) },
      ],
      rates,
      null,
    );
    expect(v.columns[0].perDiem).toBe('5,00');
    expect(v.columns[0].other).toBe('2,50');
    expect(v.columns[0].otherLabel).toBe('Parken');
    expect(v.columns[0].total).toBe('7,50');
    expect(v.columns[1].otherLabel).toBeNull();
  });
});

describe('Euro auf Deutsch', () => {
  it('formatiert mit Komma und zwei Stellen', () => {
    expect(formatEuro(0)).toBe('0,00');
    expect(formatEuro(5)).toBe('0,05');
    expect(formatEuro(800)).toBe('8,00');
    expect(formatEuro(123456)).toBe('1234,56');
  });
});
