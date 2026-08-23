'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { profileConfirmRoute, profileResultRoute } from '@/routes';
import { requireUser } from '@/server/guard';
import { addReminder, dropReminder, type ReminderResult } from '@/server/reminders';

/**
 * Die Aktionen der Profilseite.
 *
 * Stammdaten aendert hier niemand — das kann laut Regel 30 nur der Admin.
 * Aenderbar sind ausschliesslich die eigenen Erinnerungen.
 */

const readHours = (formData: FormData): number => {
  const value = formData.get('stunden');
  return typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;
};

const finish = (result: ReminderResult): never => {
  revalidatePath('/profil');
  if (result.kind === 'needs-confirmation') redirect(profileConfirmRoute(result.hoursBefore));
  redirect(profileResultRoute({ ok: result.kind === 'saved', message: result.message }));
};

export const addReminderAction = async (formData: FormData): Promise<void> => {
  const user = await requireUser();
  finish(await addReminder(user.id, readHours(formData)));
};

export const confirmReminderAction = async (formData: FormData): Promise<void> => {
  const user = await requireUser();
  finish(await addReminder(user.id, readHours(formData), true));
};

export const removeReminderAction = async (formData: FormData): Promise<void> => {
  const user = await requireUser();
  finish(await dropReminder(user.id, readHours(formData)));
};
