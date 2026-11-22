import type { NextRequest } from 'next/server';
import { validateReceiptPeriod } from '@/domain/receipt-period';
import { requireUser } from '@/server/guard';
import { pathWithQuery, redirectTo } from '@/server/http';
import { loadReceiptViews } from '@/server/queries/receipts';
import { renderReceiptsPdf } from '@/server/receipt-pdf';
import { RECEIPTS_FROM_PARAM, RECEIPTS_TO_PARAM } from '@/routes';

/**
 * Die Quittungen eines Zeitraums als ein PDF mit einer Seite je Spiel.
 *
 * Ein ungueltiger oder leerer Zeitraum liefert kein PDF, sondern leitet mit
 * einer Meldung zurueck ins Profil: eine leere Datei waere nur verwirrend.
 */

export const dynamic = 'force-dynamic';

const backToProfile = (message: string): Response =>
  redirectTo(pathWithQuery('/profil', { fehler: message }), 303);

export const GET = async (request: NextRequest): Promise<Response> => {
  const now = new Date();
  const user = await requireUser(now);
  const params = request.nextUrl.searchParams;

  const check = validateReceiptPeriod(
    params.get(RECEIPTS_FROM_PARAM),
    params.get(RECEIPTS_TO_PARAM),
  );
  if (!check.ok) return backToProfile(check.message);

  const views = await loadReceiptViews(user.id, check.period, now);
  if (views.length === 0) {
    return backToProfile('In diesem Zeitraum gibt es keine Spiele mit Quittung.');
  }

  const pdf = await renderReceiptsPdf(views);
  return new Response(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="quittungen-${check.period.von}-${check.period.bis}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
};
