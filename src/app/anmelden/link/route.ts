import { type NextRequest, type NextResponse } from 'next/server';
import { landingScreen } from '@/server/auth/landing';
import { redeemLink } from '@/server/auth/login';
import { env } from '@/server/env';
import { pathWithQuery, redirectTo } from '@/server/http';
import { createSession, SESSION_COOKIE, sessionCookieOptions } from '@/server/session';

/**
 * Der Magic-Link.
 *
 * Ein Aufruf loest den Token ein und setzt die Sitzung. Schlaegt es fehl,
 * landet der Besucher wieder auf der Anmeldeseite — mit Begruendung, aber
 * ohne den Token in der Adresse stehen zu lassen.
 *
 * Steht `LOGIN_MAGIC_LINK` auf "aus", gibt es gar keine Links mehr — dann ist
 * auch dieser Weg zu, damit ein alter Link aus einer Nachricht nicht am
 * abgeschalteten Verfahren vorbei doch noch hineinfuehrt.
 */
export const GET = async (request: NextRequest): Promise<NextResponse> => {
  if (!env.magicLinkEnabled) return redirectTo('/anmelden');

  const token = request.nextUrl.searchParams.get('token');
  if (!token) return redirectTo('/anmelden');

  const result = await redeemLink(token);
  if (!result.ok) {
    return redirectTo(pathWithQuery('/anmelden', { fehler: result.message }));
  }

  // Regel 37: Das Start-Passwort oeffnet genau eine Seite — die Passwortseite.
  const target = result.mustChangePassword ? '/passwort' : landingScreen(result.lastScreen);
  const response = redirectTo(target);
  response.cookies.set(
    SESSION_COOKIE,
    createSession({ refereeId: result.refereeId, role: result.role }, env.sessionSecret, new Date()),
    sessionCookieOptions(request.nextUrl.protocol === 'https:'),
  );
  return response;
};
