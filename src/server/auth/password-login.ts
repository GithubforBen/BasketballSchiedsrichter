import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq, sql as raw } from 'drizzle-orm';
import { db, schema } from '@/db';
import {
  START_PASSWORD_VALID_DAYS,
  checkNewPassword,
  hasUsableStartPassword,
  passwordState,
  startPassword,
  startPasswordExpiry,
} from '@/domain/password';
import {
  evaluateRateLimit,
  LOGIN_PER_IP,
  PASSWORD_PER_PHONE,
  rateLimitKey,
  windowStart,
  type RateLimitRule,
} from '../rate-limit';
import { burnTime, hashPassword, verifyPassword } from './hash';
import { normalisePhone } from '@/domain/phone';

/**
 * Anmeldung mit Telefonnummer und Passwort. Regeln 34-40.
 *
 * Zwei Dinge liegen hier bewusst quer zur Bequemlichkeit:
 *
 * Erstens verraet keine Antwort, ob es ein Konto gibt. Falsche Nummer, falsches
 * Passwort, stillgelegtes Konto — es kommt derselbe Satz zurueck, und es
 * vergeht dieselbe Zeit. Sonst waere die Anmeldeseite ein Verzeichnis, mit dem
 * sich pruefen laesst, wer im Verein pfeift.
 *
 * Zweitens ist das Start-Passwort aus Regel 35 erratbar — es folgt aus dem
 * Namen, und im Verein kennt jeder jeden. Dagegen helfen nur die Frist aus
 * Regel 36 und ein enges Limit auf Fehlversuche.
 */

const GENERIC_FAILURE = 'Telefonnummer oder Passwort stimmt nicht.';

export type LoginOutcome =
  | {
      readonly ok: true;
      readonly refereeId: string;
      readonly role: 'referee' | 'admin';
      readonly lastScreen: string | null;
      /** Regel 37: Wer mit dem Start-Passwort kommt, muss sofort aendern. */
      readonly mustChangePassword: boolean;
      /** Stand des Sitzungszaehlers, der in das Cookie geschrieben wird. */
      readonly sessionEpoch: number;
    }
  | { readonly ok: false; readonly message: string };

export const loginWithPassword = async (
  input: { phone: string; password: string; ip: string },
  now: Date = new Date(),
): Promise<LoginOutcome> => {
  const parsed = normalisePhone(input.phone);
  if (!parsed.ok) {
    await burnTime();
    return { ok: false, message: parsed.message };
  }

  const ipLimit = await consume(rateLimitKey('ip', input.ip), LOGIN_PER_IP, now);
  if (!ipLimit.allowed) return { ok: false, message: ipLimit.message };

  const phoneLimit = await consume(
    rateLimitKey('pw', parsed.phone),
    PASSWORD_PER_PHONE,
    now,
  );
  if (!phoneLimit.allowed) return { ok: false, message: phoneLimit.message };

  const rows = await db
    .select({
      id: schema.referees.id,
      name: schema.referees.name,
      role: schema.referees.role,
      active: schema.referees.active,
      lastScreen: schema.referees.lastScreen,
      passwordHash: schema.referees.passwordHash,
      ownPasswordSetAt: schema.referees.ownPasswordSetAt,
      startPasswordExpiresAt: schema.referees.startPasswordExpiresAt,
      sessionEpoch: schema.referees.sessionEpoch,
    })
    .from(schema.referees)
    .where(eq(schema.referees.phone, parsed.phone))
    .limit(1);

  const referee = rows[0];
  /*
   * Auch fuer eine unbekannte oder stillgelegte Nummer wird gerechnet. Ohne das
   * antwortete die Anmeldung hier spuerbar schneller als bei einem echten Konto.
   */
  if (!referee || !referee.active || referee.passwordHash === null) {
    await burnTime();
    return { ok: false, message: GENERIC_FAILURE };
  }

  const state = passwordState(
    {
      ownPasswordSetAt: referee.ownPasswordSetAt,
      startPasswordExpiresAt: referee.startPasswordExpiresAt,
    },
    now,
  );

  if (state === 'expired') {
    /*
     * Regel 36: das Start-Passwort ist abgelaufen. Auch hier wird gerechnet und
     * dieselbe Meldung zurueckgegeben — dass ein Konto in diesem Zustand ist,
     * geht niemanden etwas an, der die Anmeldeseite abklopft. Wer betroffen
     * ist, weiss es aus dem Verein und meldet sich beim Admin.
     */
    await burnTime();
    return { ok: false, message: GENERIC_FAILURE };
  }

  if (!(await verifyPassword(input.password, referee.passwordHash))) {
    return { ok: false, message: GENERIC_FAILURE };
  }

  /*
   * Der Zaehler wird vor der Pruefung hochgesetzt — anders liesse sich ein
   * gleichzeitiges Durchprobieren nicht begrenzen. Deshalb faellt er hier
   * wieder weg: gezaehlt werden soll, wer raet, nicht wer sich anmeldet.
   * Sonst sperrte sich aus, wer sich an einem Abend mehrfach anmeldet.
   */
  await release(rateLimitKey('pw', parsed.phone), PASSWORD_PER_PHONE, now);

  return {
    ok: true,
    refereeId: referee.id,
    role: referee.role,
    lastScreen: referee.lastScreen,
    mustChangePassword: state === 'start',
    sessionEpoch: referee.sessionEpoch,
  };
};

