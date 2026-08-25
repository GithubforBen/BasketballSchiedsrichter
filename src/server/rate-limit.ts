/**
 * Rate-Limits fuer die Anmeldung.
 *
 * Zwei Grenzen greifen zugleich: eine pro Telefonnummer, damit niemand eine
 * fremde Nummer mit Nachrichten zumuellen kann (jede kostet Geld — Regel 33)
 * und niemand ein Passwort durchprobiert, und eine pro IP, damit niemand
 * reihenweise Nummern abklopft.
 *
 * Feste Zeitfenster statt gleitender: sie sind ohne Verlaufsdaten auszurechnen,
 * verstaendlich zu erklaeren ("in 4 Minuten wieder") und fuer diesen Zweck
 * genau genug.
 */

export interface RateLimitRule {
  /** Wie viele Versuche das Fenster erlaubt. */
  limit: number;
  windowMs: number;
  /**
   * Was zu viel war, fuer die Meldung: "Zu viele __." Ein ganzer Satzteil statt
   * eines Stichworts, weil sich die Regeln sonst nicht unterscheiden liessen —
   * angeforderte Nachrichten und falsch getippte Passwoerter sind zweierlei,
   * und wer ein falsches Passwort eingibt, versteht "zu viele Anmeldungen
   * angefordert" nicht.
   */
  tooMany: string;
}

const MINUTE = 60 * 1000;

export const LOGIN_PER_PHONE: RateLimitRule = {
  limit: 3,
  windowMs: 15 * MINUTE,
  tooMany: 'Anmeldungen für diese Telefonnummer angefordert',
};

/**
 * Fehlversuche beim Passwort, je Telefonnummer. Regeln 34-36.
 *
 * Enger als es fuer getippte Passwoerter bequem waere, und das mit Absicht: das
 * Start-Passwort folgt aus dem Namen und ist damit erratbar. Acht Versuche in
 * einer Viertelstunde reichen fuer jemanden, der sich vertippt, und nicht fuer
 * jemanden, der eine Liste durchgeht.
 */
export const PASSWORD_PER_PHONE: RateLimitRule = {
  limit: 8,
  windowMs: 15 * MINUTE,
  tooMany: 'Fehlversuche für diese Telefonnummer',
};

export const LOGIN_PER_IP: RateLimitRule = {
  limit: 20,
  windowMs: 15 * MINUTE,
  tooMany: 'Anmeldungen von diesem Anschluss',
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
      /*
       * Die Zahl selbst steht bewusst nicht in der Meldung: sie hilft niemandem
       * beim Weiterkommen und sagt einem Angreifer, wie weit er zaehlen darf.
       */
      message: `Zu viele ${rule.tooMany}. Bitte ${describeWait(retryAfterMs)} erneut versuchen.`,
    };
  }
  return { allowed: true, remaining: rule.limit - count - 1 };
};

const describeWait = (ms: number): string => {
  const minutes = Math.ceil(ms / MINUTE);
  return minutes <= 1 ? 'in einer Minute' : `in ${minutes} Minuten`;
};

/**
 * `phone` zaehlt angeforderte Anmeldenachrichten, `pw` die Fehlversuche beim
 * Passwort. Zwei getrennte Zaehler, weil sie verschiedene Grenzen haben und
 * sich sonst gegenseitig aufbrauchen wuerden.
 */
export const rateLimitKey = (scope: 'phone' | 'pw' | 'ip', value: string): string =>
  `login:${scope}:${value}`;
