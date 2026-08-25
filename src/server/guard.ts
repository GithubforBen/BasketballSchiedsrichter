import { redirect } from 'next/navigation';
import { currentUser, type CurrentUser } from './viewer';

/**
 * Zugangsschutz fuer die angemeldeten Bereiche.
 *
 * Wer nicht angemeldet ist, landet auf der Anmeldeseite statt auf einer
 * Fehlerseite — die Absicht war ja, hierher zu kommen.
 *
 * Regel 37: Wer noch mit dem Start-Passwort unterwegs ist, kommt hier nicht
 * vorbei. Der Zwang sitzt bewusst an dieser Stelle und nicht in jeder Seite
 * einzeln — so ist er auch fuer jede kuenftige Seite und fuer jede
 * Server-Aktion gesetzt, ohne dass jemand daran denken muss. Offen bleiben
 * damit genau die Wege, die keinen angemeldeten Nutzer verlangen: die
 * oeffentliche Ansicht, die Passwortseite und das Abmelden.
 */
export const requireUser = async (now: Date = new Date()): Promise<CurrentUser> => {
  const user = await currentUser(now);
  if (!user) redirect('/anmelden');
  if (user.mustChangePassword) redirect('/passwort');
  return user;
};

/** Wie `requireUser`, verlangt aber zusaetzlich die Admin-Rolle. */
export const requireAdmin = async (now: Date = new Date()): Promise<CurrentUser> => {
  const user = await requireUser(now);
  if (user.role !== 'admin') redirect('/spiele');
  return user;
};