export interface AppliedStartPassword {
  /** Klartext, damit der Admin ihn weitersagen kann. Gespeichert wird der Hash. */
  readonly password: string;
  /** Neuer Stand des Sitzungszaehlers — alle alten Sitzungen sind damit zu. */
  readonly sessionEpoch: number;
}

/**
 * Setzt das Start-Passwort aus dem Namen. Regeln 35, 36 und 40.
 *
 * Wird beim Anlegen eines Kontos und beim Zuruecksetzen durch einen Admin
 * benutzt. Zurueck kommt der Klartext — **nur** damit der Admin ihn der Person
 * nennen kann. Gespeichert wird ausschliesslich der Hash.
 *
 * Ergibt der Name kein brauchbares Passwort — denkbar bei einem Namen ganz ohne
 * lateinische Buchstaben —, bricht der Aufruf ab, statt ein leeres Passwort zu
 * setzen: ein Konto mit leerem Passwort stuende jedem offen. Aufrufer pruefen
 * das vorher mit `hasUsableStartPassword` und sagen es dem Admin verstaendlich;
 * der Fehler hier ist die letzte Sicherung, nicht die Meldung.
 */
export const applyStartPassword = async (
  refereeId: string,
  name: string,
  now: Date = new Date(),
): Promise<AppliedStartPassword> => {
  if (!hasUsableStartPassword(name)) {
    throw new Error('Aus diesem Namen lässt sich kein Start-Passwort bilden');
  }
  const plain = startPassword(name);
  const updated = await db
    .update(schema.referees)
    .set({
      passwordHash: await hashPassword(plain),
      ownPasswordSetAt: null,
      startPasswordExpiresAt: startPasswordExpiry(now),
      /*
       * Ein Zuruecksetzen schliesst alle offenen Sitzungen. Genau darum bittet
       * ja, wer sich meldet, weil jemand an seinem Telefon war — ein neues
       * Passwort allein wuerfe den anderen nicht hinaus. Der Weg hier deckt
       * beide Faelle ab: das Zuruecksetzen durch den Admin (Regel 40) und den
       * Notzugang (Regel 41), die beide hier hindurchgehen.
       */
      sessionEpoch: raw`${schema.referees.sessionEpoch} + 1`,
    })
    .where(eq(schema.referees.id, refereeId))
    .returning({ sessionEpoch: schema.referees.sessionEpoch });
  return { password: plain, sessionEpoch: updated[0]?.sessionEpoch ?? 0 };
};

export type ChangeOutcome =
  | {
      readonly ok: true;
      readonly message: string;
      /**
       * Der neue Stand des Sitzungszaehlers. Der Aufrufer stellt damit das
       * eigene Cookie neu aus — alle *anderen* Sitzungen sind ab jetzt zu.
       */
      readonly sessionEpoch: number | undefined;
    }
  | { readonly ok: false; readonly message: string };

/**
 * Setzt ein eigenes Passwort. Regeln 37 und 38.
 *
 * `current` ist das bisherige Passwort. Es wird immer verlangt — auch beim
 * erzwungenen Wechsel nach dem ersten Anmelden, wo es das Start-Passwort ist.
 * Wer an einem offenen Bildschirm sitzt, soll das Passwort nicht ohne Kenntnis
 * des alten aendern koennen.
 */
