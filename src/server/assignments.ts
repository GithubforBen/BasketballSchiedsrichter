import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq, gt, gte, lt, ne, sql as sqlRaw } from 'drizzle-orm';
import { db, schema } from '@/db';
import { CLUB } from '@/config/club';
import { assignmentIntent, promotionOfferIntent } from '@/domain/notifications';
import {
  canClaimSlot,
  canRequestSubstitute,
  canWithdraw,
  handoverSlot,
  nextSubstituteToAsk,
} from '@/domain/rules';
import { buildSlots, nextFreeSlot, slotOf, SLOT_LABELS } from '@/domain/slots';

/** Die beiden Ersatzplaetze. Regel 1. */
const SUBSTITUTE_FIRST = 2;
const SUBSTITUTE_SECOND = 3;
import { promotionResponseWindowMs } from '@/domain/escalation';
import { days } from '@/domain/time';
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
      /*
       * Regel 31, aber abschaltbar: die Quittung bestaetigt nur die eigene
       * Handlung, die der Bildschirm ohnehin schon quittiert hat. Ein Verein
       * mit knappem Nachrichtenbudget schaltet sie im Adminbereich ab
       * (Vorlage 2).
       */
      if (context.settings.assignmentReceipt) {
        await enqueue(tx, assignmentIntent(gameId, refereeId, target.index));
      }
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

/**
 * Bestaetigt die Teilnahme. Regeln 10-12.
 *
 * `via` haelt fest, **woher** die Bestaetigung kam: aus dem Kalender oder ueber
 * den eindeutigen Link einer bestimmten Nachricht. Damit laesst sich im
 * Pruefprotokoll nachlesen, auf welche Bitte hin bestaetigt wurde — und nicht
 * nur, dass irgendwann bestaetigt wurde.
 */
export const confirmAssignment = async (
  gameId: string,
  refereeId: string,
  now: Date = new Date(),
  via: string | null = null,
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
    detail: { slotIndex: updated[0]?.slotIndex ?? null, via },
  });

  return succeed('Bestätigt: „Ja, habe ich gelesen und mache es.“');
};

/**
 * Regel 8: Ersatz anfordern — das Spiel abgeben.
 *
 * Der Knopf tut jetzt etwas anderes als frueher. Bisher rief er weitere Leute
 * auf, sich als Ersatz **einzutragen**, solange ein Ersatzplatz frei war; dem
 * Anfragenden half das nicht, er stand danach weiterhin auf seinem Platz.
 *
 * Jetzt fragt er den vordersten eingetragenen Ersatz, ob er das Spiel
 * **uebernimmt**, und zwar genau einen — nicht alle gleichzeitig. Sonst
 * koennten zwei zusagen, und einer von beiden stuende umsonst in der Halle.
 * Wer absagt, verlaesst die Bank, der naechste rueckt auf und wird gefragt.
 *
 * Zwei Wege fuehren hierher:
 *
 * - **Der Eingeteilte selbst.** Abgegeben wird sein Platz. Er bleibt darauf
 *   stehen, bis jemand zusagt — ein Spiel, das zwischendurch unbesetzt
 *   dasteht, waere schlechter als eines mit einem Schiedsrichter, der noch
 *   sucht.
 * - **Der Admin.** Er hat den Platz vorher geraeumt; abgegeben wird der erste
 *   leere Schiedsrichter-Platz.
 */
export const requestSubstitute = async (
  gameId: string,
  actorId: string,
  now: Date = new Date(),
): Promise<ActionResult> => {
  const context = await loadContext(gameId, actorId);
  if (!context) return fail('Dieses Spiel gibt es nicht mehr.');

  const decision = canRequestSubstitute({
    ...context,
    now,
    pendingRequest: await hasPendingOffer(gameId, now),
  });
  if (!decision.allowed) return fail(decision.message);

  const target = handoverSlot(context.slots, context.referee);
  const substitute = nextSubstituteToAsk(context.slots);
  /* Beides hat `canRequestSubstitute` schon geprueft — hier nur fuer den Typ. */
  if (!target || !substitute?.assignment) return fail('Für dieses Spiel ist keine Anfrage möglich.');

  const asked = await askSubstitute(
    {
      game: context.game,
      settings: context.settings,
      targetSlot: target.index,
      substitute,
      replacesRefereeId: target.assignment?.refereeId ?? null,
      requestedBy: actorId,
    },
    now,
  );

  const name = await nameOf(asked.refereeId);
  return succeed(
    `${name} ist gefragt, ob er ${SLOT_LABELS[target.index]} übernimmt. ` +
      'Bis zur Antwort bleibt die Besetzung, wie sie ist.',
  );
};

