import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq, gte, lt, ne, sql as sqlRaw } from 'drizzle-orm';
import { db, schema } from '@/db';
import { CLUB } from '@/config/club';
import { assignmentIntent } from '@/domain/notifications';
import { canClaimSlot, canRequestSubstitute, canWithdraw } from '@/domain/rules';
import { buildSlots, nextFreeSlot, slotOf, SLOT_LABELS } from '@/domain/slots';
import { calendarDay, days } from '@/domain/time';
import type { ClubSettings, Game, Referee, Slot, SlotIndex } from '@/domain/types';
import { loadSettings } from './queries/settings';
import { toAssignment, toGame } from './queries/games';
import { loadReferee } from './queries/referees';
import { enqueue } from './outbox';

/**
 * Aenderungen an der Besetzung eines Spiels.
 *
 * Jede Aktion prueft zuerst die Regel-Engine und schreibt dann in einer
 * Transaktion. Die Datenbank ist die letzte Instanz: der Primaerschluessel auf
 * (Spiel, Platz) entscheidet, wer bei zwei gleichzeitigen Eintragungen gewinnt.
 * Die Pruefung davor dient der Erklaerung, nicht der Absicherung.
 */

export type ActionResult =
  | { readonly ok: true; readonly message: string }
  | { readonly ok: false; readonly message: string };

const fail = (message: string): ActionResult => ({ ok: false, message });
const succeed = (message: string): ActionResult => ({ ok: true, message });

/**
 * Verletzung einer Eindeutigkeitsbedingung — jemand war schneller.
 *
 * Der Fehler kommt aus einer Transaktion und ist dabei in einen aeusseren
 * Fehler gewickelt; der Code steckt erst in der Ursachenkette. Wer nur die
 * oberste Ebene prueft, sieht ihn nicht — und der Zweitschnellste bekaeme eine
 * Fehlerseite statt einer Erklaerung.
 */
export const isUniqueViolation = (error: unknown): boolean => {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (typeof current === 'object' && 'code' in current) {
      if ((current as { code?: unknown }).code === '23505') return true;
    }
    current = typeof current === 'object' && 'cause' in current
      ? (current as { cause?: unknown }).cause
      : null;
  }
  return false;
};

interface GameContext {
  game: Game;
  slots: ReturnType<typeof buildSlots>;
  referee: Referee;
  settings: ClubSettings;
  sameDayAssignments: readonly Game[];
}

/**
 * Laedt alles, was die Regel-Engine fuer eine Entscheidung braucht.
 * Gibt null zurueck, wenn Spiel oder Person nicht existieren.
 */
const loadContext = async (gameId: string, refereeId: string): Promise<GameContext | null> => {
  const [gameRows, referee, settings] = await Promise.all([
    db.select().from(schema.games).where(eq(schema.games.id, gameId)).limit(1),
    loadReferee(refereeId),
    loadSettings(),
  ]);
  const gameRow = gameRows[0];
  if (!gameRow || !referee) return null;

  const game = toGame(gameRow);
  const assignmentRows = await db
    .select()
    .from(schema.assignments)
    .where(eq(schema.assignments.gameId, gameId));

  return {
    game,
    slots: buildSlots(assignmentRows.map(toAssignment)),
    referee,
    settings,
    sameDayAssignments: await sameDayGames(refereeId, game),
  };
};

/**
 * Spiele am selben Kalendertag, in denen die Person schon eingetragen ist.
 * Grundlage fuer Regel 6; Ersatzplaetze zaehlen mit.
 */
const sameDayGames = async (refereeId: string, game: Game): Promise<readonly Game[]> => {
  // Ein Zeitfenster von plus/minus einem Tag deckt jeden Kalendertag ab, egal
  // wie die Zeitzone gerade steht; die genaue Tagesgrenze zieht die Regel-Engine.
  const from = new Date(game.kickoff.getTime() - days(1));
  const to = new Date(game.kickoff.getTime() + days(1));

  const rows = await db
    .select({ game: schema.games })
    .from(schema.assignments)
    .innerJoin(schema.games, eq(schema.games.id, schema.assignments.gameId))
    .where(
      and(
        eq(schema.assignments.refereeId, refereeId),
        ne(schema.games.id, game.id),
        gte(schema.games.kickoff, from),
        lt(schema.games.kickoff, to),
      ),
    );
  return rows.map((row) => toGame(row.game));
};

