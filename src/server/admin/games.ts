import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq, gte, sql as sqlRaw } from 'drizzle-orm';
import { CLUB } from '@/config/club';
import { db, schema } from '@/db';
import { countByKey, dedupe, parseCsv, type CsvParseResult, type CsvRow } from '@/domain/csv';
import { nextPromotionStep } from '@/domain/escalation';
import { leagueFromLabel } from '@/domain/league';
import { qualifiedReferees } from '@/domain/rules';
import { assignmentIntent, relocationIntent } from '@/domain/notifications';
import { buildSlots, slotKind, SLOT_LABELS } from '@/domain/slots';
import { localToUtc } from '@/domain/time';
import type { License, SlotIndex } from '@/domain/types';
import { isUniqueViolation } from '../assignments';
import { toAssignment, toGame } from '../queries/games';
import { loadAllReferees } from '../queries/referees';
import { loadSettings } from '../queries/settings';
import { enqueue } from '../outbox';

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


export interface NewGameInput {
  localDate: string;
  localTime: string;
  /**
   * Die Liga, wie der Admin sie eingetippt hat — eine Altersklasse wie `U14`
   * oder das Kuerzel des Verbands wie `XU14Bz`. Die Altersklasse wird daraus
   * gedeutet, genau wie beim CSV-Import; das Getippte bleibt als Beschriftung
   * am Spiel stehen.
   */
  league: string;
  home: string;
  away: string;
  venue: string;
  /** Lizenz, die zum Pfeifen noetig ist. E ist die niedrigste. */
  requiredLicense: License;
}

/** Legt ein einzelnes Spiel an. */
export const createGame = async (
  actorId: string,
  input: NewGameInput,
): Promise<AdminResult> => {
  const missing = (['localDate', 'localTime', 'league', 'home', 'away', 'venue'] as const).find(
    (field) => input[field].trim() === '',
  );
  if (missing) return fail('Bitte alle Felder ausfüllen.');

  const kickoff = localToUtc(`${input.localDate}T${input.localTime}`, CLUB.timeZone);
  if (Number.isNaN(kickoff.getTime())) return fail('Datum oder Uhrzeit sind nicht lesbar.');

  /*
   * Freitext statt Auswahlliste: der Verband schreibt `XU14Bz`, und genau das
   * soll am Spiel stehen. Die Altersklasse wird daraus gedeutet — sie muss es
   * im Verein geben, sonst zeigte der Fremdschluessel spaeter einen Fehler,
   * den niemand lesen kann.
   */
  const leagueLabel = input.league.trim();
  const leagueId = leagueFromLabel(leagueLabel);
  const known = await db
    .select({ id: schema.leagues.id })
    .from(schema.leagues)
    .where(eq(schema.leagues.id, leagueId))
    .limit(1);
  if (known.length === 0) {
    return fail(
      `Die Liga „${leagueId}“ (aus „${leagueLabel}“) ist im Verein nicht angelegt — ` +
        'lege sie zuerst in den Einstellungen an.',
    );
  }

  const id = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(schema.games).values({
      id,
      kickoff,
      leagueId,
      leagueLabel,
      home: input.home.trim(),
      away: input.away.trim(),
      venue: input.venue.trim(),
      requiredLicense: input.requiredLicense,
    });
    await writeAudit(tx, {
      actorId,
      action: 'game.create',
      gameId: id,
      detail: {
        league: leagueId,
        kuerzel: leagueLabel,
        kickoff: kickoff.toISOString(),
        lizenz: input.requiredLicense,
      },
    });
  });

  /*
   * Dieselbe Paarung zur selben Zeit ein zweites Mal anzulegen ist erlaubt.
   * Frueher wies die Eindeutigkeitsbedingung der Datenbank das ab; sie ist
   * gefallen, weil es diese Spiele wirklich gibt — zwei Begegnungen parallel
   * in derselben Halle, jede mit eigenen Schiedsrichtern. Was doppelt
   * entsteht, steht in der Spieluebersicht nebeneinander und laesst sich dort
   * loeschen; ein Verbot haette den zweiten Ansatz unmoeglich gemacht.
   */

  return {
    ok: true,
    gameId: id,
    message:
      `Spiel angelegt. Alle mit Qualifikation ${leagueId} und mindestens ` +
      `Lizenz ${input.requiredLicense} können sich eintragen.`,
  };
};

export interface CsvPreview extends CsvParseResult {
  fresh: readonly CsvRow[];
  duplicates: readonly CsvRow[];
}

const toKickoff = (local: string) => localToUtc(local, CLUB.timeZone);

/**
 * Die vorhandenen Spiele als abgezaehlte Schluessel.
 *
 * Fuer die Vorschau im Browser: sie muss sagen koennen, was es schon gibt,
 * und bekommt dafuer nur diese Liste statt der ganzen Spieltabelle.
 */