/** Laeuft schon eine Anfrage fuer dieses Spiel? Dann geht keine zweite raus. */
const hasPendingOffer = async (gameId: string, now: Date): Promise<boolean> => {
  const rows = await db
    .select({ id: schema.promotionOffers.id })
    .from(schema.promotionOffers)
    .where(
      and(
        eq(schema.promotionOffers.gameId, gameId),
        eq(schema.promotionOffers.outcome, 'pending'),
        gt(schema.promotionOffers.respondBy, now),
      ),
    )
    .limit(1);
  return rows.length > 0;
};

const nameOf = async (refereeId: string): Promise<string> => {
  const referee = await loadReferee(refereeId);
  return referee?.firstName?.trim() || referee?.name || 'Der Ersatz';
};

interface AskInput {
  game: Game;
  settings: ClubSettings;
  targetSlot: SlotIndex;
  substitute: Slot;
  /** Wer den Platz raeumt, sobald zugesagt wird. null = er ist schon leer. */
  replacesRefereeId: string | null;
  requestedBy: string;
}

/**
 * Stellt die Frage an genau einen Ersatz und legt die Nachricht in die Outbox.
 *
 * Anfrage und Nachricht entstehen in derselben Transaktion: eine Anfrage ohne
 * Nachricht wartet auf eine Antwort, die niemand geben kann, weil niemand
 * gefragt wurde — und sie blockiert dabei die naechste.
 */
const askSubstitute = async (
  input: AskInput,
  now: Date,
): Promise<{ offerId: string; refereeId: string }> => {
  const assignment = input.substitute.assignment;
  if (!assignment) throw new Error('Der Ersatzplatz ist nicht belegt.');

  const offerId = randomUUID();
  const respondBy = new Date(
    now.getTime() + promotionResponseWindowMs(input.game, input.settings, now),
  );

  await db.transaction(async (tx) => {
    await tx.insert(schema.promotionOffers).values({
      id: offerId,
      gameId: input.game.id,
      kind: 'handover',
      targetSlot: input.targetSlot,
      substituteSlot: input.substitute.index,
      refereeId: assignment.refereeId,
      replacesRefereeId: input.replacesRefereeId,
      requestedBy: input.requestedBy,
      respondBy,
    });
    await writeAudit(tx, {
      actorId: input.requestedBy,
      action: 'assignment.request-substitute',
      gameId: input.game.id,
      detail: {
        offerId,
        targetSlot: input.targetSlot,
        substituteSlot: input.substitute.index,
        asked: assignment.refereeId,
        replaces: input.replacesRefereeId,
      },
    });
    await enqueue(
      tx,
      promotionOfferIntent(
        offerId,
        input.game.id,
        assignment.refereeId,
        input.targetSlot,
        respondBy,
        'handover',
      ),
    );
  });

  return { offerId, refereeId: assignment.refereeId };
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
  via: string | null = null,
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
      detail: { slotIndex: own.index, via },
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
      detail: { slotIndex: own.index, startsPromotionCascade: own.kind === 'referee', via },
    });
  });

  return succeed('Abgesagt — der Platz ist wieder offen und die Admins sind informiert.');
};

/**
 * Antwort auf eine Nachrueck-Anfrage. Regeln 13-16.
 *
 * Die Anfrage selbst ist der Vorgang: geantwortet wird auf **eine** Anfrage und
 * nicht auf "das Spiel". Wird dieselbe Person spaeter erneut gefragt, ist das
 * eine neue Anfrage mit eigener Id — die alte Antwort kann die neue Frage nicht
 * beantworten.
 *
 * Beim Nachruecken wandert die Eintragung vom Ersatz- auf den
 * Schiedsrichter-Platz. Der Zeitpunkt der Eintragung wird dabei auf jetzt
 * gesetzt: die Pflichtbestaetigung (Regel 10) soll ab dem Nachruecken laufen
 * und nicht ab dem Tag, an dem sich die Person als Ersatz eingetragen hat —
 * sonst waere sie im selben Augenblick ueberfaellig, in dem sie entsteht.
 */
