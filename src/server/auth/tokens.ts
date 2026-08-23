import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * Anmeldung ohne Passwort. Regel: der Link zum Antippen und der Code zum
 * Eintippen gehoeren zusammen und stecken in derselben Nachricht.
 *
 * In der Datenbank liegen nur Ableitungen (HMAC mit dem Serverschluessel), nie
 * der Klartext. Wer die Datenbank liest, kann sich damit nicht anmelden.
 */

/** Wie lange Link und Code gelten. */
export const TOKEN_LIFETIME_MINUTES = 15;

/** Nach so vielen Fehlversuchen ist der Code verbrannt. */
export const MAX_CODE_ATTEMPTS = 5;

export const CODE_LENGTH = 6;

export interface IssuedToken {
  /** Kommt in den Link. Nur in der Nachricht, nie in der Datenbank. */
  linkToken: string;
  /** Sechsstellig, zum Eintippen. Nur in der Nachricht. */
  code: string;
  linkTokenHash: string;
  codeHash: string;
  expiresAt: Date;
}

export const issueToken = (secret: string, now: Date): IssuedToken => {
  const linkToken = randomBytes(32).toString('base64url');
  const code = randomCode();
  return {
    linkToken,
    code,
    linkTokenHash: hash(linkToken, secret),
    codeHash: hash(code, secret),
    expiresAt: new Date(now.getTime() + TOKEN_LIFETIME_MINUTES * 60 * 1000),
  };
};

/**
 * Sechs Ziffern aus einer gleichverteilten Quelle.
 * `randomInt` vermeidet die Schieflage, die `random() % 10` erzeugen wuerde.
 */
export const randomCode = (): string =>
  Array.from({ length: CODE_LENGTH }, () => randomInt(0, 10)).join('');

export const hash = (value: string, secret: string): string =>
  createHmac('sha256', secret).update(value).digest('base64url');

/** Vergleich ohne Laufzeitunterschied. */
export const matchesHash = (value: string, expectedHash: string, secret: string): boolean => {
  const actual = Buffer.from(hash(value, secret));
  const expected = Buffer.from(expectedHash);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
};

export type TokenCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: TokenFailure; readonly message: string };

export type TokenFailure = 'expired' | 'used' | 'too-many-attempts' | 'mismatch';

export interface StoredToken {
  linkTokenHash: string;
  codeHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  attempts: number;
}

/**
 * Prueft Link oder Code gegen den gespeicherten Datensatz.
 *
 * Nach aussen sagen alle Fehlschlaege im Kern dasselbe: der Zugang gilt nicht
 * mehr. Die Unterscheidung dient nur der Anzeige eines hilfreichen naechsten
 * Schritts, nicht dazu, einem Angreifer zu verraten, wie nah er war.
 */
export const checkToken = (
  stored: StoredToken,
  presented: { readonly kind: 'link' | 'code'; readonly value: string },
  secret: string,
  now: Date,
): TokenCheck => {
  if (stored.usedAt !== null) {
    return {
      ok: false,
      reason: 'used',
      message: 'Dieser Anmeldelink wurde bereits benutzt. Fordere einen neuen an.',
    };
  }
  if (stored.expiresAt.getTime() <= now.getTime()) {
    return {
      ok: false,
      reason: 'expired',
      message: `Der Anmeldelink gilt nur ${TOKEN_LIFETIME_MINUTES} Minuten. Fordere einen neuen an.`,
    };
  }
  if (stored.attempts >= MAX_CODE_ATTEMPTS) {
    return {
      ok: false,
      reason: 'too-many-attempts',
      message: 'Zu viele Fehlversuche. Fordere einen neuen Code an.',
    };
  }

  const expected = presented.kind === 'link' ? stored.linkTokenHash : stored.codeHash;
  if (!matchesHash(presented.value, expected, secret)) {
    return {
      ok: false,
      reason: 'mismatch',
      message:
        presented.kind === 'code'
          ? 'Der Code stimmt nicht. Prüfe die Nachricht noch einmal.'
          : 'Dieser Anmeldelink gilt nicht.',
    };
  }
  return { ok: true };
};

/** Der Link, der in die Nachricht kommt. */
export const loginLink = (baseUrl: string, token: string): string =>
  `${baseUrl.replace(/\/$/, '')}/anmelden/link?token=${encodeURIComponent(token)}`;
