import 'server-only';
import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/db';
import type { TravelMode } from '@/domain/receipt';

/**
 * Fahrt- und Nebenkosten eines Schiedsrichters fuer ein Spiel.
 *
 * Eine Pruefung entscheidet ueber die Berechtigung: nur die Person selbst und
 * Admins schreiben, und nur auf Platz 0 oder 1 eines nicht abgesagten Spiels.
 */

export interface ExpenseActor {
  id: string;
  role: 'referee' | 'admin';
}

/** Werte so, wie sie gespeichert werden; `null` heisst leer. */
export interface ExpenseInput {
  travelMode: TravelMode | null;
  km: number | null;
  perDiemCents: number | null;
  otherCents: number | null;
  otherLabel: string | null;
}

export type ExpenseResult =
  | { readonly ok: true; readonly message: string }
  | { readonly ok: false; readonly message: string };

export const MAX_KM = 2000;
export const MAX_CENTS = 99999;
export const MAX_LABEL = 40;

/** In der Datenbank steht `solo`, `shared` oder `rode`. */
const TO_DB: Record<TravelMode, string> = {
  alone: 'solo',
  with_passenger: 'shared',
  rode_along: 'rode',
};
const FROM_DB: Record<string, TravelMode> = {
  solo: 'alone',
  shared: 'with_passenger',
  rode: 'rode_along',
};

export const travelModeFromDb = (value: string | null): TravelMode | null =>
  value == null ? null : (FROM_DB[value] ?? null);

const fail = (message: string): ExpenseResult => ({ ok: false, message });

const isCents = (v: number | null): boolean =>
  v == null || (Number.isInteger(v) && v >= 0 && v <= MAX_CENTS);

/** Gibt eine Fehlermeldung zurueck, oder `null`, wenn alles passt. */
export const validateExpenses = (input: ExpenseInput): string | null => {
  if (input.travelMode != null && !(input.travelMode in TO_DB))
    return 'Bitte eine gültige Fahrtart wählen.';
  if (input.km != null && !(Number.isInteger(input.km) && input.km >= 0 && input.km <= MAX_KM))
    return `Die Kilometer müssen eine ganze Zahl zwischen 0 und ${MAX_KM} sein.`;
  if (!isCents(input.perDiemCents) || !isCents(input.otherCents))
    return 'Beträge müssen zwischen 0,00 und 999,99 Euro liegen.';
  if (input.otherLabel != null && input.otherLabel.trim().length > MAX_LABEL)
    return `Die Bezeichnung darf höchstens ${MAX_LABEL} Zeichen lang sein.`;
  return null;
};

export const saveExpenses = async (
  actor: ExpenseActor,
  gameId: string,
  refereeId: string,
  input: ExpenseInput,
): Promise<ExpenseResult> => {
  if (actor.id !== refereeId && actor.role !== 'admin')
    return fail('Du darfst nur deine eigenen Angaben ändern.');

  const problem = validateExpenses(input);
  if (problem) return fail(problem);

  const [row] = await db
    .select({ slot: schema.assignments.slotIndex, state: schema.games.state })
    .from(schema.assignments)
    .innerJoin(schema.games, eq(schema.games.id, schema.assignments.gameId))
    .where(and(eq(schema.assignments.gameId, gameId), eq(schema.assignments.refereeId, refereeId)));
  if (!row || row.slot > 1 || row.state === 'cancelled')
    return fail('Für dieses Spiel gibt es keine Angaben zu Fahrt und Kosten.');

  const values = {
    travelMode: input.travelMode == null ? null : TO_DB[input.travelMode],
    km: input.km,
    perDiemCents: input.perDiemCents,
    otherCents: input.otherCents,
    otherLabel: input.otherLabel?.trim() ? input.otherLabel.trim() : null,
    updatedAt: new Date(),
    updatedBy: actor.id,
  };
  try {
    await db
      .insert(schema.assignmentExpenses)
      .values({ gameId, refereeId, ...values })
      .onConflictDoUpdate({
        target: [schema.assignmentExpenses.gameId, schema.assignmentExpenses.refereeId],
        set: values,
      });
  } catch {
    // Die Eintragung fiel zwischen Pruefung und Schreiben weg (Fremdschluessel).
    return fail('Für dieses Spiel gibt es keine Angaben zu Fahrt und Kosten.');
  }
  return { ok: true, message: 'Angaben gespeichert.' };
};

/** Gespeicherte Angaben mehrerer Spiele einer Person, je Spiel-ID. */
export const loadExpensesFor = async (
  refereeId: string,
  gameIds: readonly string[],
): Promise<Map<string, ExpenseInput>> => {
  const result = new Map<string, ExpenseInput>();
  if (gameIds.length === 0) return result;
  const rows = await db
    .select()
    .from(schema.assignmentExpenses)
    .where(
      and(
        eq(schema.assignmentExpenses.refereeId, refereeId),
        inArray(schema.assignmentExpenses.gameId, [...gameIds]),
      ),
    );
  for (const r of rows)
    result.set(r.gameId, {
      travelMode: travelModeFromDb(r.travelMode),
      km: r.km,
      perDiemCents: r.perDiemCents,
      otherCents: r.otherCents,
      otherLabel: r.otherLabel,
    });
  return result;
};