/** Traegt eine Person auf dem naechsten freien Platz ein. Regeln 1-6. */
export const claimNextSlot = async (
  gameId: string,
  refereeId: string,
  now: Date = new Date(),
): Promise<ActionResult> => {
  const context = await loadContext(gameId, refereeId);
  if (!context) return fail('Dieses Spiel gibt es nicht mehr.');

  const target = nextFreeSlot(context.slots);
  if (!target) return fail('Alle vier Plätze sind besetzt.');

  const decision = canClaimSlot({
    ...context,
    slotIndex: target.index,
    now,
    timeZone: CLUB.timeZone,
  });
  if (!decision.allowed) return fail(decision.message);

  try {
    await db.transaction(async (tx) => {
      await tx.insert(schema.assignments).values({
        gameId,
        slotIndex: target.index,
        refereeId,
      });
      await writeAudit(tx, {
        actorId: refereeId,
        action: 'assignment.claim',
        gameId,
        detail: { slotIndex: target.index },
      });
      await enqueue(tx, assignmentIntent(gameId, refereeId, target.index));
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      // Zwischen Pruefung und Schreiben war jemand schneller — genau der Fall,
      // fuer den "wer zuerst eintraegt" gilt.
      return fail(
        'Dieser Platz wurde im selben Moment von jemand anderem belegt. Lade die Seite neu — vielleicht ist noch ein anderer frei.',
      );
    }
    throw error;
  }

  const label = SLOT_LABELS[target.index];
  return succeed(
    target.index < 2
      ? `Eingetragen als ${label}. Die Eintragung ist verbindlich.`
      : `Als ${label} eingetragen.`,
  );
};

/**
 * Zaehlt die Luecken eines Spiels hoch, wenn ein Schiedsrichter-Platz frei wird.
 *
 * Der Zaehler steckt im Idempotenzschluessel der Ausschreibung. Ohne ihn saehe
 * die zweite Ausschreibung desselben Spiels wie eine Wiederholung der ersten
 * aus und bliebe stumm — der Platz waere offen, und niemand erfuehre davon.
 * Ersatzplaetze zaehlen nicht mit: fuer sie wird nichts ausgeschrieben.
 */
const countVacancy = async (writer: Writer, gameId: string, slot: Slot): Promise<void> => {
  if (slot.kind !== 'referee') return;
  await writer
    .update(schema.games)
    .set({ vacancyVersion: sqlRaw`${schema.games.vacancyVersion} + 1` })
    .where(eq(schema.games.id, gameId));
};

/** Traegt eine Person wieder aus. Regel 7. */
export const withdraw = async (
  gameId: string,
  refereeId: string,
  now: Date = new Date(),
): Promise<ActionResult> => {
  const context = await loadContext(gameId, refereeId);
  if (!context) return fail('Dieses Spiel gibt es nicht mehr.');

  const decision = canWithdraw({ ...context, now });
  if (!decision.allowed) return fail(decision.message);

  const own = slotOf(context.slots, refereeId);
  if (!own) return fail('Du bist für dieses Spiel nicht eingetragen.');

  await db.transaction(async (tx) => {
    await tx
      .delete(schema.assignments)
      .where(
        and(eq(schema.assignments.gameId, gameId), eq(schema.assignments.refereeId, refereeId)),
      );
    await countVacancy(tx, gameId, own);
    await writeAudit(tx, {
      actorId: refereeId,
      action: 'assignment.withdraw',
      gameId,
      detail: { slotIndex: own.index },
    });
  });

  return succeed('Ausgetragen — der Platz ist wieder offen und die Admins sind informiert.');
};

/** Bestaetigt die Teilnahme. Regeln 10-12. */
export const confirmAssignment = async (
  gameId: string,
  refereeId: string,
  now: Date = new Date(),
): Promise<ActionResult> => {
  const updated = await db
    .update(schema.assignments)
    .set({ confirmedAt: now })
    .where(
      and(
        eq(schema.assignments.gameId, gameId),
        eq(schema.assignments.refereeId, refereeId),
        lt(schema.assignments.slotIndex, 2),
      ),
    )
    .returning({ slotIndex: schema.assignments.slotIndex });

  if (updated.length === 0) {
    return fail('Für dieses Spiel steht keine Bestätigung von dir aus.');
  }

  await writeAudit(db, {
    actorId: refereeId,
    action: 'assignment.confirm',
    gameId,
    detail: { slotIndex: updated[0]?.slotIndex ?? null },
  });

  return succeed('Bestätigt: „Ja, habe ich gelesen und mache es.“');
};

/** Fordert Ersatz an. Regel 8. */
export const requestSubstitute = async (
  gameId: string,
  refereeId: string,
  now: Date = new Date(),
): Promise<ActionResult> => {
  const context = await loadContext(gameId, refereeId);
  if (!context) return fail('Dieses Spiel gibt es nicht mehr.');

  const decision = canRequestSubstitute({ ...context, now });
  if (!decision.allowed) return fail(decision.message);

  await writeAudit(db, {
    actorId: refereeId,
    action: 'assignment.request-substitute',
    gameId,
    detail: { league: context.game.leagueId },
  });

  return succeed(
    `Ersatz angefordert — alle mit Qualifikation ${context.game.leagueId} bekommen eine Nachricht.`,
  );
};

interface AuditEntry {
  actorId: string | null;
  action: string;
  gameId: string | null;
  detail: Record<string, unknown>;
}

type Writer = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

const writeAudit = async (writer: Writer, entry: AuditEntry): Promise<void> => {
  await writer.insert(schema.auditLog).values({ id: randomUUID(), ...entry });
};


/** Der Platz, auf dem diese Person in diesem Spiel steht — oder null. */
export const ownSlotIndex = (
  slots: ReturnType<typeof buildSlots>,
  refereeId: string,
): SlotIndex | null => slotOf(slots, refereeId)?.index ?? null;

export const calendarDayOf = (game: Game): string => calendarDay(game.kickoff, CLUB.timeZone);

/**
 * Antwort auf eine Verschiebung. Regeln 17-18.
 *
 * „Bleibe dabei“ quittiert den neuen Termin, „Absagen“ gibt den Platz sofort
 * wieder frei. Eine Absage auf einem Schiedsrichter-Platz stoesst die
 * Nachrueck-Kaskade an; die Umsetzung des Versands folgt in Meilenstein 5.
 */
export const respondToRelocation = async (
  gameId: string,
  refereeId: string,
  answer: 'keep' | 'decline',
): Promise<ActionResult> => {
  const context = await loadContext(gameId, refereeId);
  if (!context) return fail('Dieses Spiel gibt es nicht mehr.');

  const own = slotOf(context.slots, refereeId);
  if (!own) return fail('Du bist für dieses Spiel nicht eingetragen.');

  if (answer === 'keep') {
    const rows = await db
      .select({ version: schema.games.relocationVersion })
      .from(schema.games)
      .where(eq(schema.games.id, gameId))
      .limit(1);

    await db
      .update(schema.assignments)
      .set({ acknowledgedRelocation: rows[0]?.version ?? 0 })
      .where(
        and(eq(schema.assignments.gameId, gameId), eq(schema.assignments.refereeId, refereeId)),
      );
    await writeAudit(db, {
      actorId: refereeId,
      action: 'relocation.keep',
      gameId,
      detail: { slotIndex: own.index },
    });
    return succeed('Danke — du bleibst eingetragen.');
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(schema.assignments)
      .where(
        and(eq(schema.assignments.gameId, gameId), eq(schema.assignments.refereeId, refereeId)),
      );
    await countVacancy(tx, gameId, own);
    await writeAudit(tx, {
      actorId: refereeId,
      action: 'relocation.decline',
      gameId,
      detail: { slotIndex: own.index, startsPromotionCascade: own.kind === 'referee' },
    });
  });

  return succeed('Abgesagt — der Platz ist wieder offen und die Admins sind informiert.');
};

/**
 * Ob fuer diese Person zu diesem Spiel eine Rueckmeldung zur Verschiebung
 * aussteht.
 */
export const relocationPending = (
  gameState: Game['state'],
  relocationVersion: number,
  acknowledged: number,
): boolean => gameState === 'moved' && relocationVersion > acknowledged;
