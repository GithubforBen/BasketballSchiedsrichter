import { describe, expect, it } from 'vitest';
import {
  calendarDay,
  startOfLocalDay,
  days,
  describeHours,
  describeHoursDative,
  describeLeadTime,
  hasPassed,
  withinLeadTime,
} from './time';

describe('Fristen sind einschliesslich', () => {
  const now = new Date('2026-08-01T12:00:00Z');

  it('erlaubt exakt an der Frist', () => {
    const target = new Date(now.getTime() + days(21));
    expect(withinLeadTime(target, now, days(21))).toBe(true);
  });

  it('sperrt eine Sekunde spaeter', () => {
    const target = new Date(now.getTime() + days(21) - 1000);
    expect(withinLeadTime(target, now, days(21))).toBe(false);
  });

  it('behandelt den Anpfiff selbst als vergangen', () => {
    expect(hasPassed(now, now)).toBe(true);
    expect(hasPassed(new Date(now.getTime() + 1000), now)).toBe(false);
  });
});

describe('Kalendertag in der Vereinszeitzone', () => {
  it('rechnet Sommerzeit mit', () => {
    expect(calendarDay(new Date('2026-08-01T22:30:00Z'), 'Europe/Berlin')).toBe('2026-08-02');
    expect(calendarDay(new Date('2026-08-01T21:30:00Z'), 'Europe/Berlin')).toBe('2026-08-01');
  });

  it('rechnet Winterzeit mit', () => {
    expect(calendarDay(new Date('2026-01-01T23:30:00Z'), 'Europe/Berlin')).toBe('2026-01-02');
    expect(calendarDay(new Date('2026-01-01T22:30:00Z'), 'Europe/Berlin')).toBe('2026-01-01');
  });
});

describe('Stundenangaben auf Deutsch', () => {
  it('formuliert Stunden, Tage und Mischformen', () => {
    expect(describeHours(1)).toBe('1 Stunde');
    expect(describeHours(3)).toBe('3 Stunden');
    expect(describeHours(24)).toBe('1 Tag');
    expect(describeHours(72)).toBe('3 Tage');
    expect(describeHours(168)).toBe('7 Tage');
    expect(describeHours(26)).toBe('1 Tag 2 Std');
  });

  it('setzt den Dativ, wo die Angabe nach "in" steht', () => {
    expect(describeHoursDative(24)).toBe('1 Tag');
    expect(describeHoursDative(72)).toBe('3 Tagen');
    expect(describeHoursDative(3)).toBe('3 Stunden');
    // Bei der Mischform bleibt "Tage" stehen, weil danach noch "2 Std" folgt.
    expect(describeHoursDative(50)).toBe('2 Tage 2 Std');
  });

  it('beschreibt den Vorlauf bis zum Anpfiff', () => {
    const now = new Date('2026-08-01T12:00:00Z');
    expect(describeLeadTime(new Date('2026-08-08T12:00:00Z'), now)).toBe('in 7 Tagen');
    expect(describeLeadTime(new Date('2026-08-01T12:30:00Z'), now)).toBe(
      'in weniger als einer Stunde',
    );
    expect(describeLeadTime(new Date('2026-08-01T11:00:00Z'), now)).toBe('bereits angepfiffen');
  });
});

describe('Der Tagesbeginn richtet sich nach der Vereinszeit', () => {
  it('liegt in der Sommerzeit zwei Stunden vor Mitternacht UTC', () => {
    expect(startOfLocalDay(new Date('2026-08-23T12:00:00Z'), 'Europe/Berlin').toISOString()).toBe(
      '2026-08-22T22:00:00.000Z',
    );
  });

  it('liegt in der Winterzeit eine Stunde davor', () => {
    expect(startOfLocalDay(new Date('2026-01-10T12:00:00Z'), 'Europe/Berlin').toISOString()).toBe(
      '2026-01-09T23:00:00.000Z',
    );
  });

  it('zaehlt die Stunden vor Mitternacht Ortszeit noch zum laufenden Tag', () => {
    /*
     * 22:30 UTC ist in Berlin bereits der Folgetag, 0:30 Uhr. Wer gegen
     * Mitternacht UTC rechnet, setzt hier einen Tageszaehler zurueck, obwohl
     * der Tag laengst gewechselt hat — oder eben umgekehrt.
     */
    const kurzNachMitternacht = new Date('2026-08-23T22:30:00Z');
    const beginn = startOfLocalDay(kurzNachMitternacht, 'Europe/Berlin');
    expect(beginn.toISOString()).toBe('2026-08-23T22:00:00.000Z');
    expect(beginn.getTime()).toBeLessThan(kurzNachMitternacht.getTime());
  });
});
