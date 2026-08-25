'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminResultRoute } from '@/routes';
import { createReferee, deleteReferee, setQualification, updateReferee } from '@/server/admin/referees';
import { resetPasswordByAdmin } from '@/server/auth/password-login';
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

/**
 * Setzt das Passwort zurueck. Regel 40.
 *
 * Danach gilt wieder das Start-Passwort aus dem Namen, mit neuer Frist, und die
 * Person muss beim naechsten Anmelden ein eigenes setzen. Das ist derzeit der
 * einzige Weg zurueck, wenn jemand sein Passwort vergisst — der Weg ueber eine
 * Nachricht kostet Nachrichten, und davon gibt es 2000 im Monat.
 *
 * Das Start-Passwort steht in der Rueckmeldung. Es liegt nirgends gespeichert,
 * sondern folgt aus dem Namen; der Admin liest es ab und sagt es weiter.
 */
export const resetPasswordAction = async (formData: FormData): Promise<void> => {
  const user = await requireAdmin();
  const result = await resetPasswordByAdmin(user.id, read(formData, 'person'));
  revalidatePath('/schiris');
  redirect(adminResultRoute('/schiris', result));
};

/**
 * Loescht ein Konto samt allen Daten. Unumkehrbar.
 *
 * Die Rueckfrage steht im Formular und wird hier ein zweites Mal geprueft:
 * ein Knopf, der beim ersten Klick ein Konto samt Verlauf entfernt, waere
 * fahrlaessig, und eine Rueckfrage, die nur im Browser existiert, ist keine.
 */
export const deleteRefereeAction = async (formData: FormData): Promise<void> => {
  const user = await requireAdmin();
  if (read(formData, 'bestaetigt') !== 'ja') {
    revalidatePath('/schiris');
    redirect(
      adminResultRoute('/schiris', {
        ok: false,
        message: 'Löschen nicht bestätigt — das Konto ist unverändert.',
      }),
    );
  }
  const result = await deleteReferee(user.id, read(formData, 'person'));
  revalidatePath('/schiris');
  redirect(adminResultRoute('/schiris', result));
};
