'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { answerRoute } from '@/routes';
import { openAnswer, readAnswer, submitAnswer, type AnswerChoice } from '@/server/answers';

/**
 * Die Antwort aus einer Nachricht.
 *
 * Wer antwortet und worauf, sagt allein der signierte Token — aus dem Formular
 * kommt nur, *welche* der angebotenen Antworten es sein soll. Eine gefaelschte
 * Spiel- oder Personen-Id gibt es hier deshalb nicht: sie steht gar nicht im
 * Formular.
 */

const read = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
};

const CHOICES: Readonly<Record<string, AnswerChoice>> = {
  bestaetigen: 'confirm',
  nachruecken: 'promotion-accept',
  ablehnen: 'promotion-decline',
  bleiben: 'keep',
  absagen: 'decline',
};

export const answerAction = async (formData: FormData): Promise<void> => {
  const token = read(formData, 'token');
  const choice = CHOICES[read(formData, 'antwort')];
  const now = new Date();

  const check = readAnswer(token, now);
  if (!check.ok) redirect(answerRoute(token, { ok: false, message: check.message }));
  if (!choice) {
    redirect(answerRoute(token, { ok: false, message: 'Diese Antwort kennen wir nicht.' }));
  }

  /*
   * Erst nachsehen, ob die Frage ueberhaupt noch offen ist. Sonst laege der
   * Unterschied zwischen "schon beantwortet" und "gerade beantwortet" allein
   * in der Rueckmeldung der Fachfunktion — und die kennt den Vorgang nicht,
   * nur seinen Ausgang.
   */
  const lookup = await openAnswer(check.claims, now);
  if (!lookup.ok) redirect(answerRoute(token, { ok: false, message: lookup.message }));

  const result =
    lookup.question.state === 'open'
      ? await submitAnswer(check.claims, choice, now)
      : { ok: false as const, message: lookup.question.status };

  revalidatePath('/kalender');
  revalidatePath('/spiele');
  redirect(answerRoute(token, result));
};
