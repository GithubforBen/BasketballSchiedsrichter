'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isLicense } from '@/domain/license';
import type { SlotIndex } from '@/domain/types';
import { editGameRoute } from '@/routes';
import { editGame, removeFromGame } from '@/server/admin/games';
import { requireAdmin } from '@/server/guard';

/** Spiel bearbeiten: verschieben, Halle ändern, absagen, Besetzung entfernen. */

const read = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
};

const checked = (formData: FormData, key: string): boolean => formData.get(key) === 'an';

export const saveGameAction = async (formData: FormData): Promise<void> => {
  const user = await requireAdmin();
  const gameId = read(formData, 'spiel');
  const reason = read(formData, 'grund');

  const result = await editGame(user.id, gameId, {
    localDate: read(formData, 'datum'),
    localTime: read(formData, 'zeit'),
    venue: read(formData, 'ort'),
    requiredLicense: isLicense(read(formData, 'lizenz')) ? (read(formData, 'lizenz') as 'E' | 'D') : 'E',
    reason: reason === 'cancelled' ? 'cancelled' : reason === 'venue' ? 'venue' : 'moved',
    overrideWithdraw: checked(formData, 'freigabeAustragen'),
    overrideSubstituteRequest: checked(formData, 'freigabeErsatz'),
    overrideOneGamePerDay: checked(formData, 'freigabeZweitesSpiel'),
  });

  revalidatePath('/bearbeiten');
  revalidatePath('/uebersicht');
  redirect(editGameRoute(gameId, result));
};

export const removeFromGameAction = async (formData: FormData): Promise<void> => {
  const user = await requireAdmin();
  const gameId = read(formData, 'spiel');
  const slot = Number.parseInt(read(formData, 'platz'), 10);

  if (![0, 1, 2, 3].includes(slot)) {
    redirect(editGameRoute(gameId, { ok: false, message: 'Unbekannter Platz.' }));
  }

  const result = await removeFromGame(user.id, gameId, slot as SlotIndex);
  revalidatePath('/bearbeiten');
  redirect(editGameRoute(gameId, result));
};
