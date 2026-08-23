import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq, gte } from 'drizzle-orm';
import { CLUB } from '@/config/club';
import { db, schema } from '@/db';
import { dedupe, gameKey, parseCsv, type CsvParseResult, type CsvRow } from '@/domain/csv';
import { nextPromotionStep } from '@/domain/escalation';
import { relocationIntent, type NotificationIntent } from '@/domain/notifications';
import { buildSlots, SLOT_LABELS } from '@/domain/slots';
import { localToUtc } from '@/db/seed-data';
import type { SlotIndex } from '@/domain/types';
import { isUniqueViolation } from '../assignments';
import { toAssignment, toGame } from '../queries/games';
import { loadSettings } from '../queries/settings';

/**
 * Spielverwaltung im Adminbereich.
 *
 * Jede Aenderung schreibt einen Eintrag ins Pruefprotokoll und legt die
 * faelligen Nachrichten in die Outbox — beides in derselben Transaktion wie die
 * Aenderung selbst, damit nichts auseinanderlaufen kann.
 */

export type AdminResult =
  | { readonly ok: true; readonly message: string; readonly gameId?: string }
  | { readonly ok: false; readonly message: string };

const fail = (message: string): AdminResult => ({ ok: false, message });

type Writer = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

const writeAudit = async (
  writer: Writer,
  entry: {
    actorId: string;
    action: string;
    gameId?: string | null;
    subjectId?: string | null;
    detail: Record<string, unknown>;
  },
): Promise<void> => {
  await writer.insert(schema.auditLog).values({ id: randomUUID(), ...entry });
};

const queue = async (writer: Writer, intent: NotificationIntent): Promise<void> => {
  for (const recipientId of intent.recipientIds) {
    await writer
      .insert(schema.notificationOutbox)
      .values({
        id: randomUUID(),
        key: intent.key,
        kind: intent.kind,
        channel: 'dev',
        recipientId,
        gameId: intent.gameId,
        payload: {},
      })
      .onConflictDoNothing();
  }
};

export interface NewGameInput {
  localDate: string;
  localTime: string;
  leagueId: string;
  home: string;
  away: string;
  venue: string;
}

/** Legt ein einzelnes Spiel an. */
export const createGame = async (
  actorId: string,
  input: NewGameInput,
): Promise<AdminResult> => {
  const missing = (['localDate', 'localTime', 'leagueId', 'home', 'away', 'venue'] as const).find(
    (field) => input[field].trim() === '',
  );
  if (missing) return fail('Bitte alle Felder ausfüllen.');

  const kickoff = localToUtc(`${input.localDate}T${input.localTime}`, CLUB.timeZone);
  if (Number.isNaN(kickoff.getTime())) return fail('Datum oder Uhrzeit sind nicht lesbar.');

  const id = randomUUID();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(schema.games).values({
        id,
        kickoff,
        leagueId: input.leagueId,
        home: input.home.trim(),
        away: input.away.trim(),
        venue: input.venue.trim(),
      });
      await writeAudit(tx, {
        actorId,
        action: 'game.create',
        gameId: id,
        detail: { league: input.leagueId, kickoff: kickoff.toISOString() },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return fail('Dieses Spiel gibt es schon — gleiche Zeit, gleiche Mannschaften.');
    }
    throw error;
  }

  return {
    ok: true,
    gameId: id,
    message: `Spiel angelegt. Alle mit Qualifikation ${input.leagueId} können sich eintragen.`,
  };
};

export interface CsvPreview extends CsvParseResult {
  fresh: readonly CsvRow[];
  duplicates: readonly CsvRow[];
  repeated: readonly CsvRow[];
}

const toKickoff = (local: string) => localToUtc(local, CLUB.timeZone);

/** Liest eine CSV ein und sagt, was daraus entstehen wuerde. */
export const previewCsv = async (text: string): Promise<CsvPreview> => {
  const leagues = await db.select({ id: schema.leagues.id }).from(schema.leagues);
  const parsed = parseCsv(
    text,
    leagues.map((league) => league.id),
  );

  const existing = await db
    .select({ kickoff: schema.games.kickoff, home: schema.games.home, away: schema.games.away })
    .from(schema.games);
  const keys = new Set(existing.map((row) => gameKey(row.kickoff, row.home, row.away)));

  return { ...parsed, ...dedupe(parsed.valid, toKickoff, keys) };
};

