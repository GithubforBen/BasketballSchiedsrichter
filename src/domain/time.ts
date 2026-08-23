/**
 * Zeitrechnung fuer Fristen.
 *
 * Alle Fristen sind einschliesslich: "bis 3 Wochen vor Anpfiff" heisst, dass
 * genau 3 Wochen vorher noch erlaubt ist und erst eine Sekunde spaeter nicht
 * mehr. Das Mockup war an dieser Stelle uneinheitlich (Austragen einschliesslich,
 * Ersatz anfordern ausschliesslich); hier ist es bewusst vereinheitlicht.
 */

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

export const hours = (n: number): number => n * HOUR_MS;
export const days = (n: number): number => n * DAY_MS;

/** Millisekunden bis zum Anpfiff. Negativ, wenn der Anpfiff vorbei ist. */
export const msUntil = (target: Date, now: Date): number => target.getTime() - now.getTime();

/** Ob zum Zeitpunkt `now` noch mindestens `windowMs` bis `target` bleiben. */
export const withinLeadTime = (target: Date, now: Date, windowMs: number): boolean =>
  msUntil(target, now) >= windowMs;

export const hasPassed = (target: Date, now: Date): boolean => msUntil(target, now) <= 0;

/**
 * Kalendertag in der Zeitzone des Vereins als `YYYY-MM-DD`.
 * Wird gebraucht, um "ein Spiel pro Tag" zu pruefen (Regel 6) und um Spiele
 * nach Spieltagen zu gruppieren.
 */
export const calendarDay = (date: Date, timeZone: string): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

/**
 * Beschreibt eine Stundenzahl auf Deutsch, so wie im Mockup:
 * 1 -> "1 Stunde", 24 -> "1 Tag", 72 -> "3 Tage", 26 -> "1 Tag 2 Std".
 */
export const describeHours = (h: number): string => formatHours(h, 'nominative');

/**
 * Dieselbe Angabe im Dativ, wie sie nach "in" oder "vor" stehen muss:
 * "in 7 Tagen", "vor 3 Tagen". Nur der Plural von "Tag" aendert sich —
 * "Stunden" und der Singular sind in beiden Faellen gleich.
 */
export const describeHoursDative = (h: number): string => formatHours(h, 'dative');

const formatHours = (h: number, grammaticalCase: 'nominative' | 'dative'): string => {
  if (h < 24) return h === 1 ? '1 Stunde' : `${h} Stunden`;
  const whole = Math.floor(h / 24);
  const rest = h % 24;
  const plural = grammaticalCase === 'dative' ? 'Tagen' : 'Tage';
  const dayPart = whole === 1 ? '1 Tag' : `${whole} ${plural}`;
  return rest === 0 ? dayPart : `${whole === 1 ? '1 Tag' : `${whole} Tage`} ${rest} Std`;
};

/** "in 7 Tagen", "in 5 Stunden", "bereits angepfiffen" — fuer Meldungstexte. */
export const describeLeadTime = (target: Date, now: Date): string => {
  const ms = msUntil(target, now);
  if (ms <= 0) return 'bereits angepfiffen';
  const totalHours = Math.floor(ms / HOUR_MS);
  if (totalHours < 1) return 'in weniger als einer Stunde';
  return `in ${describeHoursDative(totalHours)}`;
};
