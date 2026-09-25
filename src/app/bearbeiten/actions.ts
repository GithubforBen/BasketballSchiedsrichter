'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { parseTime } from '@/domain/csv';
import { isLicense } from '@/domain/license';
import type { License, SlotIndex } from '@/domain/types';
import { editGameRoute } from '@/routes';
import { assignReferee, editGame, removeFromGame, setGameReleases } from '@/server/admin/games';
import { requireAdmin } from '@/server/guard';
import { requestSubstitute } from '@/server/assignments';
import { loadSettings } from '@/server/queries/settings';

/** Spiel bearbeiten: verschieben, Halle ändern, absagen, Besetzung entfernen. */

const read = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
};

const checked = (formData: FormData, key: string): boolean => formData.get(key) === 'an';
/** Die Lizenz aus dem Formular. Was keine gueltige Stufe ist, gilt als E. */
const readLicense = (formData: FormData): License => {
  const value = read(formData, 'lizenz');
  return isLicense(value) ? value : 'E';
};


export const saveGameAction = async (formData: FormData): Promise<void> => {
  const user = await requireAdmin();
  const gameId = read(formData, 'spiel');
  const reason = read(formData, 'grund');

  const result = await editGame(user.id, gameId, {
    localDate: read(formData, 'datum'),
    localTime: parseTime(read(formData, 'zeit')) ?? '',
    venue: read(formData, 'ort'),
    requiredLicense: readLicense(formData),
    reason: reason === 'cancelled' ? 'cancelled' : reason === 'venue' ? 'venue' : 'moved',
  });

  revalidatePath('/bearbeiten');
  revalidatePath('/uebersicht');
  redirect(editGameRoute(gameId, result));
};

/**
 * Die Freigaben fuer dieses eine Spiel — Austragen, Ersatz anfordern, zweites
 * Spiel am selben Tag.
 *
 * Eigene Aktion und eigenes Formular, weil sie mit dem Termin nichts zu tun
 * haben: `saveGameAction` schreibt Datum, Uhrzeit und Ort zurueck und kann
 * dabei eine Verschiebung samt Nachricht an alle Beteiligten ausloesen. Eine
 * aufgehobene Frist darf das nicht kosten.
 *
 * `/spiele` wird mit aufgefrischt: dort haengt der Knopf „Ersatz anfordern“
 * an genau diesem Wert, und der Schiedsrichter soll die Freigabe sehen,
 * sobald sie gilt.
 */
export const saveReleasesAction = async (formData: FormData): Promise<void> => {
  const user = await requireAdmin();
  const gameId = read(formData, 'spiel');
  const settings = await loadSettings();

  const result = await setGameReleases(user.id, gameId, {
    withdraw: checked(formData, 'freigabeAustragen'),
    substituteRequest: checked(formData, 'freigabeErsatz'),
    /*
     * Ist die Regel abgeschaltet, steht der Haken nicht im Formular. Ein
     * fehlendes Feld hiesse sonst "aus" — und wer nur die Austragefrist
     * freigibt, loeschte damit nebenbei eine Ausnahme, die wieder gebraucht
     * wird, sobald der Verein die Regel einschaltet.
     */
    oneGamePerDay: settings.oneGamePerDay ? checked(formData, 'freigabeZweitesSpiel') : null,
  });

  revalidatePath('/bearbeiten');
  revalidatePath('/spiele');
  redirect(editGameRoute(gameId, result));
};

/** Teilt eine Person auf einen bestimmten Platz ein. Sie bekommt eine Nachricht. */
export const assignRefereeAction = async (formData: FormData): Promise<void> => {
  const user = await requireAdmin();
  const gameId = read(formData, 'spiel');
  const slot = Number.parseInt(read(formData, 'platz'), 10);

  if (![0, 1, 2, 3].includes(slot)) {
    redirect(editGameRoute(gameId, { ok: false, message: 'Unbekannter Platz.' }));
  }

  const result = await assignReferee(user.id, gameId, slot as SlotIndex, read(formData, 'person'));
  revalidatePath('/bearbeiten');
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

/**
 * Regel 8 aus Sicht des Admins: den geraeumten Platz an den Ersatz abgeben.
 *
 * Derselbe Vorgang wie beim Schiedsrichter, nur mit anderem Ausloeser. Der
 * Admin traegt zuerst jemanden aus — dann steht der Platz leer — und fragt
 * anschliessend den vordersten Ersatz, ob er uebernimmt.
 */
export const requestSubstituteAction = async (formData: FormData): Promise<void> => {
  const user = await requireAdmin();
  const gameId = read(formData, 'spiel');

  const result = await requestSubstitute(gameId, user.id);
  revalidatePath('/bearbeiten');
  revalidatePath('/uebersicht');
  revalidatePath('/spiele');
  redirect(editGameRoute(gameId, result));
};