/**
 * Importiert eine CSV. Wiederholbar: was es schon gibt, wird uebersprungen,
 * nicht ueberschrieben und nicht doppelt angelegt.
 */
export const importCsv = async (actorId: string, text: string): Promise<AdminResult> => {
  const preview = await previewCsv(text);
  if (preview.fileProblem) return fail(preview.fileProblem);
  if (preview.fresh.length === 0) {
    return {
      ok: true,
      message:
        preview.duplicates.length > 0
          ? `Nichts zu tun — alle ${preview.duplicates.length} Spiele gibt es schon.`
          : 'Keine importierbaren Zeilen gefunden.',
    };
  }

  await db.transaction(async (tx) => {
    for (const row of preview.fresh) {
      if (row.localKickoff === null) continue;
      await tx
        .insert(schema.games)
        .values({
          id: randomUUID(),
          kickoff: toKickoff(row.localKickoff),
          leagueId: row.league,
          home: row.home,
          away: row.away,
          venue: row.venue,
        })
        .onConflictDoNothing();
    }
    await writeAudit(tx, {
      actorId,
      action: 'game.import',
      detail: {
        imported: preview.fresh.length,
        skipped: preview.duplicates.length + preview.repeated.length,
        rejected: preview.invalid.length,
      },
    });
  });

  const skipped = preview.duplicates.length + preview.repeated.length;
  const parts = [`${preview.fresh.length} Spiele importiert`];
  if (skipped > 0) parts.push(`${skipped} übersprungen (schon vorhanden)`);
  if (preview.invalid.length > 0) parts.push(`${preview.invalid.length} unbrauchbar`);
  return { ok: true, message: `${parts.join(' · ')}.` };
};

export interface EditGameInput {
  localDate: string;
  localTime: string;
  venue: string;
  reason: 'moved' | 'venue' | 'cancelled';
  overrideWithdraw: boolean;
  overrideSubstituteRequest: boolean;
  overrideOneGamePerDay: boolean;
}

/**
 * Aendert ein Spiel. Regel 17: Schiedsrichter **und** Ersatz erhalten den neuen
 * Termin mit Absage-Option — der Zaehler `relocationVersion` sorgt dafuer, dass
 * die Rueckfrage bei jeder neuen Verschiebung wieder gestellt wird.
 */
export const editGame = async (
  actorId: string,
  gameId: string,
  input: EditGameInput,
): Promise<AdminResult> => {
  const rows = await db.select().from(schema.games).where(eq(schema.games.id, gameId)).limit(1);
  const row = rows[0];
  if (!row) return fail('Dieses Spiel gibt es nicht mehr.');

  const kickoff = localToUtc(`${input.localDate}T${input.localTime}`, CLUB.timeZone);
  if (Number.isNaN(kickoff.getTime())) return fail('Datum oder Uhrzeit sind nicht lesbar.');
  if (input.venue.trim() === '') return fail('Der Ort darf nicht leer sein.');

  const timeChanged = kickoff.getTime() !== row.kickoff.getTime();
  const venueChanged = input.venue.trim() !== row.venue;
  const cancelled = input.reason === 'cancelled';
  const notifies = cancelled || timeChanged || venueChanged;

  const assignments = await db
    .select()
    .from(schema.assignments)
    .where(eq(schema.assignments.gameId, gameId));
  const affected = assignments.map((assignment) => assignment.refereeId);
  const version = notifies ? row.relocationVersion + 1 : row.relocationVersion;

  await db.transaction(async (tx) => {
    await tx
      .update(schema.games)
      .set({
        kickoff,
        venue: input.venue.trim(),
        state: cancelled ? 'cancelled' : notifies ? 'moved' : row.state,
        relocationVersion: version,
        overrideWithdraw: input.overrideWithdraw,
        overrideSubstituteRequest: input.overrideSubstituteRequest,
        overrideOneGamePerDay: input.overrideOneGamePerDay,
      })
      .where(eq(schema.games.id, gameId));

    await writeAudit(tx, {
      actorId,
      action: cancelled ? 'game.cancel' : 'game.edit',
      gameId,
      detail: {
        timeChanged,
        venueChanged,
        affected: affected.length,
        overrides: {
          withdraw: input.overrideWithdraw,
          substituteRequest: input.overrideSubstituteRequest,
          oneGamePerDay: input.overrideOneGamePerDay,
        },
      },
    });

    if (notifies && affected.length > 0) {
      await queue(tx, relocationIntent(gameId, affected, version));
    }
  });

  if (cancelled) {
    return { ok: true, message: `Spiel abgesagt. ${affected.length} Beteiligte werden informiert.` };
  }
  if (notifies) {
    return {
      ok: true,
      message: `Gespeichert. ${affected.length} Beteiligte erhalten den neuen Termin mit Absage-Option.`,
    };
  }
  return { ok: true, message: 'Gespeichert.' };
};

