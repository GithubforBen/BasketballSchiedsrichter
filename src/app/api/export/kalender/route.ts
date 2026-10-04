import type { NextRequest } from 'next/server';
import { CLUB } from '@/config/club';
import { buildCalendar, calendarFileName, type CalendarEntry } from '@/domain/ics';
import { requireUser } from '@/server/guard';
import { myGames } from '@/server/queries/referee-view';
import { loadSettings } from '@/server/queries/settings';
import { CALENDAR_GAME_PARAM } from '@/routes';

/**
 * Die eigenen Einsaetze als Kalenderdatei.
 *
 * Ein Route Handler und keine Server-Aktion: eine Aktion kann die Seite neu
 * zeichnen, aber keine Datei zum Herunterladen zurueckgeben.
 *
 * **Jeder bekommt nur die eigenen Spiele.** Die Auswahl aus dem Formular ist
 * ein Filter auf die eigene Liste und kein Schluessel: eine fremde Spiel-Id im
 * Abfrageteil steht schlicht nicht in `myGames` und faellt deshalb heraus —
 * ohne Sonderbehandlung und ohne dass jemand daran denken muesste.
 *
 * Kommt gar keine Auswahl an — jemand ruft die Adresse ohne Formular auf, oder
 * JavaScript ist aus —, gilt die Voreinstellung der Seite: die Spiele, in
 * denen man selbst Schiedsrichter ist. Der Ersatz bleibt draussen; dort steht
 * man bereit, aber der Termin ist noch keiner (Regel 12).
 */

export const dynamic = 'force-dynamic';

/** Die Plaetze 0 und 1 — wer dort steht, pfeift. Regel 1. */
const isRefereeSlot = (slotIndex: number): boolean => slotIndex < 2;

export const GET = async (request: NextRequest): Promise<Response> => {
  const now = new Date();
  const user = await requireUser(now);
  const settings = await loadSettings();

  const { upcoming } = await myGames(user.id, settings, now);
  const wanted = new Set(request.nextUrl.searchParams.getAll(CALENDAR_GAME_PARAM));

  const chosen = upcoming.filter((mine) =>
    wanted.size === 0 ? isRefereeSlot(mine.slotIndex) : wanted.has(mine.game.id),
  );

  const entries: readonly CalendarEntry[] = chosen.map((mine) => ({
    game: mine.game,
    role: mine.role,
  }));

  return new Response(buildCalendar(entries, now), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${calendarFileName(now, CLUB.timeZone)}"`,
      /*
       * Kein Zwischenspeicher. Die Besetzung aendert sich, Spiele werden
       * verschoben — eine zwischengespeicherte Datei traegt Termine, die es so
       * nicht mehr gibt, und sie landen dann dauerhaft in einem fremden
       * Kalender.
       */
      'Cache-Control': 'no-store',
    },
  });
};
