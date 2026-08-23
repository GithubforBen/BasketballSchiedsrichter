'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { SlotIndex } from '@/domain/types';
import { adminResultRoute } from '@/routes';
import { setPlayedAsReferee } from '@/server/admin/appearances';
import { requireAdmin } from '@/server/guard';

/** Nachpflegen, ob ein Ersatz tatsächlich im Einsatz war. Regel 27. */
/**
 * Liest ein Formularfeld als Zeichenkette.
 *
 * `FormData.get` kann auch eine Datei liefern; die stillschweigend in eine
 * Zeichenkette zu zwingen ergaebe „[object Object]“ statt eines Fehlers.
 */
const read = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
};

export const setAppearanceAction = async (formData: FormData): Promise<void> => {
  const user = await requireAdmin();

  const gameId = read(formData, 'spiel');
  const slot = Number.parseInt(read(formData, 'platz'), 10);
  const played = read(formData, 'wert') === 'ja';

  if (![0, 1, 2, 3].includes(slot)) {
    redirect(adminResultRoute('/nachpflegen', { ok: false, message: 'Unbekannter Platz.' }));
  }

  const result = await setPlayedAsReferee(user.id, gameId, slot as SlotIndex, played);
  revalidatePath('/nachpflegen');
  revalidatePath('/kalender');
  redirect(adminResultRoute('/nachpflegen', result));
};