/**
 * Wirft eine Person aus einem Spiel. Regel 13: auf einem Schiedsrichter-Platz
 * beginnt damit die Nachrueck-Kaskade.
 */
export const removeFromGame = async (
  actorId: string,
  gameId: string,
  slotIndex: SlotIndex,
): Promise<AdminResult> => {
  const removed = await db
    .delete(schema.assignments)
    .where(
      and(eq(schema.assignments.gameId, gameId), eq(schema.assignments.slotIndex, slotIndex)),
    )
    .returning({ refereeId: schema.assignments.refereeId });

  const refereeId = removed[0]?.refereeId;
  if (!refereeId) return fail('Dieser Platz war nicht belegt.');

  const [remaining, gameRows, settings] = await Promise.all([
    db.select().from(schema.assignments).where(eq(schema.assignments.gameId, gameId)),
    db.select().from(schema.games).where(eq(schema.games.id, gameId)).limit(1),
    loadSettings(),
  ]);
  const gameRow = gameRows[0];
  if (!gameRow) return fail('Dieses Spiel gibt es nicht mehr.');

  const step = nextPromotionStep({
    game: toGame(gameRow),
    slots: buildSlots(remaining.map(toAssignment)),
    declinedSlots: [],
    settings,
    now: new Date(),
  });

  await writeAudit(db, {
    actorId,
    action: 'assignment.remove',
    gameId,
    subjectId: refereeId,
    detail: { slotIndex, next: step.kind },
  });

  const label = SLOT_LABELS[slotIndex];
  if (step.kind === 'offer') {
    return {
      ok: true,
      message: `${label} entfernt. Der Ersatz wird gefragt, ob er nachrückt.`,
    };
  }
  if (step.kind === 'announce') {
    return { ok: true, message: `${label} entfernt. Der Platz wird ausgeschrieben.` };
  }
  return { ok: true, message: `${label} entfernt und die Person informiert.` };
};

/** Erinnerung an alle offenen Spiele. Regel 32. */
export const nudgeOpenGames = async (actorId: string): Promise<AdminResult> => {
  const now = new Date();
  const games = await db
    .select()
    .from(schema.games)
    .where(gte(schema.games.kickoff, now));
  const assignments = await db.select().from(schema.assignments);

  const open = games.filter((game) => {
    if (game.state === 'cancelled') return false;
    const taken = assignments.filter(
      (assignment) => assignment.gameId === game.id && assignment.slotIndex < 2,
    );
    return taken.length < 2;
  });

  await writeAudit(db, {
    actorId,
    action: 'game.nudge',
    detail: { games: open.length },
  });

  return open.length === 0
    ? { ok: true, message: 'Zurzeit ist kein Spiel ohne zwei Schiedsrichter.' }
    : {
        ok: true,
        message: `Erinnerung für ${open.length} offene Spiele vorgemerkt — alle Qualifizierten werden angeschrieben.`,
      };
};
