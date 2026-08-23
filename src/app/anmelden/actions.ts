'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { landingScreen } from '@/server/auth/landing';
import { requestLogin, redeemCode } from '@/server/auth/login';
import { normalisePhone } from '@/server/auth/phone';
import { clientIp } from '@/server/client-ip';
import { env } from '@/server/env';
import { createSession, SESSION_COOKIE, sessionCookieOptions } from '@/server/session';

/**
 * Die beiden Schritte der Anmeldung.
 *
 * Schritt eins schickt Link und Code, Schritt zwei nimmt den Code entgegen.
 * Wer den Link antippt, ueberspringt Schritt zwei — siehe link/route.ts.
 */

const readPhone = (formData: FormData): string => {
  const value = formData.get('telefon');
  return typeof value === 'string' ? value : '';
};

export const requestLoginAction = async (formData: FormData): Promise<void> => {
  const phone = readPhone(formData);
  const requestHeaders = await headers();
  const result = await requestLogin({ phone, ip: clientIp(requestHeaders) });

  if (!result.accepted) {
    redirect(`/anmelden?fehler=${encodeURIComponent(result.message)}`);
  }

  // Die Nummer wandert in normalisierter Form weiter, damit der zweite Schritt
  // denselben Datensatz findet, egal wie sie eingetippt wurde.
  const parsed = normalisePhone(phone);
  const carried = parsed.ok ? parsed.phone : phone;
  redirect(
    `/anmelden?schritt=code&tel=${encodeURIComponent(carried)}&hinweis=${encodeURIComponent(result.message)}`,
  );
};

export const submitCodeAction = async (formData: FormData): Promise<void> => {
  const phone = readPhone(formData);
  const codeValue = formData.get('code');
  const code = typeof codeValue === 'string' ? codeValue.replace(/\D/g, '') : '';

  const result = await redeemCode({ phone, code });
  if (!result.ok) {
    redirect(
      `/anmelden?schritt=code&tel=${encodeURIComponent(phone)}&fehler=${encodeURIComponent(result.message)}`,
    );
  }

  await startSession(result.refereeId, result.role);
  redirect(landingScreen(result.lastScreen));
};

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

