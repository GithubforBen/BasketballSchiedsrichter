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
 * Der Zugang laeuft ueber `requireAdmin` wie auf jeder Verwaltungsseite. Nicht
 * wegen des Inhalts — in den Besetzungsspalten stehen Kuerzel, die im
 * oeffentlichen Spielplan ohnehin an jedem Spiel haengen. Sondern weil der
 * ganze Spielplan auf einmal, Vergangenheit eingeschlossen, ein Werkzeug der
 * Verwaltung ist und kein Angebot an jeden Vorbeikommenden. Wer nicht
 * angemeldet ist, landet auf der Anmeldeseite, wer kein Admin ist, bei den
 * offenen Spielen — dasselbe Verhalten wie beim Aufruf der Uebersicht selbst,
 * und damit nichts, was hier neu zu lernen waere.
 */

export const dynamic = 'force-dynamic';

export const GET = async (request: NextRequest): Promise<Response> => {
  const now = new Date();
  await requireAdmin(now);

  const wanted = request.nextUrl.searchParams.get('zeitraum') ?? undefined;
  const scope = isExportScope(wanted) ? wanted : 'kommende';

  const { entries, initials } = await gamesForExport(scope, now);
  const csv = buildGameCsv(entries, (id) => initials.get(id) ?? '', CLUB.timeZone);

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
       * Kein Zwischenspeicher. Die Datei aendert sich mit jeder Eintragung —
       * eine zwischengespeicherte Antwort zeigte eine Besetzung, die es so
       * nicht mehr gibt.
       */
      'Cache-Control': 'no-store',
    },
  });
};
