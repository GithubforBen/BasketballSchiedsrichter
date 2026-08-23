/**
 * Rate-Limits fuer die Anmeldung.
 *
 * Zwei Grenzen greifen zugleich: eine pro Telefonnummer, damit niemand eine
 * fremde Nummer mit Nachrichten zumuellen kann (jede kostet Geld — Regel 33),
 * und eine pro IP, damit niemand reihenweise Nummern durchprobiert.
 *
 * Feste Zeitfenster statt gleitender: sie sind ohne Verlaufsdaten auszurechnen,
 * verstaendlich zu erklaeren ("in 4 Minuten wieder") und fuer diesen Zweck
 * genau genug.
 */

export interface RateLimitRule {
  /** Wie viele Versuche das Fenster erlaubt. */
  limit: number;
  windowMs: number;
  /** Fuer die Meldung an den Nutzer. */
  subject: string;
}

const MINUTE = 60 * 1000;

export const LOGIN_PER_PHONE: RateLimitRule = {
  limit: 3,
  windowMs: 15 * MINUTE,
  subject: 'diese Telefonnummer',
};

export const LOGIN_PER_IP: RateLimitRule = {
  limit: 20,
  windowMs: 15 * MINUTE,
  subject: 'diesen Anschluss',
};

/** Beginn des Fensters, in das `now` faellt. */
export const windowStart = (now: Date, windowMs: number): Date =>
  new Date(Math.floor(now.getTime() / windowMs) * windowMs);

export interface RateLimitState {
  windowStart: Date;
  count: number;
}

export type RateLimitVerdict =
  | { readonly allowed: true; readonly remaining: number }
  | { readonly allowed: false; readonly retryAfterMs: number; readonly message: string };

/**
 * Entscheidet ueber einen weiteren Versuch. `state` ist der gespeicherte Zaehler
 * oder null, wenn es fuer dieses Fenster noch keinen gibt.
 */
export const evaluateRateLimit = (
  state: RateLimitState | null,
  rule: RateLimitRule,
  now: Date,
): RateLimitVerdict => {
  const start = windowStart(now, rule.windowMs);
  const count = state && state.windowStart.getTime() === start.getTime() ? state.count : 0;

  if (count >= rule.limit) {
    const retryAfterMs = start.getTime() + rule.windowMs - now.getTime();
    return {
      allowed: false,
      retryAfterMs,
      message: `Für ${rule.subject} wurden gerade schon ${rule.limit} Anmeldungen angefordert. Bitte ${describeWait(retryAfterMs)} erneut versuchen.`,
    };
  }
  return { allowed: true, remaining: rule.limit - count - 1 };
};

const describeWait = (ms: number): string => {
  const minutes = Math.ceil(ms / MINUTE);
  return minutes <= 1 ? 'in einer Minute' : `in ${minutes} Minuten`;
};

export const rateLimitKey = (scope: 'phone' | 'ip', value: string): string => `login:${scope}:${value}`;