export const changeOwnPassword = async (
  refereeId: string,
  current: string,
  next: string,
  repeated: string,
  now: Date = new Date(),
): Promise<ChangeOutcome> => {
  const rows = await db
    .select({ passwordHash: schema.referees.passwordHash })
    .from(schema.referees)
    .where(eq(schema.referees.id, refereeId))
    .limit(1);

  const stored = rows[0]?.passwordHash;
  if (!stored) return { ok: false, message: 'Dieses Konto hat kein Passwort.' };

  if (!(await verifyPassword(current, stored))) {
    return { ok: false, message: 'Das bisherige Passwort stimmt nicht.' };
  }

  const check = checkNewPassword(next, repeated, await verifyPassword(next, stored));
  if (!check.ok) return { ok: false, message: check.message };

  const updated = await db
    .update(schema.referees)
    .set({
      passwordHash: await hashPassword(check.password),
      ownPasswordSetAt: now,
      startPasswordExpiresAt: null,
      /*
       * Alle anderen Sitzungen fallen weg. Wer sein Passwort aendert, weil er
       * fuerchtet, dass jemand mitgelesen hat, erreicht damit auch wirklich
       * etwas — sonst bliebe die fremde Sitzung bis zu dreissig Tage offen.
       */
      sessionEpoch: raw`${schema.referees.sessionEpoch} + 1`,
    })
    .where(eq(schema.referees.id, refereeId))
    .returning({ sessionEpoch: schema.referees.sessionEpoch });

  /*
   * Die eigene Sitzung wird gleich neu ausgestellt — sonst haette sich gerade
   * ausgesperrt, wer sein Passwort aendert.
   */
  return {
    ok: true,
    message: 'Passwort geändert.',
    sessionEpoch: updated[0]?.sessionEpoch,
  };
};

/** Regel 40: Ein Admin setzt zurueck. Das Konto faellt auf das Start-Passwort. */
export const resetPasswordByAdmin = async (
  actorId: string,
  refereeId: string,
  now: Date = new Date(),
): Promise<{ ok: boolean; message: string; startPassword?: string }> => {
  const rows = await db
    .select({ name: schema.referees.name })
    .from(schema.referees)
    .where(eq(schema.referees.id, refereeId))
    .limit(1);

  const referee = rows[0];
  if (!referee) return { ok: false, message: 'Dieses Konto gibt es nicht mehr.' };

  if (!hasUsableStartPassword(referee.name)) {
    return {
      ok: false,
      message: 'Aus diesem Namen lässt sich kein Start-Passwort bilden. Bitte den Namen ergänzen.',
    };
  }

  const { password: plain } = await applyStartPassword(refereeId, referee.name, now);

  await db.insert(schema.auditLog).values({
    id: randomUUID(),
    actorId,
    action: 'referee.password-reset',
    subjectId: refereeId,
    /*
     * Regel 39: im Pruefprotokoll steht, **dass** zurueckgesetzt wurde — nie
     * das Passwort selbst. Es liesse sich zwar aus dem Namen erneut ableiten,
     * aber es hier abzulegen hiesse, es dauerhaft aufzubewahren.
     */
    detail: { validDays: START_PASSWORD_VALID_DAYS },
  });

  return {
    ok: true,
    /*
     * Ohne den Klartext: diese Meldung reist im Abfrageteil der Adresse und
     * stuende damit im Verlauf des Browsers und im Zugriffsprotokoll des
     * Webservers. In der Tabelle daneben steht sie, aus dem Namen gerechnet.
     */
    message:
      `Zurückgesetzt. Das Start-Passwort steht in der Tabelle und gilt ${START_PASSWORD_VALID_DAYS} Tage.`,
    startPassword: plain,
  };
};

/**
 * Zaehlt einen Versuch und entscheidet, ob er noch erlaubt ist.
 *
 * Der Zaehler wird in der Datenbank hochgezaehlt, nicht gelesen und
 * zurueckgeschrieben: sonst saehen zwei gleichzeitige Versuche denselben Stand
 * und unterliefen das Limit gemeinsam.
 */
const release = async (key: string, rule: RateLimitRule, now: Date): Promise<void> => {
  await db
    .delete(schema.rateLimits)
    .where(
      and(
        eq(schema.rateLimits.key, key),
        eq(schema.rateLimits.windowStart, windowStart(now, rule.windowMs)),
      ),
    );
};

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
