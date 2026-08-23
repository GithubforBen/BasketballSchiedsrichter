import { redirect } from 'next/navigation';
import { currentUser, type CurrentUser } from './viewer';

/**
 * Zugangsschutz fuer die angemeldeten Bereiche.
 *
 * Wer nicht angemeldet ist, landet auf der Anmeldeseite statt auf einer
 * Fehlerseite — die Absicht war ja, hierher zu kommen.
 */
export const requireUser = async (now: Date = new Date()): Promise<CurrentUser> => {
  const user = await currentUser(now);
  if (!user) redirect('/anmelden');
  return user;
};

/** Wie `requireUser`, verlangt aber zusaetzlich die Admin-Rolle. */
export const requireAdmin = async (now: Date = new Date()): Promise<CurrentUser> => {
  const user = await requireUser(now);
  if (user.role !== 'admin') redirect('/spiele');
  return user;
};
