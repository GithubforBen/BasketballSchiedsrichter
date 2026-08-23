import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq, sql as raw } from 'drizzle-orm';
import { db, schema } from '@/db';
import { activeChannel } from '@/notifications/channel';
import { loginMessage } from '@/notifications/templates';
import { env } from '../env';
import {
  evaluateRateLimit,
  LOGIN_PER_IP,
  LOGIN_PER_PHONE,
  rateLimitKey,
  windowStart,
  type RateLimitRule,
} from '../rate-limit';
import { maskPhone, normalisePhone } from './phone';
import { checkToken, issueToken, loginLink, MAX_CODE_ATTEMPTS, type StoredToken } from './tokens';

/**
 * Der Anmeldevorgang.
 *
 * Zwei Wege aus derselben Nachricht: ein Link zum Antippen und ein Code zum
 * Eintippen. Beide zeigen auf denselben Datensatz und verbrauchen ihn.
 */

export interface RequestResult {
  /** Immer wahr, sobald die Eingabe formal in Ordnung war. */
  accepted: boolean;
  /** Text fuer den Nutzer. */
  message: string;
  /** Id des Datensatzes — nur gesetzt, wenn tatsaechlich etwas verschickt wurde. */
  tokenId?: string;
}

/**
 * Fordert einen Zugang an.
 *
 * Wichtig: ob es die Nummer gibt, verraet die Antwort nicht. Sonst waere die
 * Anmeldeseite ein Verzeichnis, mit dem sich pruefen laesst, wer im Verein
 * pfeift. Unbekannte Nummern durchlaufen denselben Ablauf, nur ohne Versand.
 */
export const requestLogin = async (
  input: { phone: string; ip: string },
  now: Date = new Date(),
): Promise<RequestResult> => {
  const parsed = normalisePhone(input.phone);
  if (!parsed.ok) {
    return { accepted: false, message: parsed.message };
  }

  const ipLimit = await consume(rateLimitKey('ip', input.ip), LOGIN_PER_IP, now);
  if (!ipLimit.allowed) return { accepted: false, message: ipLimit.message };

  const phoneLimit = await consume(rateLimitKey('phone', parsed.phone), LOGIN_PER_PHONE, now);
  if (!phoneLimit.allowed) return { accepted: false, message: phoneLimit.message };

  const confirmation = {
    accepted: true,
    message: `Wenn ${maskPhone(parsed.phone)} bei uns hinterlegt ist, ist die Nachricht unterwegs.`,
  };

  const rows = await db
    .select({
      id: schema.referees.id,
      name: schema.referees.name,
      phone: schema.referees.phone,
      active: schema.referees.active,
    })
    .from(schema.referees)
    .where(eq(schema.referees.phone, parsed.phone))
    .limit(1);

  const referee = rows[0];
  if (!referee || !referee.active) return confirmation;

  const issued = issueToken(env.sessionSecret, now);
  const tokenId = randomUUID();

  await db.insert(schema.loginTokens).values({
    id: tokenId,
    refereeId: referee.id,
    linkTokenHash: issued.linkTokenHash,
    codeHash: issued.codeHash,
    expiresAt: issued.expiresAt,
  });

  const rendered = loginMessage({
    name: referee.name,
    link: loginLink(env.baseUrl, issued.linkToken),
    code: issued.code,
  });

  const channel = activeChannel();
  const key = `login:${tokenId}`;
  await db.insert(schema.notificationOutbox).values({
    id: randomUUID(),
    key,
    kind: 'login',
    channel: channel.name,
    recipientId: referee.id,
    payload: { subject: rendered.subject, body: rendered.body },
    state: 'queued',
  });

  try {
    await channel.send({
      ...rendered,
      kind: 'login',
      key,
      recipient: { refereeId: referee.id, name: referee.name, phone: referee.phone },
    });
    await markSent(key, referee.id, null);
  } catch (error) {
    await markSent(key, referee.id, error instanceof Error ? error.message : String(error));
  }

  return { ...confirmation, tokenId };
};

const markSent = async (key: string, recipientId: string, failure: string | null): Promise<void> => {
  await db
    .update(schema.notificationOutbox)
    .set(
      failure === null
        ? { state: 'sent', sentAt: new Date(), attempts: 1 }
        : { state: 'failed', attempts: 1, lastError: failure },
    )
    .where(
      and(
        eq(schema.notificationOutbox.key, key),
        eq(schema.notificationOutbox.recipientId, recipientId),
      ),
    );
};

export type RedeemResult =
  | { readonly ok: true; readonly refereeId: string; readonly role: 'referee' | 'admin'; readonly lastScreen: string | null }
  | { readonly ok: false; readonly message: string };

/** Loest einen Link ein. */
export const redeemLink = (token: string, now: Date = new Date()): Promise<RedeemResult> =>
  redeem({ kind: 'link', value: token }, now);

