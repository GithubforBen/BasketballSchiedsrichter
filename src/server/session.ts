import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Sitzungen als signiertes Cookie.
 *
 * Der Inhalt ist nicht geheim — nur wer angemeldet ist und in welcher Rolle.
 * Entscheidend ist, dass er nicht faelschbar ist: die Signatur haengt am
 * Serverschluessel, und geprueft wird in konstanter Zeit.
 */

export const SESSION_COOKIE = 'schiriplan_session';
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export interface SessionPayload {
  refereeId: string;
  role: 'referee' | 'admin';
  /** Ablauf als Unix-Sekunden. */
  exp: number;
}

const base64url = (input: Buffer | string): string =>
  Buffer.from(input).toString('base64url');

const sign = (data: string, secret: string): string =>
  createHmac('sha256', secret).update(data).digest('base64url');

export const createSession = (
  payload: Omit<SessionPayload, 'exp'>,
  secret: string,
  now: Date,
): string => {
  const full: SessionPayload = {
    ...payload,
    exp: Math.floor(now.getTime() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const body = base64url(JSON.stringify(full));
  return `${body}.${sign(body, secret)}`;
};

/**
 * Liest ein Cookie zurueck. Gibt null zurueck, sobald irgendetwas nicht stimmt:
 * kaputtes Format, falsche Signatur, abgelaufen. Es gibt bewusst keine
 * Unterscheidung nach aussen — ein Angreifer soll nicht erfahren, woran es lag.
 */
export const readSession = (
  cookie: string | undefined,
  secret: string,
  now: Date,
): SessionPayload | null => {
  if (!cookie) return null;

  const separator = cookie.lastIndexOf('.');
  if (separator <= 0) return null;

  const body = cookie.slice(0, separator);
  const signature = cookie.slice(separator + 1);

  const expected = sign(body, secret);
  if (!equalsInConstantTime(signature, expected)) return null;

  const payload = parse(body);
  if (!payload) return null;
  if (payload.exp * 1000 <= now.getTime()) return null;
  return payload;
};

const parse = (body: string): SessionPayload | null => {
  let raw: unknown;
  try {
    raw = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.refereeId !== 'string' || candidate.refereeId === '') return null;
  if (candidate.role !== 'referee' && candidate.role !== 'admin') return null;
  if (typeof candidate.exp !== 'number' || !Number.isFinite(candidate.exp)) return null;
  return { refereeId: candidate.refereeId, role: candidate.role, exp: candidate.exp };
};

/** Vergleich ohne Laufzeitunterschied, damit die Signatur nicht erratbar wird. */
export const equalsInConstantTime = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
};

/** Cookie-Einstellungen. `secure` faellt in der Entwicklung weg, sonst nie. */
export const sessionCookieOptions = (secure: boolean) =>
  ({
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  }) satisfies Record<string, unknown>;
