'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { parseTime } from '@/domain/csv';
import { isLicense } from '@/domain/license';
import type { License } from '@/domain/types';
import { adminResultRoute } from '@/routes';
import { createGame, importCsv } from '@/server/admin/games';
import { requireAdmin } from '@/server/guard';

/** Spiele anlegen — einzeln oder als CSV. */

const read = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
};

/** Die Lizenz aus dem Formular. Was keine gueltige Stufe ist, gilt als E. */
const readLicense = (formData: FormData): License => {
  const value = read(formData, 'lizenz');
  return isLicense(value) ? value : 'E';
};

/**
 * Die Uhrzeit als HH:MM.
 *
 * Das Feld ist ein Textfeld und kein `input type="time"`: dessen Anzeige folgt
 * der Spracheinstellung des Browsers, und auf einem englischen Chrome stand
 * dort "06:00 PM", wo der Verein 18:00 erwartet. `parseTime` nimmt "9:00" und
 * "9.00" genauso an und macht "09:00" daraus.
 */
const readTime = (formData: FormData): string => parseTime(read(formData, 'zeit')) ?? '';

export const createGameAction = async (formData: FormData): Promise<void> => {
  const user = await requireAdmin();
  const result = await createGame(user.id, {
    localDate: read(formData, 'datum'),
    localTime: readTime(formData),
    league: read(formData, 'liga'),
    home: read(formData, 'heim'),
    away: read(formData, 'gast'),
    venue: read(formData, 'ort'),
    requiredLicense: readLicense(formData),
  });
  revalidatePath('/anlegen');
  revalidatePath('/uebersicht');
  redirect(adminResultRoute('/anlegen', result));
};

export const importCsvAction = async (formData: FormData): Promise<void> => {
  const user = await requireAdmin();
  const result = await importCsv(user.id, read(formData, 'csv'));
  revalidatePath('/anlegen');
  revalidatePath('/uebersicht');
  redirect(adminResultRoute('/anlegen', result));
};
