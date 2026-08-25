'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { loginRoute } from '@/routes';
import { landingScreen } from '@/server/auth/landing';
import { requestLogin, redeemCode } from '@/server/auth/login';
import { loginWithPassword } from '@/server/auth/password-login';
import { formatPhone, normalisePhone } from '@/server/auth/phone';
import { clientIp } from '@/server/client-ip';
import { env } from '@/server/env';
import { createSession, SESSION_COOKIE, sessionCookieOptions } from '@/server/session';

/**
 * Anmeldung.
 *
 * Der gewoehnliche Weg ist Telefonnummer und Passwort (Regel 34). Der Weg ueber
 * einen zugeschickten Link steht daneben und ist voreingestellt zu — jeder Link
 * kostet eine Nachricht, und davon hat der Verein 2000 im Monat. Der Code dafuer
 * bleibt vollstaendig erhalten; `LOGIN_MAGIC_LINK=an` schaltet ihn frei.
 */

const read = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
};

/**
 * Die Nummer, wie sie im Feld wieder erscheinen soll.
 *
 * Laesst sie sich lesen, kommt sie in der Form aus Regel 43 zurueck — wer sich
 * vertippt hat, sieht daran gleich, was die App verstanden hat. Sonst bleibt
 * stehen, was eingegeben wurde, damit es sich verbessern laesst.
 */
const echo = (input: string): string => {
  const parsed = normalisePhone(input);
  return parsed.ok ? formatPhone(parsed.phone) : input.trim();
};

export const passwordLoginAction = async (formData: FormData): Promise<void> => {
  const phone = read(formData, 'telefon');
  const requestHeaders = await headers();

  const result = await loginWithPassword({
    phone,
    password: read(formData, 'passwort'),
    ip: clientIp(requestHeaders),
  });

  if (!result.ok) {
    redirect(loginRoute({ tel: echo(phone), fehler: result.message }));
  }

  await startSession(result.refereeId, result.role);
  /*
   * Regel 37: Wer mit dem Start-Passwort kommt, landet auf der Passwortseite
   * statt auf seinem letzten Bildschirm. Der Schutz haengt nicht an dieser
   * Weiterleitung — `requireUser` laesst ohnehin niemanden weiter —, aber der
   * Umweg ueber eine Seite, die sofort weiterleitet, waere unschoen.
   */
  redirect(result.mustChangePassword ? '/passwort' : landingScreen(result.lastScreen));
};

export const requestLoginAction = async (formData: FormData): Promise<void> => {
  if (!env.magicLinkEnabled) redirect(loginRoute({ fehler: MAGIC_LINK_OFF }));

  const phone = read(formData, 'telefon');
  const requestHeaders = await headers();
  const result = await requestLogin({ phone, ip: clientIp(requestHeaders) });

  if (!result.accepted) {
    redirect(loginRoute({ fehler: result.message }));
  }

  // Die Nummer wandert in normalisierter Form weiter, damit der zweite Schritt
  // denselben Datensatz findet, egal wie sie eingetippt wurde.
  const parsed = normalisePhone(phone);
  const carried = parsed.ok ? parsed.phone : phone;
  redirect(loginRoute({ schritt: 'code', tel: carried, hinweis: result.message }));
};

export const submitCodeAction = async (formData: FormData): Promise<void> => {
  if (!env.magicLinkEnabled) redirect(loginRoute({ fehler: MAGIC_LINK_OFF }));

  const phone = read(formData, 'telefon');
  const code = read(formData, 'code').replace(/\D/g, '');

  const result = await redeemCode({ phone, code });
  if (!result.ok) {
    redirect(loginRoute({ schritt: 'code', tel: phone, fehler: result.message }));
  }

  await startSession(result.refereeId, result.role);
  redirect(result.mustChangePassword ? '/passwort' : landingScreen(result.lastScreen));
};

const MAGIC_LINK_OFF = 'Die Anmeldung per Link ist ausgeschaltet. Bitte mit Passwort anmelden.';

/** Setzt das Sitzungscookie. */
export const startSession = async (
  refereeId: string,
  role: 'referee' | 'admin',
): Promise<void> => {
  const store = await cookies();
  store.set(
    SESSION_COOKIE,
    createSession({ refereeId, role }, env.sessionSecret, new Date()),
    sessionCookieOptions(env.baseUrl.startsWith('https://')),
  );
};
