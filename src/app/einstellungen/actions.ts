'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { OpenSlotVisibility, RotationWindow } from '@/domain/types';
import { adminResultRoute } from '@/routes';
import { saveSettings, setLeague } from '@/server/admin/settings';
import { requireAdmin } from '@/server/guard';

/** Vereinsweite Einstellungen und Ligen. */

const read = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
};

const number = (formData: FormData, key: string): number =>
  Number.parseInt(read(formData, key), 10);

const checked = (formData: FormData, key: string): boolean => formData.get(key) === 'an';

export const saveSettingsAction = async (formData: FormData): Promise<void> => {
  const user = await requireAdmin();
  const window = read(formData, 'rotationszeitraum');
  const openSlot = read(formData, 'ausschreibung');

  const result = await saveSettings(user.id, {
    withdrawDeadlineDays: number(formData, 'austragefrist'),
    substituteRequestDeadlineDays: number(formData, 'ersatzfrist'),
    confirmationLeadHours: number(formData, 'bestaetigungsvorlauf'),
    reminderLimit: number(formData, 'erinnerungslimit'),
    oneGamePerDay: checked(formData, 'einSpielProTag'),
    rotation: checked(formData, 'rotation'),
    rotationWindow: (['week', 'month', 'season'] as const).includes(window as RotationWindow)
      ? (window as RotationWindow)
      : 'week',
    autoNudge: checked(formData, 'autoNachfrage'),
    openSlotVisibility: (['all', 'admins', 'off'] as const).includes(openSlot as OpenSlotVisibility)
      ? (openSlot as OpenSlotVisibility)
      : 'all',
    assignmentReceipt: checked(formData, 'quittungEintragung'),
    alertUnfilled: checked(formData, 'meldungUnbesetzt'),
    alertConfirmationOverdue: checked(formData, 'meldungBestaetigung'),
    alertSubstituteMissing: checked(formData, 'meldungErsatz'),
    alertCancellation: checked(formData, 'meldungAbsage'),
    alertDailyDigest: checked(formData, 'meldungTaeglich'),
    alertAfterImport: checked(formData, 'meldungImport'),
  });

  revalidatePath('/einstellungen');
  redirect(adminResultRoute('/einstellungen', result));
};

export const setLeagueAction = async (formData: FormData): Promise<void> => {
  const user = await requireAdmin();
  const result = await setLeague(user.id, read(formData, 'liga'), read(formData, 'wert') === 'an');
  revalidatePath('/einstellungen');
  redirect(adminResultRoute('/einstellungen', result));
};
