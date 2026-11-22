import { calendarDay } from './time';

/** Zeitraum als Kalendertage `YYYY-MM-DD`, beide Grenzen einschliesslich. */
export interface ReceiptPeriod {
  von: string;
  bis: string;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** Der letzte volle Kalendermonat in der Vereinszeitzone, auch im Januar. */
export const defaultReceiptPeriod = (now: Date, timeZone: string): ReceiptPeriod => {
  const [year = 0, month = 1] = calendarDay(now, timeZone).split('-').map(Number);
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const lastDay = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
  return {
    von: `${prevYear}-${pad(prevMonth)}-01`,
    bis: `${prevYear}-${pad(prevMonth)}-${pad(lastDay)}`,
  };
};

const isRealDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
};

export type PeriodCheck = { ok: true; period: ReceiptPeriod } | { ok: false; message: string };

export const validateReceiptPeriod = (von: string | null, bis: string | null): PeriodCheck => {
  if (!von || !bis || !isRealDate(von) || !isRealDate(bis))
    return { ok: false, message: 'Bitte Start- und Enddatum angeben.' };
  if (von > bis)
    return { ok: false, message: 'Das Startdatum liegt nach dem Enddatum.' };
  return { ok: true, period: { von, bis } };
};