/** Loest einen Code ein. Der Datensatz wird ueber die Telefonnummer gefunden. */
export const redeemCode = async (
  input: { phone: string; code: string },
  now: Date = new Date(),
): Promise<RedeemResult> => {
  const parsed = normalisePhone(input.phone);
  if (!parsed.ok) return { ok: false, message: parsed.message };
  return redeem({ kind: 'code', value: input.code, phone: parsed.phone }, now);
};

const GENERIC_FAILURE =
  'Dieser Zugang gilt nicht mehr. Fordere über die Anmeldeseite einen neuen an.';

const redeem = async (
  presented:
    | { kind: 'link'; value: string }
    | { kind: 'code'; value: string; phone: string },
  now: Date,
): Promise<RedeemResult> => {
  /*
   * Der jeweils neueste offene Datensatz. Beim Code kann nur ueber die
   * Telefonnummer gesucht werden — sechs Ziffern allein waeren nicht eindeutig
   * und ein Durchprobieren ueber alle Konten hinweg waere sonst moeglich.
   */
  const candidates = await db
    .select({
      token: schema.loginTokens,
      role: schema.referees.role,
      active: schema.referees.active,
      lastScreen: schema.referees.lastScreen,
    })
    .from(schema.loginTokens)
    .innerJoin(schema.referees, eq(schema.referees.id, schema.loginTokens.refereeId))
    .where(
      presented.kind === 'code'
        ? eq(schema.referees.phone, presented.phone)
        : raw`${schema.loginTokens.usedAt} is null`,
    )
    .orderBy(raw`${schema.loginTokens.createdAt} desc`)
    .limit(presented.kind === 'code' ? 1 : 50);

  for (const candidate of candidates) {
    const stored: StoredToken = {
      linkTokenHash: candidate.token.linkTokenHash,
      codeHash: candidate.token.codeHash,
      expiresAt: candidate.token.expiresAt,
      usedAt: candidate.token.usedAt,
      attempts: candidate.token.attempts,
    };
    const check = checkToken(stored, presented, env.sessionSecret, now);

    if (!check.ok) {
      if (check.reason === 'mismatch' && presented.kind === 'code') {
        // Fehlversuche zaehlen nur beim Code — der Link ist nicht zu erraten.
        await db
          .update(schema.loginTokens)
          .set({ attempts: candidate.token.attempts + 1 })
          .where(eq(schema.loginTokens.id, candidate.token.id));
        const left = MAX_CODE_ATTEMPTS - candidate.token.attempts - 1;
        return {
          ok: false,
          message:
            left > 0
              ? `${check.message} Noch ${left} ${left === 1 ? 'Versuch' : 'Versuche'}.`
              : 'Zu viele Fehlversuche. Fordere einen neuen Code an.',
        };
      }
      if (presented.kind === 'code') return { ok: false, message: check.message };
      continue;
    }

    if (!candidate.active) return { ok: false, message: GENERIC_FAILURE };

    /*
     * Einmalverwendung: nur wer die Zeile tatsaechlich von "unbenutzt" auf
     * "benutzt" setzt, bekommt die Sitzung. Zwei gleichzeitige Einloesungen
     * desselben Links koennen so nicht beide gewinnen.
     */
    const claimed = await db
      .update(schema.loginTokens)
      .set({ usedAt: now })
      .where(and(eq(schema.loginTokens.id, candidate.token.id), raw`${schema.loginTokens.usedAt} is null`))
      .returning({ id: schema.loginTokens.id });

    if (claimed.length === 0) return { ok: false, message: GENERIC_FAILURE };

    return {
      ok: true,
      refereeId: candidate.token.refereeId,
      role: candidate.role,
      lastScreen: candidate.lastScreen,
    };
  }

  return { ok: false, message: GENERIC_FAILURE };
};

/** Zaehlt einen Versuch und entscheidet, ob er noch erlaubt ist. */
const consume = async (
  key: string,
  rule: RateLimitRule,
  now: Date,
): Promise<{ allowed: true } | { allowed: false; message: string }> => {
  const start = windowStart(now, rule.windowMs);

  const updated = await db
    .insert(schema.rateLimits)
    .values({ key, windowStart: start, count: 1 })
    .onConflictDoUpdate({
      target: [schema.rateLimits.key, schema.rateLimits.windowStart],
      set: { count: raw`${schema.rateLimits.count} + 1` },
    })
    .returning({ count: schema.rateLimits.count });

  const count = updated[0]?.count ?? 1;
  // Der Zaehler enthaelt diesen Versuch bereits; die Bewertung erwartet den
  // Stand davor.
  const verdict = evaluateRateLimit({ windowStart: start, count: count - 1 }, rule, now);
  return verdict.allowed ? { allowed: true } : { allowed: false, message: verdict.message };
};
