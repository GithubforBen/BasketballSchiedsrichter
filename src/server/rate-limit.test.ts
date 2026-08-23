import { describe, expect, it } from 'vitest';
import {
  evaluateRateLimit,
  LOGIN_PER_IP,
  LOGIN_PER_PHONE,
  rateLimitKey,
  windowStart,
  type RateLimitState,
} from './rate-limit';

const NOW = new Date('2026-08-01T12:07:30Z');
const at = (iso: string) => new Date(iso);

describe('Zeitfenster', () => {
  it('rundet auf den Beginn des Fensters ab', () => {
    expect(windowStart(NOW, 15 * 60 * 1000)).toEqual(at('2026-08-01T12:00:00Z'));
    expect(windowStart(at('2026-08-01T12:16:00Z'), 15 * 60 * 1000)).toEqual(
      at('2026-08-01T12:15:00Z'),
    );
  });
});

describe('Anmeldeversuche begrenzen', () => {
  const state = (count: number, start = at('2026-08-01T12:00:00Z')): RateLimitState => ({
    windowStart: start,
    count,
  });

  it('lässt den ersten Versuch durch', () => {
    expect(evaluateRateLimit(null, LOGIN_PER_PHONE, NOW)).toMatchObject({
      allowed: true,
      remaining: 2,
    });
  });

  it('lässt genau so viele Versuche zu wie erlaubt', () => {
    expect(evaluateRateLimit(state(2), LOGIN_PER_PHONE, NOW)).toMatchObject({
      allowed: true,
      remaining: 0,
    });
    expect(evaluateRateLimit(state(3), LOGIN_PER_PHONE, NOW).allowed).toBe(false);
  });

  it('nennt die Wartezeit und begründet die Sperre', () => {
    const verdict = evaluateRateLimit(state(3), LOGIN_PER_PHONE, NOW);
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) {
      // 12:07:30 im Fenster ab 12:00 — bis 12:15 sind es siebeneinhalb Minuten.
      expect(verdict.retryAfterMs).toBe(7.5 * 60 * 1000);
      expect(verdict.message).toContain('in 8 Minuten');
    }
  });

  it('fängt im nächsten Fenster wieder bei null an', () => {
    const old = state(3, at('2026-08-01T11:45:00Z'));
    expect(evaluateRateLimit(old, LOGIN_PER_PHONE, NOW).allowed).toBe(true);
  });

  it('lässt am Anschluss mehr zu als an einer einzelnen Nummer', () => {
    // Ein Verein sitzt oft hinter einem Anschluss; die Nummer schützt die Person,
    // die IP schützt gegen das Durchprobieren vieler Nummern.
    expect(LOGIN_PER_IP.limit).toBeGreaterThan(LOGIN_PER_PHONE.limit);
    expect(evaluateRateLimit(state(5), LOGIN_PER_IP, NOW).allowed).toBe(true);
  });

  it('trennt die Zähler nach Bereich und Wert', () => {
    expect(rateLimitKey('phone', '+4915123456789')).not.toBe(rateLimitKey('ip', '+4915123456789'));
    expect(rateLimitKey('phone', 'a')).not.toBe(rateLimitKey('phone', 'b'));
  });
});
