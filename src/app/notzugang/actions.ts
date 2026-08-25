'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { redeemRecoveryToken } from '@/server/auth/recovery';
import { clientIp } from '@/server/client-ip';
import { recoveryRoute } from '@/routes';
import { startSession } from '../anmelden/actions';

/**
 * Notzugang einloesen. Regel 41.
 *
 * Was danach passiert, ist derselbe Weg wie beim Zuruecksetzen durch einen
 * Admin: das Konto faellt auf das Start-Passwort, der Zwang aus Regel 37 greift,
 * und die Passwortseite verlangt sofort ein eigenes. Der Token selbst ist damit
 * verbraucht.
 */
export const redeemRecoveryAction = async (formData: FormData): Promise<void> => {
  const value = formData.get('token');
  const requestHeaders = await headers();

  const result = await redeemRecoveryToken({
    token: typeof value === 'string' ? value : '',
    ip: clientIp(requestHeaders),
  });

  if (!result.ok) {
    redirect(recoveryRoute({ fehler: result.message }));
  }

  await startSession(result.refereeId, result.role);
  redirect('/passwort');
};
