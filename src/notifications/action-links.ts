import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NotificationKind } from '@/domain/notifications';
import type { Game } from '@/domain/types';
import { ANSWER_PATH } from '@/routes';

/**
 * Eindeutige Antwortlinks — eine Adresse je Nachricht, Spiel und Person.
 *
 * Eine Bestaetigung muss sagen koennen, *welches* Spiel bestaetigt wurde. Ein
 * Link auf `/kalender` kann das nicht: er fuehrt in eine Liste, und wer dort
 * das falsche Spiel antippt, bestaetigt das falsche Spiel. Deshalb traegt jede
 * Nachricht, die eine Antwort erwartet, ihre eigene Adresse:
 *
 *   https://schiriplan.example.org/antwort/<Token>
 *
 * Im Token stecken Vorgang, Spiel, Person und der Idempotenzschluessel der
 * Nachricht. Er ist signiert (HMAC mit dem Serverschluessel) und laeuft mit dem
 * Anpfiff ab. Damit ist jede Antwort eindeutig genau einem Spiel, genau einer
 * Person und genau einer Nachricht zugeordnet — nachtraeglich nachvollziehbar
 * im Pruefprotokoll.
 *
 * Der Aufbau ist zugleich das, was die WhatsApp Cloud API von einem
 * **dynamischen URL-Knopf** verlangt: dort darf genau eine Variable stehen, und
 * nur **am Ende** der Adresse. Der Token ist deshalb der letzte Pfadabschnitt
 * und kein Abfrageparameter — `https://…/antwort/{{1}}` ist die Vorlage, der
 * Token der Wert.
 */

/**
 * Trennt die Signatur von allem anderen, was mit demselben Schluessel
 * unterschrieben wird. Ohne diese Kennzeichnung waere ein Sitzungs-Cookie ein
 * gueltiger Antwort-Token und umgekehrt.
 */
const DOMAIN = 'antwort.v1';

/** Worauf geantwortet wird. */
export type AnswerKind =
  /** Pflichtbestaetigung. Regeln 10-12. */
  | 'confirm'
  /** Nachruecken auf einen frei gewordenen Schiedsrichter-Platz. Regeln 13-14. */
  | 'promotion'
  /** Zusage oder Absage nach einer Verschiebung. Regeln 17-18. */
  | 'relocation';

export interface AnswerClaims {
  kind: AnswerKind;
  gameId: string;
  refereeId: string;
  /**
   * Der Vorgang, auf den sich die Antwort bezieht — in aller Regel der
   * Idempotenzschluessel der Nachricht, bei einer Nachrueck-Anfrage deren Id.
   * Er macht zwei Links derselben Person zum selben Spiel unterscheidbar.
   */
  reference: string;
  /** Ab hier gilt der Link nicht mehr. Ueblicherweise der Anpfiff. */
  expiresAt: Date;
}

type Encoded = {
  k: AnswerKind;
  g: string;
  r: string;
  n: string;
  /** Ablauf in ganzen Sekunden — kuerzer als ein ISO-Zeitstempel. */
  e: number;
};

const base64url = (value: string): string => Buffer.from(value, 'utf8').toString('base64url');

const sign = (payload: string, secret: string): string =>
  createHmac('sha256', secret).update(`${DOMAIN}:${payload}`).digest('base64url');

const ANSWER_KINDS: readonly AnswerKind[] = ['confirm', 'promotion', 'relocation'];

const isAnswerKind = (value: unknown): value is AnswerKind =>
  typeof value === 'string' && (ANSWER_KINDS as readonly string[]).includes(value);

/** Der Token fuer genau diese Antwort. */
export const issueAnswerToken = (claims: AnswerClaims, secret: string): string => {
  const encoded: Encoded = {
    k: claims.kind,
    g: claims.gameId,
    r: claims.refereeId,
    n: claims.reference,
    e: Math.floor(claims.expiresAt.getTime() / 1000),
  };
  const payload = base64url(JSON.stringify(encoded));
  return `${payload}.${sign(payload, secret)}`;
};

