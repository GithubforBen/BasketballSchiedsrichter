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
 */
export const GET = async (request: NextRequest): Promise<NextResponse> => {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) return redirectTo('/anmelden');

  const result = await redeemLink(token);
  if (!result.ok) {
    return redirectTo(pathWithQuery('/anmelden', { fehler: result.message }));
  }

  const response = redirectTo(landingScreen(result.lastScreen));
  response.cookies.set(
    SESSION_COOKIE,
    createSession({ refereeId: result.refereeId, role: result.role }, env.sessionSecret, new Date()),
    sessionCookieOptions(request.nextUrl.protocol === 'https:'),
  );
  return response;
};
