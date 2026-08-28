import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { SLOT_LABELS } from '@/domain/slots';
import type { Game, SlotIndex } from '@/domain/types';
import {
  readAnswerToken,
  type AnswerClaims,
  type AnswerKind,
} from '@/notifications/action-links';
import {
  confirmAssignment,
  respondToPromotion,
  respondToRelocation,
  type ActionResult,
} from './assignments';
import { env } from './env';
import { toGame } from './queries/games';

/**
 * Die Gegenstelle der eindeutigen Antwortlinks.
 *
 * Eine Nachricht fragt nach genau einem Spiel; die Antwort darf deshalb auch
 * nur genau dieses Spiel treffen. Der Token aus der Nachricht sagt, worum es
 * geht — hier wird nachgesehen, ob die Frage ueberhaupt noch offen ist, und
 * hier wird sie beantwortet.
 *
 * Der Token ist ein Ausweis fuer genau diesen einen Vorgang und ersetzt keine
 * Anmeldung: er oeffnet nichts ausser dieser einen Frage, gilt nur bis zum
 * Anpfiff und zeigt nur, was ohnehin schon in der Nachricht stand. Wer mehr
 * will — Kalender, Profil, Statistik — meldet sich an.
 */

export interface AnswerQuestion {
  kind: AnswerKind;
  game: Game;
  refereeName: string;
  /** Der eigene Platz, soweit es einen gibt. */
  slotLabel: string | null;
  /** Der Platz, um den es geht — beim Nachruecken der frei gewordene. */
  targetSlotLabel: string | null;
  /** Antwortfrist einer Nachrueck-Anfrage. */
  respondBy: Date | null;
  /**
   * Ob die Frage noch offen ist.
   *
   * - `open`     es gibt etwas zu entscheiden
   * - `answered` genau dieser Vorgang ist schon beantwortet
   * - `closed`   die Frage stellt sich nicht mehr (ausgetragen, abgesagt, Frist)
   */
  state: 'open' | 'answered' | 'closed';
  /** Was jetzt gilt, in einem Satz. */
  status: string;
}

export type AnswerLookup =
  | { readonly ok: true; readonly claims: AnswerClaims; readonly question: AnswerQuestion }
  | { readonly ok: false; readonly message: string };

const fail = (message: string): AnswerLookup => ({ ok: false, message });

const label = (index: number): string | null =>
  index >= 0 && index <= 3 ? SLOT_LABELS[index as SlotIndex] : null;

/** Der Token, so wie er aus der Adresse kommt. */
export const readAnswer = (token: string, now: Date = new Date()) =>
  readAnswerToken(token, env.sessionSecret, now);

interface Loaded {
  game: Game;
  refereeName: string;
  assignment: { slotIndex: number; confirmedAt: Date | null; acknowledgedRelocation: number } | null;
  relocationVersion: number;
}

const load = async (claims: AnswerClaims): Promise<Loaded | null> => {
  const [gameRows, refereeRows] = await Promise.all([
    db.select().from(schema.games).where(eq(schema.games.id, claims.gameId)).limit(1),
    db
      .select({ name: schema.referees.name, active: schema.referees.active })
      .from(schema.referees)
      .where(eq(schema.referees.id, claims.refereeId))
      .limit(1),
  ]);
  const gameRow = gameRows[0];
  const referee = refereeRows[0];
  if (!gameRow || !referee) return null;

  const assignments = await db
    .select({
      slotIndex: schema.assignments.slotIndex,
      confirmedAt: schema.assignments.confirmedAt,
      acknowledgedRelocation: schema.assignments.acknowledgedRelocation,
    })
    .from(schema.assignments)
    .where(
      and(
        eq(schema.assignments.gameId, claims.gameId),
        eq(schema.assignments.refereeId, claims.refereeId),
      ),
    )
    .limit(1);

  return {
    game: toGame(gameRow),
    refereeName: referee.name,
    assignment: assignments[0] ?? null,
    relocationVersion: gameRow.relocationVersion,
  };
};

/**
 * Was der Link gerade zeigt.
 *
 * Die Antwort auf die eigentliche Frage — "ist genau dieses Spiel schon
 * bestaetigt?" — steht hier und nicht in der Nachricht: die Nachricht ist alt,
 * der Stand ist frisch. Wer denselben Link zweimal oeffnet, sieht beim zweiten
 * Mal, dass er schon geantwortet hat, statt ein zweites Mal zu antworten.
 */