export type AnswerTokenCheck =
  | { readonly ok: true; readonly claims: AnswerClaims }
  | { readonly ok: false; readonly reason: AnswerTokenFailure; readonly message: string };

export type AnswerTokenFailure = 'malformed' | 'mismatch' | 'expired';

const reject = (reason: AnswerTokenFailure, message: string): AnswerTokenCheck => ({
  ok: false,
  reason,
  message,
});

/**
 * Prueft einen Token und gibt zurueck, worauf er sich bezieht.
 *
 * Die Signatur wird vor dem Ablauf geprueft: ein gefaelschter Token soll nicht
 * daran erkennbar sein, dass er "abgelaufen" statt "ungueltig" heisst.
 */
export const readAnswerToken = (
  token: string,
  secret: string,
  now: Date,
): AnswerTokenCheck => {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) {
    return reject('malformed', 'Dieser Link ist unvollständig.');
  }

  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return reject('mismatch', 'Dieser Link gilt nicht.');
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return reject('malformed', 'Dieser Link ist unvollständig.');
  }

  if (typeof decoded !== 'object' || decoded === null) {
    return reject('malformed', 'Dieser Link ist unvollständig.');
  }
  const { k, g, r, n, e } = decoded as Partial<Encoded>;
  if (
    !isAnswerKind(k) ||
    typeof g !== 'string' ||
    typeof r !== 'string' ||
    typeof n !== 'string' ||
    typeof e !== 'number' ||
    !Number.isFinite(e)
  ) {
    return reject('malformed', 'Dieser Link ist unvollständig.');
  }

  const expiresAt = new Date(e * 1000);
  if (now.getTime() >= expiresAt.getTime()) {
    return reject('expired', 'Dieser Link gilt nicht mehr — der Anpfiff liegt zurück.');
  }

  return { ok: true, claims: { kind: k, gameId: g, refereeId: r, reference: n, expiresAt } };
};

/** Die vollstaendige Adresse, die in die Nachricht kommt. */
export const answerLink = (baseUrl: string, token: string): string =>
  `${baseUrl.replace(/\/$/, '')}${ANSWER_PATH}/${token}`;

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

export interface AnswerSource {
  gameId: string | null;
  refereeId: string;
  /** Idempotenzschluessel der Nachricht. */
  key: string;
  payload: Readonly<Record<string, unknown>>;
  /** Das frisch gelesene Spiel — es bestimmt den Ablauf des Links. */
  game: Game | null;
}

/**
 * Welche Antwort eine Nachrichtenart erwartet — und damit, ob sie einen
 * eindeutigen Link bekommt.
 *
 * Nachrichten ohne Rueckfrage bekommen keinen: ein Link, der nichts beantwortet,
 * verleitet nur zum Antippen. Ein abgesagtes Spiel ebenso wenig — dort gibt es
 * nichts mehr zu entscheiden.
 */
export const answerClaimsFor = (
  kind: NotificationKind,
  source: AnswerSource,
): AnswerClaims | null => {
  const { game } = source;
  if (!game || source.gameId === null) return null;
  if (game.state === 'cancelled') return null;

  const base = {
    gameId: source.gameId,
    refereeId: source.refereeId,
    expiresAt: game.kickoff,
  };

  switch (kind) {
    case 'confirmation-request':
    case 'confirmation-follow-up':
      return { ...base, kind: 'confirm', reference: source.key };
    case 'promotion-offer': {
      /*
       * Die Anfrage selbst ist der Vorgang: dieselbe Person kann fuer dasselbe
       * Spiel ein zweites Mal gefragt werden, und dann darf die alte Adresse
       * nicht die neue Anfrage beantworten.
       */
      const offerId = text(source.payload['offerId']);
      return { ...base, kind: 'promotion', reference: offerId === '' ? source.key : offerId };
    }
    case 'relocation':
      return { ...base, kind: 'relocation', reference: source.key };
    default:
      return null;
  }
};
