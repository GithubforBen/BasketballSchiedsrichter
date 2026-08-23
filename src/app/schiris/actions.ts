'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminResultRoute } from '@/routes';
import { createReferee, setQualification, updateReferee } from '@/server/admin/referees';
import { requireAdmin } from '@/server/guard';

/** Schiedsrichter-Verwaltung. Regel 30: nur hier änderbar. */

const read = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
};

const role = (formData: FormData): 'referee' | 'admin' =>
  read(formData, 'rolle') === 'admin' ? 'admin' : 'referee';

export const createRefereeAction = async (formData: FormData): Promise<void> => {
  const user = await requireAdmin();
  const result = await createReferee(user.id, {
    name: read(formData, 'name'),
    initials: read(formData, 'kuerzel'),
    phone: read(formData, 'telefon'),
    role: role(formData),
  });
  revalidatePath('/schiris');
  redirect(adminResultRoute('/schiris', result));
};

export const updateRefereeAction = async (formData: FormData): Promise<void> => {
  const user = await requireAdmin();
  const result = await updateReferee(user.id, read(formData, 'person'), {
    initials: read(formData, 'kuerzel'),
    phone: read(formData, 'telefon'),
    role: role(formData),
    active: formData.get('aktiv') === 'an',
  });
  revalidatePath('/schiris');
  redirect(adminResultRoute('/schiris', result));
};

export const toggleQualificationAction = async (formData: FormData): Promise<void> => {
  const user = await requireAdmin();
  const result = await setQualification(
    user.id,
    read(formData, 'person'),
    read(formData, 'liga'),
    read(formData, 'wert') === 'an',
  );
  revalidatePath('/schiris');
  redirect(adminResultRoute('/schiris', result));
};
