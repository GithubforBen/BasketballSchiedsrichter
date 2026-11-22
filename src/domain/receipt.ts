/**
 * Betraege der Schiri-Quittung als reine Funktion.
 * Alle Geldwerte sind ganze Cent; Text entsteht erst am Ende.
 */

export type TravelMode = 'alone' | 'with_passenger' | 'rode_along';

export interface ReceiptExpenses {
  travelMode: TravelMode | null;
  km: number | null;
  perDiemCents: number | null;
  otherCents: number | null;
  otherLabel: string | null;
}

export interface ReceiptRefereeInput {
  name: string;
  expenses: ReceiptExpenses | null;
}

/** Cent pro Kilometer, zum Anpfiff gueltig. */
export interface KmRates {
  soloCents: number;
  sharedCents: number;
}

export interface ReceiptGame {
  leagueLabel: string;
  home: string;
  away: string;
  kickoff: Date;
  venue: string;
}

export interface ReceiptColumn {
  name: string | null;
  km: string | null;
  travel: string | null;
  fee: string | null;
  perDiem: string | null;
  otherLabel: string | null;
  other: string | null;
  total: string | null;
}

export interface ReceiptView {
  game: ReceiptGame;
  columns: [ReceiptColumn, ReceiptColumn];
  overallTotal: string | null;
}

/** Deutsche Schreibweise ohne Waehrungszeichen: 800 -> "8,00", 123456 -> "1234,56". */
export const formatEuro = (cents: number): string => {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
};

const blankColumn = (): ReceiptColumn => ({
  name: null,
  km: null,
  travel: null,
  fee: null,
  perDiem: null,
  otherLabel: null,
  other: null,
  total: null,
});

const optional = (cents: number | null | undefined): string | null =>
  cents == null ? null : formatEuro(cents);

/** Fahrtkosten in Cent, oder null, wenn nichts bekannt ist. */
const travelCents = (e: ReceiptExpenses, rates: KmRates): number | null => {
  if (e.travelMode === 'rode_along') return 0;
  if (e.km == null || e.travelMode == null) return null;
  const rate = e.travelMode === 'alone' ? rates.soloCents : rates.sharedCents;
  return e.km * rate;
};

const buildColumn = (
  input: ReceiptRefereeInput,
  rates: KmRates,
  feeCents: number | null,
): { column: ReceiptColumn; totalCents: number } => {
  const e = input.expenses;
  const travel = e ? travelCents(e, rates) : null;
  const totalCents = (feeCents ?? 0) + (travel ?? 0) + (e?.perDiemCents ?? 0) + (e?.otherCents ?? 0);
  const showKm = e != null && e.travelMode !== 'rode_along' && e.km != null;
  return {
    totalCents,
    column: {
      name: input.name,
      km: showKm ? String(e.km) : null,
      travel: optional(travel),
      fee: optional(feeCents),
      perDiem: optional(e?.perDiemCents),
      otherLabel: e?.otherCents != null ? e.otherLabel?.trim() || null : null,
      other: optional(e?.otherCents),
      total: formatEuro(totalCents),
    },
  };
};

export const buildReceiptView = (
  game: ReceiptGame,
  referees: [ReceiptRefereeInput | null, ReceiptRefereeInput | null],
  rates: KmRates,
  feeCents: number | null,
): ReceiptView => {
  const built = referees.map((r) => (r ? buildColumn(r, rates, feeCents) : null));
  const present = built.filter((b) => b != null);
  return {
    game,
    columns: [built[0]?.column ?? blankColumn(), built[1]?.column ?? blankColumn()],
    overallTotal:
      present.length === 0 ? null : formatEuro(present.reduce((s, b) => s + b.totalCents, 0)),
  };
};
