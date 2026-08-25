import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq, isNull, sql as raw } from 'drizzle-orm';
import { db, schema } from '@/db';
import { env } from '../env';
import {
  evaluateRateLimit,
  LOGIN_PER_IP,
  rateLimitKey,
  windowStart,
} from '../rate-limit';
import { burnTime, generateRecoveryToken } from './hash';
import { applyStartPassword } from './password-login';
import { hash } from './tokens';

/**
 * Notzugang fuer ausgesperrte Admins. Regel 41.
 *
 * Der Fall, den das abdeckt: der einzige Admin hat sein Passwort vergessen.
 * Zuruecksetzen kann nur ein Admin — es gibt also niemanden mehr, der
 * hilft, und ohne diesen Weg bliebe nur ein Eingriff in die Datenbank.
 *
 * Der Token wird auf dem Server erzeugt, einmal angezeigt und danach nie
 * wieder: gespeichert ist nur eine Ableitung (Regel 39). Wer ihn ausgibt,
 * schreibt ihn auf und legt ihn dorthin, wo der Vereinsschluessel liegt.
 *
 * Absichtlich **ohne** Frist. Ein Notzugang, der nach ein paar Wochen
 * stillschweigend abgelaufen ist, ist genau dann wertlos, wenn er gebraucht
 * wird. Stattdessen gilt er genau einmal und laesst sich jederzeit widerrufen.
 *
 * Was das Einloesen tut, ist bewusst wenig: es setzt das Passwort auf das
 * Start-Passwort aus dem Namen zurueck — derselbe Weg wie beim Zuruecksetzen
 * durch einen Admin (Regel 40) — und meldet an. Der Zwang aus Regel 37 greift
 * sofort, die Person legt an Ort und Stelle ein eigenes Passwort fest. Es gibt
 * also keinen zweiten Weg, ein Passwort zu setzen, den man absichern muesste.
 */

export interface IssuedRecoveryToken {
  readonly id: string;
  /** Klartext. Existiert genau einmal — hier, im Rueckgabewert. */
  readonly token: string;
}

/** Stellt einen Notzugang aus. Nur fuer aktive Admins. */
export const issueRecoveryToken = async (
  refereeId: string,
  label: string,
  now: Date = new Date(),
): Promise<IssuedRecoveryToken> => {
  const rows = await db
    .select({ role: schema.referees.role, active: schema.referees.active })
    .from(schema.referees)
    .where(eq(schema.referees.id, refereeId))
    .limit(1);

  const referee = rows[0];
  if (!referee) throw new Error('Dieses Konto gibt es nicht.');
  if (referee.role !== 'admin' || !referee.active) {
    throw new Error('Ein Notzugang gilt nur fuer einen aktiven Admin.');
  }

  const token = generateRecoveryToken();
  const id = randomUUID();

  await db.insert(schema.adminRecoveryTokens).values({
    id,
    refereeId,
    tokenHash: hash(token, env.sessionSecret),
    label,
    createdAt: now,
  });

  await db.insert(schema.auditLog).values({
    id: randomUUID(),
    actorId: refereeId,
    action: 'recovery.issue',
    subjectId: refereeId,
    // Regel 39: die Notiz steht hier, der Token nie.
    detail: { tokenId: id, label },
  });

  return { id, token };
};

export interface RecoveryEntry {
  readonly id: string;
  readonly refereeId: string;
  readonly name: string;
  readonly label: string;
  readonly createdAt: Date;
  readonly usedAt: Date | null;
  readonly revokedAt: Date | null;
}

/** Alle ausgestellten Notzugaenge — ohne Hashes, nur der Zustand. */
export const listRecoveryTokens = async (): Promise<readonly RecoveryEntry[]> =>
  db
    .select({
      id: schema.adminRecoveryTokens.id,
      refereeId: schema.adminRecoveryTokens.refereeId,
      name: schema.referees.name,
      label: schema.adminRecoveryTokens.label,
      createdAt: schema.adminRecoveryTokens.createdAt,
      usedAt: schema.adminRecoveryTokens.usedAt,
      revokedAt: schema.adminRecoveryTokens.revokedAt,
    })
    .from(schema.adminRecoveryTokens)
    .innerJoin(schema.referees, eq(schema.referees.id, schema.adminRecoveryTokens.refereeId))
    .orderBy(raw`${schema.adminRecoveryTokens.createdAt} desc`);

/** Widerruft einen Notzugang. Der Token gilt danach nicht mehr. */
export const revokeRecoveryToken = async (
  id: string,
  now: Date = new Date(),
): Promise<boolean> => {
  const updated = await db
    .update(schema.adminRecoveryTokens)
    .set({ revokedAt: now })
    .where(and(eq(schema.adminRecoveryTokens.id, id), isNull(schema.adminRecoveryTokens.revokedAt)))
    .returning({ id: schema.adminRecoveryTokens.id });
  return updated.length > 0;
};

