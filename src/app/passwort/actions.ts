'use server';

import { redirect } from 'next/navigation';
import { passwordRoute } from '@/routes';
import { landingScreen } from '@/server/auth/landing';
import { changeOwnPassword } from '@/server/auth/password-login';
import { currentUser } from '@/server/viewer';
import { startSession } from '../anmelden/actions';

/**
 * Passwort aendern. Regeln 37 und 38.
 *
 * Bewusst nicht ueber `requireUser`: der Zwang aus Regel 37 leitet dort auf
 * genau diese Seite um, und eine Aktion, die sich selbst wegleitet, waere eine
 * Schleife.
 */

const read = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
};

export const changePasswordAction = async (formData: FormData): Promise<void> => {
  const user = await currentUser();
  if (!user) redirect('/anmelden');

  const result = await changeOwnPassword(
    user.id,
    read(formData, 'bisher'),
    read(formData, 'neu'),
    read(formData, 'wiederholung'),
  );

  if (!result.ok) redirect(passwordRoute({ fehler: result.message }));

  /*
   * Die Aenderung hat den Sitzungszaehler hochgezaehlt und damit **alle**
   * Sitzungen dieser Person geschlossen — die eigene eingeschlossen. Deshalb
   * wird sie hier sofort neu ausgestellt, mit dem neuen Stand: wer sein
   * Passwort aendert, soll angemeldet bleiben, wer mit einem alten Cookie
   * danebensitzt, fliegt hinaus.
   */
  if (result.sessionEpoch !== undefined) {
    await startSession(user.id, user.role, result.sessionEpoch);
  }

  /*
   * Nach dem erzwungenen Wechsel geht es dorthin, wo die Person hinwollte —
   * ein „gespeichert" auf einer Seite, die man nur musste, waere eine Sackgasse.
   * Wer freiwillig geaendert hat, bleibt mit der Bestaetigung hier stehen.
   */
  if (user.mustChangePassword) redirect(landingScreen(user.lastScreen, user.role));
  redirect(passwordRoute({ hinweis: result.message }));
};
