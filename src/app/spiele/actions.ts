'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  claimNextSlot,
  confirmAssignment,
  respondToRelocation,
  withdraw,
  type ActionResult,
} from '@/server/assignments';
import { requireUser } from '@/server/guard';
import { openGamesResultRoute } from '@/routes';

/**
 * Die Aktionen im Schiedsrichter-Bereich.
 *
 * Jede meldet ihr Ergebnis ueber die Adresse zurueck, damit die Meldung auch
 * nach dem Neuladen noch steht und nicht in einem Zustand verschwindet, den
 * niemand mehr sieht.
 */

const read = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
};

const finish = (result: ActionResult, day: string): never => {
  revalidatePath('/spiele');
  /* Austragen aendert auch die eigene Liste — sie soll beim naechsten Blick stimmen. */
  revalidatePath('/kalender');
  redirect(openGamesResultRoute(day, result));
};

export const claimAction = async (formData: FormData): Promise<void> => {
  const user = await requireUser();
  finish(await claimNextSlot(read(formData, 'spiel'), user.id), read(formData, 'tag'));
};

export const withdrawAction = async (formData: FormData): Promise<void> => {
  const user = await requireUser();
  finish(await withdraw(read(formData, 'spiel'), user.id), read(formData, 'tag'));
};

export const confirmAction = async (formData: FormData): Promise<void> => {
  const user = await requireUser();
  finish(await confirmAssignment(read(formData, 'spiel'), user.id), read(formData, 'tag'));
};

export const keepAfterRelocationAction = async (formData: FormData): Promise<void> => {
  const user = await requireUser();
  finish(
    await respondToRelocation(read(formData, 'spiel'), user.id, 'keep'),
    read(formData, 'tag'),
  );
};

export const declineAfterRelocationAction = async (formData: FormData): Promise<void> => {
  const user = await requireUser();
  finish(
    await respondToRelocation(read(formData, 'spiel'), user.id, 'decline'),
    read(formData, 'tag'),
  );
};
