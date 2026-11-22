import 'server-only';
import { and, desc, eq, lte, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import type { KmRates } from '@/domain/receipt';

/**
 * Kilometersaetze und Ligagebuehren als Verlauf.
 *
 * Ein Eintrag gilt ab `valid_from`; fuer ein Spiel zaehlt der juengste Eintrag
 * vor dem Anpfiff. Gespeichert wird nur, wenn sich ein Wert aendert.
 */

/** Gelten, solange kein Admin je einen Satz gespeichert hat. */
export const DEFAULT_KM_RATES: KmRates = { soloCents: 30, sharedCents: 32 };

const MAX_RATE_CENTS = 999;
const MAX_FEE_CENTS = 99999;

export type RateResult =
  | { readonly ok: true; readonly changed: boolean }
  | { readonly ok: false; readonly message: string };

const isCents = (v: number, max: number): boolean => Number.isInteger(v) && v >= 0 && v <= max;

/** Die Saetze, die zum Anpfiff galten. */
export const resolveKmRates = async (kickoff: Date): Promise<KmRates> => {
  const [row] = await db
    .select({ soloCents: schema.kmRates.soloCents, sharedCents: schema.kmRates.sharedCents })
    .from(schema.kmRates)
    .where(lte(schema.kmRates.validFrom, kickoff))
    .orderBy(desc(schema.kmRates.validFrom))
    .limit(1);
  return row ?? DEFAULT_KM_RATES;
};

/** Die Gebuehr der Liga zum Anpfiff in Cent, `null` ohne gueltige Gebuehr. */
export const resolveLeagueFee = async (leagueId: string, kickoff: Date): Promise<number | null> => {
  const [row] = await db
    .select({ feeCents: schema.leagueFees.feeCents })
    .from(schema.leagueFees)
    .where(and(eq(schema.leagueFees.leagueId, leagueId), lte(schema.leagueFees.validFrom, kickoff)))
    .orderBy(desc(schema.leagueFees.validFrom))
    .limit(1);
  return row?.feeCents ?? null;
};

/** Der aktuell juengste Satz, ungeachtet der Zeit; ohne Eintrag die Standardwerte. */
export const currentKmRates = async (): Promise<KmRates> => {
  const [row] = await db
    .select({ soloCents: schema.kmRates.soloCents, sharedCents: schema.kmRates.sharedCents })
    .from(schema.kmRates)
    .orderBy(desc(schema.kmRates.validFrom))
    .limit(1);
  return row ?? DEFAULT_KM_RATES;
};

/** Die aktuell juengste Gebuehr je Liga (nur Ligen mit Gebuehr), in Cent. */
export const currentLeagueFees = async (): Promise<Map<string, number>> => {
  const rows = await db
    .selectDistinctOn([schema.leagueFees.leagueId], {
      leagueId: schema.leagueFees.leagueId,
      feeCents: schema.leagueFees.feeCents,
    })
    .from(schema.leagueFees)
    .orderBy(schema.leagueFees.leagueId, desc(schema.leagueFees.validFrom));
  const fees = new Map<string, number>();
  for (const r of rows) if (r.feeCents != null) fees.set(r.leagueId, r.feeCents);
  return fees;
};

/** Speichert neue Kilometersaetze, ab `now`; unveraenderte Werte legen nichts an. */
export const saveKmRates = async (rates: KmRates, now = new Date()): Promise<RateResult> => {
  if (!isCents(rates.soloCents, MAX_RATE_CENTS) || !isCents(rates.sharedCents, MAX_RATE_CENTS))
    return { ok: false, message: 'Die Kilometersätze müssen zwischen 0,00 und 9,99 Euro liegen.' };
  const current = await currentKmRates();
  if (current.soloCents === rates.soloCents && current.sharedCents === rates.sharedCents)
    return { ok: true, changed: false };
  await db
    .insert(schema.kmRates)
    .values({ validFrom: now, ...rates })
    .onConflictDoUpdate({
      target: schema.kmRates.validFrom,
      set: { soloCents: rates.soloCents, sharedCents: rates.sharedCents },
    });
  return { ok: true, changed: true };
};

/**
 * Speichert die Gebuehr einer Liga, ab `now`; `null` leert sie.
 * Die erste Gebuehr einer Liga gilt ab `-infinity`, also auch fuer fruehere
 * Spiele; ohne Gebuehr und ohne Eintrag wird nichts angelegt.
 */
export const saveLeagueFee = async (
  leagueId: string,
  feeCents: number | null,
  now = new Date(),
): Promise<RateResult> => {
  if (feeCents != null && !isCents(feeCents, MAX_FEE_CENTS))
    return { ok: false, message: 'Die Gebühr muss zwischen 0,00 und 999,99 Euro liegen.' };
  const [latest] = await db
    .select({ feeCents: schema.leagueFees.feeCents })
    .from(schema.leagueFees)
    .where(eq(schema.leagueFees.leagueId, leagueId))
    .orderBy(desc(schema.leagueFees.validFrom))
    .limit(1);
  if (!latest && feeCents == null) return { ok: true, changed: false };
  if (latest && latest.feeCents === feeCents) return { ok: true, changed: false };

  const validFrom = latest ? now : sql`'-infinity'::timestamptz`;
  await db
    .insert(schema.leagueFees)
    .values({ leagueId, validFrom, feeCents })
    .onConflictDoUpdate({
      target: [schema.leagueFees.leagueId, schema.leagueFees.validFrom],
      set: { feeCents },
    });
  return { ok: true, changed: true };
};
