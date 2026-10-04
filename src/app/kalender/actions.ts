'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requestSubstitute, withdraw, type ActionResult } from '@/server/assignments';
import { requireUser } from '@/server/guard';
import { calendarResultRoute } from '@/routes';

/**
 * Die Aktionen an den eigenen Spielen: austragen und das Spiel abgeben.
 *
 * Dieselben Operationen wie in "Offene Spiele" — die Regeln entscheiden in
 * `src/server/assignments.ts`, nicht hier. Eigene Aktionen gibt es nur, weil
 * die Rueckmeldung dorthin zurueck soll, wo der Knopf stand: wer im Kalender
 * sein Spiel abgibt, will die Antwort im Kalender lesen und nicht auf einem
 * Spieltag in "Offene Spiele" landen.
 */

const read = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
};

const finish = (result: ActionResult): never => {
  revalidatePath('/kalender');
  revalidatePath('/spiele');
  revalidatePath('/');
  redirect(calendarResultRoute(result));
};

export const withdrawFromCalendarAction = async (formData: FormData): Promise<void> => {
  const user = await requireUser();
  finish(await withdraw(read(formData, 'spiel'), user.id));
};

export const requestSubstituteFromCalendarAction = async (formData: FormData): Promise<void> => {
  const user = await requireUser();
  finish(await requestSubstitute(read(formData, 'spiel'), user.id));
};
