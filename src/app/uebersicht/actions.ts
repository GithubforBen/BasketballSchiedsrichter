'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminResultRoute } from '@/routes';
import { nudgeOpenGames } from '@/server/admin/games';
import { requireAdmin } from '@/server/guard';

/** Erinnerung an alle offenen Spiele. Regel 32. */
export const nudgeAction = async (): Promise<void> => {
  const user = await requireAdmin();
  const result = await nudgeOpenGames(user.id);
  revalidatePath('/uebersicht');
  redirect(adminResultRoute('/uebersicht', result));
};