export type RecoveryOutcome =
  | {
      readonly ok: true;
      readonly refereeId: string;
      readonly role: 'referee' | 'admin';
      readonly name: string;
      /** Das Start-Passwort, mit dem gleich das eigene gesetzt wird. */
      readonly startPassword: string;
    }
  | { readonly ok: false; readonly message: string };

const GENERIC_FAILURE = 'Dieser Notzugang gilt nicht.';

/**
 * Loest einen Notzugang ein.
 *
 * Jeder Fehlschlag sagt dasselbe. Ob ein Token nie existiert hat, schon benutzt
 * oder widerrufen wurde, geht niemanden etwas an, der hier Zeichenketten
 * durchprobiert — und wer den Token hat, sieht ohnehin, dass es klappt.
 */
export const redeemRecoveryToken = async (
  input: { token: string; ip: string },
  now: Date = new Date(),
): Promise<RecoveryOutcome> => {
  const ipLimit = await consumeIp(input.ip, now);
  if (!ipLimit.allowed) return { ok: false, message: ipLimit.message };

  const presented = input.token.trim();
  if (presented === '') {
    await burnTime();
    return { ok: false, message: GENERIC_FAILURE };
  }

  const rows = await db
    .select({
      id: schema.adminRecoveryTokens.id,
      refereeId: schema.adminRecoveryTokens.refereeId,
      name: schema.referees.name,
      role: schema.referees.role,
      active: schema.referees.active,
    })
    .from(schema.adminRecoveryTokens)
    .innerJoin(schema.referees, eq(schema.referees.id, schema.adminRecoveryTokens.refereeId))
    .where(
      and(
        /*
         * Gesucht wird ueber die Ableitung, nicht ueber den Klartext: in der
         * Datenbank steht nichts, womit sich anmelden liesse. Der Token hat
         * 384 zufaellige Bit — ein Salz braucht es dafuer nicht, und ohne Salz
         * bleibt der Zugriff ein Indexzugriff statt eines Tabellendurchlaufs.
         */
        eq(schema.adminRecoveryTokens.tokenHash, hash(presented, env.sessionSecret)),
        isNull(schema.adminRecoveryTokens.usedAt),
        isNull(schema.adminRecoveryTokens.revokedAt),
      ),
    )
    .limit(1);

  const entry = rows[0];
  if (!entry) {
    await burnTime();
    return { ok: false, message: GENERIC_FAILURE };
  }
  if (!entry.active || entry.role !== 'admin') return { ok: false, message: GENERIC_FAILURE };

  /*
   * Einmalverwendung: nur wer die Zeile tatsaechlich von "unbenutzt" auf
   * "benutzt" setzt, kommt weiter. Zwei gleichzeitige Einloesungen desselben
   * Tokens koennen so nicht beide gewinnen.
   */
  const claimed = await db
    .update(schema.adminRecoveryTokens)
    .set({ usedAt: now })
    .where(
      and(eq(schema.adminRecoveryTokens.id, entry.id), isNull(schema.adminRecoveryTokens.usedAt)),
    )
    .returning({ id: schema.adminRecoveryTokens.id });

  if (claimed.length === 0) return { ok: false, message: GENERIC_FAILURE };

  const startPassword = await applyStartPassword(entry.refereeId, entry.name, now);

  await db.insert(schema.auditLog).values({
    id: randomUUID(),
    actorId: entry.refereeId,
    action: 'recovery.redeem',
    subjectId: entry.refereeId,
    detail: { tokenId: entry.id },
  });

  return {
    ok: true,
    refereeId: entry.refereeId,
    role: entry.role,
    name: entry.name,
    startPassword,
  };
};

/**
 * Begrenzt das Durchprobieren. Nur nach Anschluss, nicht nach Token: es gibt
 * keinen Namen, unter dem sich zaehlen liesse, und ein 384-Bit-Token laesst
 * sich ohnehin nicht erraten. Die Grenze haelt lediglich den Aufwand klein.
 */
const consumeIp = async (
  ip: string,
  now: Date,
): Promise<{ allowed: true } | { allowed: false; message: string }> => {
  const key = rateLimitKey('ip', ip);
  const start = windowStart(now, LOGIN_PER_IP.windowMs);

  const updated = await db
    .insert(schema.rateLimits)
    .values({ key, windowStart: start, count: 1 })
    .onConflictDoUpdate({
      target: [schema.rateLimits.key, schema.rateLimits.windowStart],
      set: { count: raw`${schema.rateLimits.count} + 1` },
    })
    .returning({ count: schema.rateLimits.count });

  const count = updated[0]?.count ?? 1;
  const verdict = evaluateRateLimit({ windowStart: start, count: count - 1 }, LOGIN_PER_IP, now);
  return verdict.allowed ? { allowed: true } : { allowed: false, message: verdict.message };
};
