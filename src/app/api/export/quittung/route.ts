import type { NextRequest } from 'next/server';
import { requireUser } from '@/server/guard';
import { loadReceiptView } from '@/server/queries/receipts';
import { renderReceiptsPdf } from '@/server/receipt-pdf';
import { RECEIPT_GAME_PARAM } from '@/routes';

/**
 * Die Quittung eines Spiels als PDF.
 *
 * Ein Route Handler, weil eine Server-Aktion keine Datei zurueckgeben kann.
 * Wer keinen Schiedsrichterplatz des Spiels hat, und jedes abgesagte Spiel,
 * bekommt dieselbe Antwort wie bei einer unbekannten Id: 404 ohne PDF. So
 * verraet die Antwort nicht, ob es das Spiel gibt.
 */

export const dynamic = 'force-dynamic';

const notFound = (): Response => new Response('Nicht gefunden', { status: 404 });

export const GET = async (request: NextRequest): Promise<Response> => {
  const user = await requireUser(new Date());
  const gameId = request.nextUrl.searchParams.get(RECEIPT_GAME_PARAM);
  if (!gameId) return notFound();

  const view = await loadReceiptView(user.id, gameId);
  if (!view) return notFound();

  const pdf = await renderReceiptsPdf([view]);
  return new Response(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="quittung.pdf"',
      // Betraege und Besetzung aendern sich; keine Kopie im Zwischenspeicher.
      'Cache-Control': 'no-store',
    },
  });
};
