'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminResultRoute } from '@/routes';
import { nudgeOpenGames, remindOpenGame } from '@/server/admin/games';
import { requireAdmin } from '@/server/guard';

/**
 * Handeln direkt aus einer Meldung heraus.
 *
 * Der eigentliche Versand folgt in Meilenstein 5; hier entsteht der Auslöser
 * samt Eintrag im Prüfprotokoll.
 */
export const actOnAlertAction = async (formData: FormData): Promise<void> => {
  const user = await requireAdmin();
  const kind = formData.get('art');
  const result = await nudgeOpenGames(user.id);
  revalidatePath('/meldungen');
  redirect(
    adminResultRoute('/meldungen', {
      ok: result.ok,
      message:
        typeof kind === 'string' && kind === 'confirmation-overdue'
          ? 'Nachfrage an die Betroffenen vorgemerkt.'
          : result.message,
    }),
  );
};

/**
 * Erinnerung an ein offenes Spiel — nach der Rückfrage.
 *
 * Hierher führt nur der Knopf in der Rückfrage, nicht der an der Meldung: der
 * zeigt zuerst, wie viele Leute angeschrieben werden. Jede dieser Nachrichten
 * kostet (Regel 33), und „an alle“ ist nichts, was aus Versehen passieren soll.
 */
export const sendReminderAction = async (formData: FormData): Promise<void> => {
  const user = await requireAdmin();
  const gameId = formData.get('spiel');
  const result = await remindOpenGame(user.id, typeof gameId === 'string' ? gameId : '');
  revalidatePath('/meldungen');
  revalidatePath('/nachrichten');
  redirect(adminResultRoute('/meldungen', result));
};
