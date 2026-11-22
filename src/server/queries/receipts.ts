import 'server-only';
import { and, asc, eq, gte, inArray, lt, lte, ne } from 'drizzle-orm';
import { db, schema } from '@/db';
import { CLUB } from '@/config/club';
import {
  buildReceiptView,
  type ReceiptExpenses,
  type ReceiptRefereeInput,
  type ReceiptView,
} from '@/domain/receipt';
import type { ReceiptPeriod } from '@/domain/receipt-period';
import { localToUtc } from '@/domain/time';
import { travelModeFromDb } from '../expenses';
import { resolveKmRates, resolveLeagueFee } from '../receipt-rates';

/**
 * Quittungsdaten: ein Spiel oder alle vergangenen Spiele eines Zeitraums.
 * Eine Quittung gibt es nur fuer Platz 0 und 1 eines nicht abgesagten Spiels.
 */

interface GameRow {
  id: string;
  kickoff: Date;
  leagueId: string;
  leagueName: string;
  leagueLabel: string;
  home: string;
  away: string;
  venue: string;
}

const gameColumns = {
  id: schema.games.id,
  kickoff: schema.games.kickoff,
  leagueId: schema.games.leagueId,
  leagueName: schema.leagues.name,
  leagueLabel: schema.games.leagueLabel,
  home: schema.games.home,
  away: schema.games.away,
  venue: schema.games.venue,
};

/** Baut die Ansichten fuer fertig geladene Spiele, in der Reihenfolge der Spiele. */
const buildViews = async (games: readonly GameRow[]): Promise<ReceiptView[]> => {
  if (games.length === 0) return [];
  const ids = games.map((g) => g.id);
  const rows = await db
    .select({
      gameId: schema.assignments.gameId,
      slot: schema.assignments.slotIndex,
      name: schema.referees.name,
      mode: schema.assignmentExpenses.travelMode,
      km: schema.assignmentExpenses.km,
      perDiemCents: schema.assignmentExpenses.perDiemCents,
      otherCents: schema.assignmentExpenses.otherCents,
      otherLabel: schema.assignmentExpenses.otherLabel,
      hasExpenses: schema.assignmentExpenses.gameId,
    })
    .from(schema.assignments)
    .innerJoin(schema.referees, eq(schema.referees.id, schema.assignments.refereeId))
    .leftJoin(
      schema.assignmentExpenses,
      and(
        eq(schema.assignmentExpenses.gameId, schema.assignments.gameId),
        eq(schema.assignmentExpenses.refereeId, schema.assignments.refereeId),
      ),
    )
    .where(and(inArray(schema.assignments.gameId, ids), lte(schema.assignments.slotIndex, 1)))
    .orderBy(asc(schema.assignments.slotIndex));

  const byGame = new Map<string, (ReceiptRefereeInput | null)[]>();
  for (const r of rows) {
    const expenses: ReceiptExpenses | null =
      r.hasExpenses == null
        ? null
        : {
            travelMode: travelModeFromDb(r.mode),
            km: r.km,
            perDiemCents: r.perDiemCents,
            otherCents: r.otherCents,
            otherLabel: r.otherLabel,
          };
    // Je Platz: Platz 0 links, Platz 1 rechts, auch wenn Platz 0 leer ist.
    const list = byGame.get(r.gameId) ?? [null, null];
    list[r.slot] = { name: r.name, expenses };
    byGame.set(r.gameId, list);
  }

  const views: ReceiptView[] = [];
  for (const g of games) {
    const [rates, fee] = await Promise.all([
      resolveKmRates(g.kickoff),
      resolveLeagueFee(g.leagueId, g.kickoff),
    ]);
    const refs = byGame.get(g.id) ?? [null, null];
    views.push(
      buildReceiptView(
        {
          leagueLabel: g.leagueLabel || g.leagueName,
          home: g.home,
          away: g.away,
          kickoff: g.kickoff,
          venue: g.venue,
        },
        [refs[0] ?? null, refs[1] ?? null],
        rates,
        fee,
      ),
    );
  }
  return views;
};

/** Die Quittung eines Spiels; `null`, wenn der Nutzer nicht auf Platz 0/1 steht oder das Spiel abgesagt ist. */
export const loadReceiptView = async (
  userId: string,
  gameId: string,
): Promise<ReceiptView | null> => {
  const [game] = await db
    .select(gameColumns)
    .from(schema.games)
    .innerJoin(schema.leagues, eq(schema.leagues.id, schema.games.leagueId))
    .innerJoin(
      schema.assignments,
      and(
        eq(schema.assignments.gameId, schema.games.id),
        eq(schema.assignments.refereeId, userId),
        lte(schema.assignments.slotIndex, 1),
      ),
    )
    .where(and(eq(schema.games.id, gameId), ne(schema.games.state, 'cancelled')));
  if (!game) return null;
  const [view] = await buildViews([game]);
  return view ?? null;
};

/** Ende des Kalendertags `YYYY-MM-DD` ausschliesslich, in Vereinszeit. */
const dayAfter = (day: string): Date => {
  const next = new Date(`${day}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return localToUtc(`${next.toISOString().slice(0, 10)}T00:00`, CLUB.timeZone);
};

/**
 * Quittungen eines Nutzers fuer einen Zeitraum, nach Anpfiff aufsteigend.
 * Nur vergangene Spiele auf Platz 0/1, abgesagte Spiele fehlen.
 */
export const loadReceiptViews = async (
  userId: string,
  period: ReceiptPeriod,
  now = new Date(),
): Promise<ReceiptView[]> => {
  const from = localToUtc(`${period.von}T00:00`, CLUB.timeZone);
  const to = dayAfter(period.bis);
  const games = await db
    .select(gameColumns)
    .from(schema.games)
    .innerJoin(schema.leagues, eq(schema.leagues.id, schema.games.leagueId))
    .innerJoin(
      schema.assignments,
      and(
        eq(schema.assignments.gameId, schema.games.id),
        eq(schema.assignments.refereeId, userId),
        lte(schema.assignments.slotIndex, 1),
      ),
    )
    .where(
      and(
        ne(schema.games.state, 'cancelled'),
        gte(schema.games.kickoff, from),
        lt(schema.games.kickoff, to),
        lte(schema.games.kickoff, now),
      ),
    )
    .orderBy(asc(schema.games.kickoff), asc(schema.games.id));
  return buildViews(games);
};
