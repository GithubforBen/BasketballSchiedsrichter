import 'server-only';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { DIGEST_WEEKS_DEFAULT, DIGEST_WEEKS_MAX, DIGEST_WEEKS_MIN } from '@/domain/reminders';

/**
 * Die Tagesuebersicht, wie ein Admin sie fuer sich einstellt. Regel 20.
 *
 * Zwei Angaben, beide im eigenen Profil und nicht vereinsweit: **wie weit** sie
 * vorausschaut und **ob** sie ueberhaupt kommt. Der Zeitraum ist noetig, weil
 * ohne ihn am Saisonanfang der halbe Spielplan in einer Nachricht steht; der
 * Schalter, weil nicht jeder Admin dieselbe Nachricht will. Der vereinsweite
 * Schalter in den Einstellungen bleibt daneben bestehen und schaltet sie fuer
 * alle ab.
 */

export interface DigestResult {
  ok: boolean;
  message: string;
}

export const saveDigestSettings = async (
  refereeId: string,
  input: { weeks: number; enabled: boolean },
): Promise<DigestResult> => {
  if (!Number.isInteger(input.weeks) || input.weeks < DIGEST_WEEKS_MIN || input.weeks > DIGEST_WEEKS_MAX) {
    return {
      ok: false,
      message: `Der Zeitraum liegt zwischen ${DIGEST_WEEKS_MIN} und ${DIGEST_WEEKS_MAX} Wochen.`,
    };
  }

  await db
    .update(schema.referees)
    .set({ digestWeeks: input.weeks, digestEnabled: input.enabled })
    .where(eq(schema.referees.id, refereeId));
  await db.insert(schema.auditLog).values({
    id: randomUUID(),
    actorId: refereeId,
    action: 'tagesuebersicht.update',
    subjectId: refereeId,
    detail: { wochen: input.weeks, an: input.enabled },
  });

  return {
    ok: true,
    message: input.enabled
      ? `Gespeichert — die Tagesübersicht zeigt die nächsten ${input.weeks} Wochen.`
      : 'Gespeichert — du bekommst keine Tagesübersicht mehr.',
  };
};

export { DIGEST_WEEKS_DEFAULT, DIGEST_WEEKS_MAX, DIGEST_WEEKS_MIN };