export const respondToPromotion = async (
  offerId: string,
  refereeId: string,
  answer: 'accept' | 'decline',
  now: Date = new Date(),
  via: string | null = null,
): Promise<ActionResult> => {
  const offers = await db
    .select()
    .from(schema.promotionOffers)
    .where(eq(schema.promotionOffers.id, offerId))
    .limit(1);
  const offer = offers[0];
  if (!offer || offer.refereeId !== refereeId) {
    return fail('Diese Anfrage gibt es nicht mehr.');
  }
  if (offer.outcome !== 'pending') {
    return fail(
      offer.outcome === 'accepted'
        ? 'Diese Anfrage hast du bereits angenommen.'
        : 'Diese Anfrage ist abgeschlossen.',
    );
  }
  if (now.getTime() >= offer.respondBy.getTime()) {
    return fail('Die Antwortfrist für diese Anfrage ist verstrichen.');
  }

  if (answer === 'decline') {
    return offer.kind === 'handover'
      ? declineHandover(offer, refereeId, now, via)
      : declineVacancy(offer, refereeId, via);
  }

  const context = await loadContext(offer.gameId, refereeId);
  if (!context) return fail('Dieses Spiel gibt es nicht mehr.');
  if (context.game.state === 'cancelled') return fail('Dieses Spiel ist abgesagt.');
  if (context.game.kickoff.getTime() <= now.getTime()) {
    return fail('Dieses Spiel ist bereits angepfiffen.');
  }

  const target = slotOf(context.slots, refereeId);
  if (!target || target.index !== offer.substituteSlot) {
    return fail('Du stehst nicht mehr auf dem Ersatzplatz dieser Anfrage.');
  }

  /*
   * Wer auf dem Zielplatz steht, entscheidet ueber Annahme oder Absage.
   *
   * Bei einer Abgabe ("Ersatz anfordern") steht dort noch der, der abgibt —
   * genau deshalb ist die Anfrage gestellt worden, und er raeumt den Platz
   * jetzt. Bei der Kaskade nach einem Austritt ist der Platz leer. In beiden
   * Faellen gilt: steht dort jemand **anderes**, war jemand schneller (Regel
   * 3), und die Anfrage hat sich erledigt.
   */
  const occupant = context.slots[offer.targetSlot]?.assignment?.refereeId ?? null;
  const leaves = offer.kind === 'handover' ? offer.replacesRefereeId : null;
  if (occupant !== null && occupant !== leaves) {
    await db
      .update(schema.promotionOffers)
      .set({ outcome: 'declined' })
      .where(eq(schema.promotionOffers.id, offerId));
    return fail('Der Platz ist inzwischen besetzt. Du bleibst auf deinem Ersatzplatz.');
  }

  try {
    await db.transaction(async (tx) => {
      /*
       * Erst raeumen, dann nachruecken — nicht umgekehrt. Der
       * Primaerschluessel steht auf (Spiel, Platz): waere der Abgebende noch
       * da, koennte niemand auf denselben Platz.
       */
      if (leaves !== null && occupant === leaves) {
        await tx
          .delete(schema.assignments)
          .where(
            and(
              eq(schema.assignments.gameId, offer.gameId),
              eq(schema.assignments.refereeId, leaves),
            ),
          );
      }
      await tx
        .update(schema.assignments)
        .set({ slotIndex: offer.targetSlot, claimedAt: now, confirmedAt: null })
        .where(
          and(
            eq(schema.assignments.gameId, offer.gameId),
            eq(schema.assignments.refereeId, refereeId),
          ),
        );
      await tx
        .update(schema.promotionOffers)
        .set({ outcome: 'accepted' })
        .where(eq(schema.promotionOffers.id, offerId));
      await writeAudit(tx, {
        actorId: refereeId,
        action: 'promotion.accept',
        gameId: offer.gameId,
        detail: {
          offerId,
          kind: offer.kind,
          targetSlot: offer.targetSlot,
          from: offer.substituteSlot,
          replaced: leaves,
          via,
        },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return fail('Der Platz wurde im selben Moment besetzt. Du bleibst auf deinem Ersatzplatz.');
    }
    throw error;
  }

  const label = SLOT_LABELS[offer.targetSlot as SlotIndex];
  return succeed(`Du bist nachgerückt und stehst jetzt als ${label}. Die Eintragung ist verbindlich.`);
};

type PromotionOfferRow = typeof schema.promotionOffers.$inferSelect;

/**
 * Absage auf eine Kaskaden-Anfrage (Regeln 13-16).
 *
 * Hier ist nichts weiter zu tun: der Platz war schon vorher frei, und wer
 * nicht nachruecken will, bleibt Ersatz. Der naechste wird vom Zeitplan-Lauf
 * gefragt.
 */
const declineVacancy = async (
  offer: PromotionOfferRow,
  refereeId: string,
  via: string | null,
): Promise<ActionResult> => {
  await db
    .update(schema.promotionOffers)
    .set({ outcome: 'declined' })
    .where(eq(schema.promotionOffers.id, offer.id));
  await writeAudit(db, {
    actorId: refereeId,
    action: 'promotion.decline',
    gameId: offer.gameId,
    detail: { offerId: offer.id, kind: offer.kind, targetSlot: offer.targetSlot, via },
  });
  return succeed('Danke für die Rückmeldung — du bleibst auf deinem Ersatzplatz.');
};

/**
 * Absage auf eine Abgabe-Anfrage (Regel 8).
 *
 * Hier bedeutet die Absage mehr als "nein, diesmal nicht". Gefragt wurde, ob
 * die Person an diesem Termin ueberhaupt kann — wer verneint, steht auch als
 * Ersatz nicht zur Verfuegung. Auf der Bank zu bleiben hiesse, bei jedem
 * weiteren Ausfall erneut gefragt zu werden, und bei einem kurzfristigen
 * Nachruecken waere sie die Erste, die einspringen muesste.
 *
 * Also: runter von der Bank, der naechste rueckt auf den frei gewordenen
 * Ersatzplatz und bekommt dieselbe Frage. Erst wenn niemand mehr da ist, endet
 * die Kette — der Abgebende behaelt dann seinen Platz und weiss, dass er ihn
 * selbst besetzen oder den Admin ansprechen muss.
 */
const declineHandover = async (
  offer: PromotionOfferRow,
  refereeId: string,
  now: Date,
  via: string | null,
): Promise<ActionResult> => {
  await db.transaction(async (tx) => {
    await tx
      .update(schema.promotionOffers)
      .set({ outcome: 'declined' })
      .where(eq(schema.promotionOffers.id, offer.id));

    await tx
      .delete(schema.assignments)
      .where(
        and(
          eq(schema.assignments.gameId, offer.gameId),
          eq(schema.assignments.refereeId, refereeId),
        ),
      );

    /*
     * Nachruecken auf der Bank: Ersatz 2 wird Ersatz 1. Die Reihenfolge ist
     * kein Schmuck, sie entscheidet, wer als Naechstes gefragt wird — eine
     * Luecke davor wuerde die Kette abreissen lassen.
     */
    if (offer.substituteSlot === SUBSTITUTE_FIRST) {
      await tx
        .update(schema.assignments)
        .set({ slotIndex: SUBSTITUTE_FIRST })
        .where(
          and(
            eq(schema.assignments.gameId, offer.gameId),
            eq(schema.assignments.slotIndex, SUBSTITUTE_SECOND),
          ),
        );
    }

    await writeAudit(tx, {
      actorId: refereeId,
      action: 'promotion.decline',
      gameId: offer.gameId,
      detail: {
        offerId: offer.id,
        kind: offer.kind,
        targetSlot: offer.targetSlot,
        removedFrom: offer.substituteSlot,
        via,
      },
    });
  });

  const next = await askNextAfterDecline(offer, now);
  return succeed(
    next
      ? 'Danke für die Rückmeldung — du bist aus diesem Spiel raus. Der nächste Ersatz wird gefragt.'
      : 'Danke für die Rückmeldung — du bist aus diesem Spiel raus. Ein weiterer Ersatz steht nicht bereit.',
  );
};

/** Die naechste Frage in derselben Kette — oder null, wenn die Bank leer ist. */
const askNextAfterDecline = async (
  offer: PromotionOfferRow,
  now: Date,
): Promise<string | null> => {
  const context = await loadContext(offer.gameId, offer.refereeId);
  if (!context) return null;
  if (context.game.state === 'cancelled') return null;
  if (context.game.kickoff.getTime() <= now.getTime()) return null;

  const substitute = nextSubstituteToAsk(context.slots);
  if (!substitute?.assignment) return null;

  /*
   * Der Zielplatz muss noch so dastehen wie bei der ersten Frage. Hat der
   * Abgebende sich inzwischen selbst ausgetragen oder jemand anderes den Platz
   * besetzt, ist die Kette gegenstandslos.
   */
  const occupant = context.slots[offer.targetSlot]?.assignment?.refereeId ?? null;
  if (occupant !== (offer.replacesRefereeId ?? null)) return null;

  const asked = await askSubstitute(
    {
      game: context.game,
      settings: context.settings,
      targetSlot: offer.targetSlot as SlotIndex,
      substitute,
      replacesRefereeId: offer.replacesRefereeId,
      requestedBy: offer.requestedBy ?? offer.refereeId,
    },
    now,
  );
  return asked.refereeId;
};
