import type { NextResponse } from 'next/server';
import { redirectTo } from '@/server/http';
import { SESSION_COOKIE } from '@/server/session';

/**
 * Abmelden.
 *
 * Nur ueber POST, damit ein fremder Link oder ein vorausschauender Browser
 * niemanden ungefragt aus der Sitzung wirft. 303 sorgt dafuer, dass der
 * Browser danach mit GET weitergeht statt den POST zu wiederholen.
 */
export const POST = (): NextResponse => {
  const response = redirectTo('/', 303);
  response.cookies.delete(SESSION_COOKIE);
  return response;
};