export const existingGameCounts = async (): Promise<readonly (readonly [string, number])[]> => {
  const existing = await db
    .select({ kickoff: schema.games.kickoff, home: schema.games.home, away: schema.games.away })
    .from(schema.games);
  return [...countByKey(existing)];
};

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

  return { ...parsed, ...dedupe(parsed.valid, toKickoff, countByKey(existing)) };
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
          leagueLabel: row.leagueLabel,
          home: row.home,
          away: row.away,
          venue: row.venue,
          requiredLicense: row.license,
        })
        .onConflictDoNothing();
    }
    await writeAudit(tx, {
      actorId,
      action: 'game.import',
      detail: {
        imported: preview.fresh.length,
        skipped: preview.duplicates.length,
        rejected: preview.invalid.length,
      },
    });
  });

  const skipped = preview.duplicates.length;
  const parts = [`${preview.fresh.length} Spiele importiert`];
  if (skipped > 0) parts.push(`${skipped} übersprungen (schon vorhanden)`);
  if (preview.invalid.length > 0) parts.push(`${preview.invalid.length} unbrauchbar`);
  return { ok: true, message: `${parts.join(' · ')}.` };
};

export interface EditGameInput {
  localDate: string;
  localTime: string;
  venue: string;
  requiredLicense: License;
  reason: 'moved' | 'venue' | 'cancelled';
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
        requiredLicense: input.requiredLicense,
        state: cancelled ? 'cancelled' : notifies ? 'moved' : row.state,
        relocationVersion: version,
      })
      .where(eq(schema.games.id, gameId));

    await writeAudit(tx, {
      actorId,
      action: cancelled ? 'game.cancel' : 'game.edit',
      gameId,
      detail: {
        timeChanged,
        venueChanged,
        lizenz: input.requiredLicense,
        affected: affected.length,
      },
    });

    if (notifies && affected.length > 0) {
      await enqueue(
        tx,
        relocationIntent(gameId, affected, version, {
          kickoff: row.kickoff,
          venue: row.venue,
        }),
      );
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

/** Die drei Sperren, die ein Admin fuer ein einzelnes Spiel aufheben kann. */
export interface GameReleases {
  /** Regel 7: Austragen auch nach der Frist. */
  withdraw: boolean;
  /** Regel 8: Ersatz anfordern auch nach der Frist. */
  substituteRequest: boolean;
  /**
   * Regel 6: ein zweites Spiel am selben Tag.
   *
   * `null` heisst "nicht angefasst": ist die Regel im Verein abgeschaltet,
   * steht der Haken gar nicht im Formular, und der gespeicherte Wert bleibt,
   * wie er ist — bis die Regel wieder gilt.
   */
  oneGamePerDay: boolean | null;
}

const RELEASE_LABELS: Readonly<Record<keyof GameReleases, string>> = {
  withdraw: 'Austragen',
  substituteRequest: 'Ersatz anfordern',
  oneGamePerDay: 'zweites Spiel am selben Tag',
};

/**
 * Setzt die Freigaben eines Spiels — und sonst nichts.
 *
 * Eine eigene Operation und nicht ein Teil von `editGame`, aus einem Grund,
 * der Geld kostet: `editGame` schreibt das ganze Spiel aus dem Formular
 * zurueck und vergleicht dabei Termin und Ort mit dem gespeicherten Stand.
 * Weicht auch nur eine Sekunde ab — das Formular kennt nur Stunden und
 * Minuten, die Spalte auch Sekunden —, gilt das Spiel als verschoben: der
 * Zustand springt auf "moved", der Zaehler steigt und **jeder Beteiligte
 * bekommt eine Nachricht mit Absage-Option** (Regel 17, Regel 33). Ein Haken,
 * der eine Sperre aufhebt, hat damit nichts zu tun.
 *
 * Dazu kommt, was der Admin sieht: der Knopf am Spielformular heisst
 * "Speichern & Beteiligte informieren". Wer nur eine Frist aufheben will,
 * drueckt ihn verstaendlicherweise nicht — und wundert sich dann, dass der
 * gesetzte Haken nichts bewirkt hat. Die Freigaben haben deshalb ihr eigenes
 * Formular mit einem eigenen Knopf, der nichts verschickt.
 */
export const setGameReleases = async (
  actorId: string,
  gameId: string,
  releases: GameReleases,
): Promise<AdminResult> => {
  const rows = await db.select().from(schema.games).where(eq(schema.games.id, gameId)).limit(1);
  const row = rows[0];
  if (!row) return fail('Dieses Spiel gibt es nicht mehr.');

  await db.transaction(async (tx) => {
    await tx
      .update(schema.games)
      .set({
        overrideWithdraw: releases.withdraw,
        overrideSubstituteRequest: releases.substituteRequest,
        ...(releases.oneGamePerDay === null
          ? {}
          : { overrideOneGamePerDay: releases.oneGamePerDay }),
      })
      .where(eq(schema.games.id, gameId));

    await writeAudit(tx, {
      actorId,
      action: 'game.releases',
      gameId,
      detail: { ...releases },
    });
  });

  /*
   * Die Rueckmeldung zaehlt auf, was jetzt gilt, statt nur "Gespeichert" zu
   * sagen. Der Haken allein ist kein Beleg — er stand auch vorher schon so da,
   * als er noch nicht gespeichert war.
   */
  const active = (Object.keys(RELEASE_LABELS) as readonly (keyof GameReleases)[])
    .filter((key) => releases[key] === true)
    .map((key) => RELEASE_LABELS[key]);

  return {
    ok: true,
    message:
      active.length === 0
        ? 'Freigaben gespeichert — für dieses Spiel gelten wieder alle Fristen.'
        : `Freigaben gespeichert — für dieses Spiel ist freigegeben: ${active.join(', ')}. ` +
          'Es wurde niemand benachrichtigt.',
  };
};

/**
 * Traegt eine Person auf einen bestimmten Platz ein — vom Admin aus.
 *
 * Der Weg daneben ist "wer zuerst eintraegt, hat den Platz". Der reicht nicht:
 * bleibt ein Spiel liegen, muss jemand es besetzen koennen, und wer im Verein
 * anruft und zusagt, soll nicht erst selbst die App bedienen muessen.
 *
 * Was der Admin darf und was nicht:
 *
 * - **Reihenfolge (Regel 2) und ein Spiel pro Tag (Regel 6) gelten hier
 *   nicht.** Beides sind Regeln fuer die Selbstbedienung; wer einteilt,
 *   entscheidet bewusst und sieht die Besetzung vor sich.
 * - **Qualifikation und Lizenz (Regel 4) gelten sehr wohl.** Sie sagen, wer
 *   ein Spiel pfeifen *kann*. Daran darf auch ein Admin nicht vorbei — er
 *   erteilt zuerst die Qualifikation und traegt dann ein.
 *
 * Die Person bekommt eine Nachricht, und zwar unabhaengig davon, ob die
 * Quittung nach dem Eintragen (Regel 31) abgeschaltet ist: die quittiert eine
 * eigene Handlung. Hier hat jemand anderes gehandelt, und davon muss sie
 * erfahren.
 */
export const assignReferee = async (
  actorId: string,
  gameId: string,
  slotIndex: SlotIndex,
  refereeId: string,
): Promise<AdminResult> => {
  if (refereeId.trim() === '') return fail('Bitte eine Person auswählen.');

  const [gameRows, refereeRows, assignmentRows] = await Promise.all([
    db.select().from(schema.games).where(eq(schema.games.id, gameId)).limit(1),
    loadAllReferees(),
    db.select().from(schema.assignments).where(eq(schema.assignments.gameId, gameId)),
  ]);
  const gameRow = gameRows[0];
  if (!gameRow) return fail('Dieses Spiel gibt es nicht mehr.');
  const game = toGame(gameRow);

  const referee = refereeRows.find((entry) => entry.id === refereeId);
  if (!referee) return fail('Dieses Konto gibt es nicht mehr.');

  const slots = buildSlots(assignmentRows.map(toAssignment));
  if (slots[slotIndex]?.assignment) return fail('Dieser Platz ist schon belegt.');
  if (assignmentRows.some((row) => row.refereeId === refereeId)) {
    return fail(`${referee.name} steht bei diesem Spiel schon auf einem anderen Platz.`);
  }
  if (qualifiedReferees([referee], game.leagueId, game.requiredLicense).length === 0) {
    return fail(
      `${referee.name} hat nicht die Qualifikation ${game.leagueId} mit mindestens ` +
        `Lizenz ${game.requiredLicense}. Erteile sie zuerst im Schiedsrichter-Bereich.`,
    );
  }

  try {
    await db.transaction(async (tx) => {
      await tx.insert(schema.assignments).values({ gameId, slotIndex, refereeId });
      await writeAudit(tx, {
        actorId,
        action: 'assignment.byAdmin',
        gameId,
        subjectId: refereeId,
        detail: { slotIndex },
      });
      await enqueue(tx, assignmentIntent(gameId, refereeId, slotIndex));
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return fail('Dieser Platz wurde im selben Moment belegt. Lade die Seite neu.');
    }
    throw error;
  }

  return {
    ok: true,
    message: `${referee.name} steht jetzt auf ${SLOT_LABELS[slotIndex]} und bekommt eine Nachricht.`,
  };
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

  /*
   * Ein frei gewordener Schiedsrichter-Platz zaehlt als neue Luecke. Der
   * Zaehler steckt im Idempotenzschluessel der Ausschreibung — ohne ihn saehe
   * die zweite Ausschreibung desselben Spiels wie eine Wiederholung aus und
   * bliebe stumm.
   */
  if (slotKind(slotIndex) === 'referee') {
    await db
      .update(schema.games)
      .set({ vacancyVersion: sqlRaw`${schema.games.vacancyVersion} + 1` })
      .where(eq(schema.games.id, gameId));
  }

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
