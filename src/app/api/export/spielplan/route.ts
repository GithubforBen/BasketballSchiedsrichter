import type { NextRequest } from 'next/server';
import { CLUB } from '@/config/club';
import { buildGameCsv, gameExportFileName } from '@/domain/csv-export';
import { requireAdmin } from '@/server/guard';
import { gamesForExport, isExportScope } from '@/server/queries/export';

/**
 * Der Spielplan als CSV-Datei.
 *
 * Ein Route Handler und keine Server-Aktion: eine Aktion kann Zustand aendern
 * und die Seite neu zeichnen, aber keine Datei zum Herunterladen zurueckgeben.
 * Dafuer braucht es eine Antwort mit eigenem Inhaltstyp — also diesen Weg.
 *
 * Der Zugang laeuft ueber `requireAdmin` wie auf jeder Verwaltungsseite: die
 * Datei nennt die vollen Namen aller Eingetragenen, und die sind nach Regel 29
 * nicht oeffentlich. Wer nicht angemeldet ist, landet auf der Anmeldeseite,
 * wer kein Admin ist, bei den offenen Spielen — dasselbe Verhalten wie beim
 * Aufruf der Uebersicht selbst, und damit nichts, was hier neu zu lernen waere.
 */

export const dynamic = 'force-dynamic';

export const GET = async (request: NextRequest): Promise<Response> => {
  const now = new Date();
  await requireAdmin(now);

  const wanted = request.nextUrl.searchParams.get('zeitraum') ?? undefined;
  const scope = isExportScope(wanted) ? wanted : 'kommende';

  const { entries, names } = await gamesForExport(scope, now);
  const csv = buildGameCsv(entries, (id) => names.get(id) ?? '', CLUB.timeZone);

  return new Response(csv, {
    headers: {
      /*
       * `charset=utf-8` zusaetzlich zum BOM in der Datei: das eine gilt fuer
       * den Browser, das andere fuer das Tabellenprogramm, das die Datei
       * spaeter vom Datentraeger liest und von dieser Kopfzeile nichts mehr
       * weiss.
       */
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${gameExportFileName(now, CLUB.timeZone)}"`,
      /*
       * Kein Zwischenspeicher. Die Datei aendert sich mit jeder Eintragung,
       * und sie enthaelt Namen — sie hat weder im Browser-Cache noch in einem
       * Zwischenspeicher unterwegs etwas verloren.
       */
      'Cache-Control': 'no-store',
    },
  });
};
