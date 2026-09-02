'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isLicense } from '@/domain/license';
import { adminResultRoute } from '@/routes';
import { createGame, importCsv } from '@/server/admin/games';
import { requireAdmin } from '@/server/guard';

/** Spiele anlegen — einzeln oder als CSV. */

const read = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
};

/** Die Lizenz aus dem Formular. Was nicht E oder D ist, gilt als E. */
const readLicense = (formData: FormData): 'E' | 'D' => {
  const value = read(formData, 'lizenz');
  return isLicense(value) ? value : 'E';
};

export const createGameAction = async (formData: FormData): Promise<void> => {
  const user = await requireAdmin();
  const result = await createGame(user.id, {
    localDate: read(formData, 'datum'),
    localTime: read(formData, 'zeit'),
    leagueId: read(formData, 'liga'),
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
