'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminResultRoute } from '@/routes';
import { nudgeOpenGames } from '@/server/admin/games';
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