export const openAnswer = async (
  claims: AnswerClaims,
  now: Date = new Date(),
): Promise<AnswerLookup> => {
  const loaded = await load(claims);
  if (!loaded) return fail('Dieses Spiel gibt es nicht mehr.');

  const { game, refereeName, assignment } = loaded;
  const base = {
    kind: claims.kind,
    game,
    refereeName,
    slotLabel: assignment ? label(assignment.slotIndex) : null,
    targetSlotLabel: null,
    respondBy: null,
  } satisfies Omit<AnswerQuestion, 'state' | 'status'>;

  if (game.state === 'cancelled') {
    return {
      ok: true,
      claims,
      question: { ...base, state: 'closed', status: 'Dieses Spiel ist abgesagt.' },
    };
  }
  if (game.kickoff.getTime() <= now.getTime()) {
    return {
      ok: true,
      claims,
      question: { ...base, state: 'closed', status: 'Dieses Spiel ist bereits angepfiffen.' },
    };
  }

  if (claims.kind === 'promotion') {
    const offers = await db
      .select()
      .from(schema.promotionOffers)
      .where(eq(schema.promotionOffers.id, claims.reference))
      .limit(1);
    const offer = offers[0];
    if (!offer || offer.refereeId !== claims.refereeId) {
      return fail('Diese Anfrage gibt es nicht mehr.');
    }

    const question = {
      ...base,
      targetSlotLabel: label(offer.targetSlot),
      respondBy: offer.respondBy,
    };
    if (offer.outcome === 'accepted') {
      return {
        ok: true,
        claims,
        question: {
          ...question,
          state: 'answered',
          status: `Du hast diese Anfrage angenommen und stehst als ${label(offer.targetSlot) ?? 'Schiedsrichter'}.`,
        },
      };
    }
    if (offer.outcome === 'declined') {
      return {
        ok: true,
        claims,
        question: { ...question, state: 'answered', status: 'Du hast diese Anfrage abgelehnt.' },
      };
    }
    if (offer.outcome === 'expired' || now.getTime() >= offer.respondBy.getTime()) {
      return {
        ok: true,
        claims,
        question: {
          ...question,
          state: 'closed',
          status: 'Die Antwortfrist für diese Anfrage ist verstrichen.',
        },
      };
    }
    return {
      ok: true,
      claims,
      question: { ...question, state: 'open', status: 'Diese Anfrage ist noch offen.' },
    };
  }

  if (!assignment) {
    return {
      ok: true,
      claims,
      question: {
        ...base,
        state: 'closed',
        status: 'Du bist für dieses Spiel nicht mehr eingetragen.',
      },
    };
  }

  if (claims.kind === 'confirm') {
    if (assignment.slotIndex >= 2) {
      return {
        ok: true,
        claims,
        question: {
          ...base,
          state: 'closed',
          status: 'Du stehst auf einem Ersatzplatz — dafür ist keine Bestätigung nötig.',
        },
      };
    }
    if (assignment.confirmedAt) {
      return {
        ok: true,
        claims,
        question: {
          ...base,
          state: 'answered',
          /*
           * Genau das ist die Frage, die der eindeutige Link beantworten
           * koennen muss: nicht "hast du irgendetwas bestaetigt", sondern
           * "ist dieses Spiel bestaetigt".
           */
          status: 'Dieses Spiel hast du bereits bestätigt.',
        },
      };
    }
    return {
      ok: true,
      claims,
      question: { ...base, state: 'open', status: 'Deine Bestätigung steht noch aus.' },
    };
  }

  // relocation
  if (assignment.acknowledgedRelocation >= loaded.relocationVersion) {
    return {
      ok: true,
      claims,
      question: {
        ...base,
        state: 'answered',
        status: 'Du hast diesen Termin bereits bestätigt.',
      },
    };
  }
  return {
    ok: true,
    claims,
    question: { ...base, state: 'open', status: 'Deine Rückmeldung zum neuen Termin steht aus.' },
  };
};

export type AnswerChoice = 'confirm' | 'promotion-accept' | 'promotion-decline' | 'keep' | 'decline';

/**
 * Die Antwort selbst.
 *
 * Der Token entscheidet ueber Spiel und Person; aus der Adresse kommt nur noch,
 * *welche* der angebotenen Antworten es sein soll. Passt die Antwort nicht zum
 * Vorgang im Token, wird sie abgewiesen — ein Link zur Bestaetigung kann keine
 * Absage ausloesen.
 */
export const submitAnswer = async (
  claims: AnswerClaims,
  choice: AnswerChoice,
  now: Date = new Date(),
): Promise<ActionResult> => {
  const via = `${claims.kind}:${claims.reference}`;

  if (claims.kind === 'confirm') {
    if (choice !== 'confirm') return { ok: false, message: 'Diese Antwort passt nicht zum Link.' };
    return confirmAssignment(claims.gameId, claims.refereeId, now, via);
  }

  if (claims.kind === 'promotion') {
    if (choice !== 'promotion-accept' && choice !== 'promotion-decline') {
      return { ok: false, message: 'Diese Antwort passt nicht zum Link.' };
    }
    return respondToPromotion(
      claims.reference,
      claims.refereeId,
      choice === 'promotion-accept' ? 'accept' : 'decline',
      now,
      via,
    );
  }

  if (choice !== 'keep' && choice !== 'decline') {
    return { ok: false, message: 'Diese Antwort passt nicht zum Link.' };
  }
  return respondToRelocation(claims.gameId, claims.refereeId, choice, via);
};
