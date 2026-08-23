import { isAssigned, nextFreeSlot, slotKind, slotOf, substituteSlots, SLOT_LABELS } from './slots';
import { calendarDay, days, hasPassed, withinLeadTime } from './time';
import {
  allow,
  deny,
  type ClubSettings,
  type Decision,
  type Game,
  type Referee,
  type Slot,
  type SlotIndex,
} from './types';

/** Regel 4: Qualifikationspruefung. Pflicht, vom Admin nicht abschaltbar. */
export const isQualified = (referee: Referee, leagueId: string): boolean =>
  referee.qualifications.includes(leagueId);

interface GameGuardInput {
  game: Game;
  now: Date;
}

/** Vorbedingungen, die fuer jede Aenderung an einer Besetzung gelten. */
const gameIsOpenForChanges = ({ game, now }: GameGuardInput): Decision => {
  if (game.state === 'cancelled') {
    return deny('game-cancelled', 'Das Spiel wurde abgesagt.');
  }
  if (hasPassed(game.kickoff, now)) {
    return deny('kickoff-passed', 'Der Anpfiff liegt bereits in der Vergangenheit.');
  }
  return allow();
};

export interface ClaimContext {
  game: Game;
  slots: readonly Slot[];
  referee: Referee;
  /** Der Platz, den die Person belegen moechte. */
  slotIndex: SlotIndex;
  /**
   * Spiele am selben Kalendertag, in denen die Person bereits eingetragen ist
   * (Ersatzplaetze zaehlen mit). Fuer Regel 6.
   */
  sameDayAssignments: readonly Game[];
  settings: ClubSettings;
  now: Date;
  timeZone: string;
}

/**
 * Regeln 1-6: Darf sich diese Person auf diesen Platz eintragen?
 *
 * Die Reihenfolge der Pruefungen ist bewusst gewaehlt: der Nutzer soll den
 * grundlegendsten Grund genannt bekommen, nicht den zufaellig zuerst gepruften.
 */
export const canClaimSlot = (ctx: ClaimContext): Decision => {
  const guard = gameIsOpenForChanges(ctx);
  if (!guard.allowed) return guard;

  if (!isQualified(ctx.referee, ctx.game.leagueId)) {
    return deny(
      'not-qualified',
      'Fuer diese Liga fehlt dir die Qualifikation. Der Admin vergibt sie im Schiedsrichter-Bereich.',
    );
  }

  if (isAssigned(ctx.slots, ctx.referee.id)) {
    const own = slotOf(ctx.slots, ctx.referee.id);
    const label = own ? SLOT_LABELS[own.index] : 'einem Platz';
    return deny('already-assigned', `Du stehst bei diesem Spiel schon auf ${label}.`);
  }

  const target = ctx.slots.find((s) => s.index === ctx.slotIndex);
  if (target?.assignment) {
    return deny('slot-taken', 'Dieser Platz ist bereits belegt.');
  }

  const next = nextFreeSlot(ctx.slots);
  if (!next) {
    return deny('slot-taken', 'Alle vier Plaetze sind besetzt.');
  }
  if (next.index !== ctx.slotIndex) {
    return deny(
      'slot-out-of-order',
      `Plaetze werden der Reihe nach vergeben. Als naechstes ist ${SLOT_LABELS[next.index]} frei.`,
    );
  }

  const dayConflict = oneGamePerDayConflict(ctx);
  if (dayConflict) return dayConflict;

  return allow();
};

/**
 * Regel 6: Max. 1 Spiel pro Tag und Person, Ersatzplaetze zaehlen mit.
 * Der Admin kann die Sperre pro Spiel aufheben.
 */
const oneGamePerDayConflict = (ctx: ClaimContext): Decision | null => {
  if (!ctx.settings.oneGamePerDay) return null;
  if (ctx.game.overrides.oneGamePerDay) return null;

  const day = calendarDay(ctx.game.kickoff, ctx.timeZone);
  const clash = ctx.sameDayAssignments.find(
    (other) =>
      other.id !== ctx.game.id &&
      other.state !== 'cancelled' &&
      calendarDay(other.kickoff, ctx.timeZone) === day,
  );
  if (!clash) return null;

  return deny(
    'one-game-per-day',
    `Du bist an diesem Tag schon fuer ${clash.home} — ${clash.away} eingetragen. Pro Tag ist ein Spiel vorgesehen; der Admin kann das fuer dieses Spiel freigeben.`,
  );
};

/**
 * Der Platz, den diese Person als naechstes belegen koennte — oder null.
 * Bequemer Einstieg fuer die Oberflaeche, damit sie nicht alle vier Plaetze
 * einzeln durchprobieren muss.
 */
export const claimableSlot = (ctx: Omit<ClaimContext, 'slotIndex'>): Slot | null => {
  const next = nextFreeSlot(ctx.slots);
  if (!next) return null;
  return canClaimSlot({ ...ctx, slotIndex: next.index }).allowed ? next : null;
};

export interface WithdrawContext {
  game: Game;
  slots: readonly Slot[];
  referee: Referee;
  settings: ClubSettings;
  now: Date;
}

/** Regel 7: Selbst austragen bis zur Frist, danach nur mit Admin-Freigabe. */
export const canWithdraw = (ctx: WithdrawContext): Decision => {
  const guard = gameIsOpenForChanges(ctx);
  if (!guard.allowed) return guard;

  if (!isAssigned(ctx.slots, ctx.referee.id)) {
    return deny('not-assigned', 'Du bist fuer dieses Spiel nicht eingetragen.');
  }

  if (ctx.game.overrides.withdraw) return allow();

  const limit = days(ctx.settings.withdrawDeadlineDays);
  if (!withinLeadTime(ctx.game.kickoff, ctx.now, limit)) {
    return deny(
      'withdraw-deadline-passed',
      `Austragen ist nur bis ${ctx.settings.withdrawDeadlineDays} Tage vor Anpfiff moeglich. Melde dich beim Admin — er kann den Platz fuer dich freigeben.`,
    );
  }
  return allow();
};

export interface SubstituteRequestContext {
  game: Game;
  slots: readonly Slot[];
  referee: Referee;
  settings: ClubSettings;
  now: Date;
}

/**
 * Regel 8: Ersatz anfordern, solange man selbst eingetragen ist und die Frist laeuft.
 *
 * Zusaetzlich pruefen wir, ob ueberhaupt ein Ersatzplatz frei ist. Ohne freien
 * Platz haette die Anfrage keinen Adressaten und wuerde nur Nachrichtenkosten
 * erzeugen (Regel 33).
 */
export const canRequestSubstitute = (ctx: SubstituteRequestContext): Decision => {
  const guard = gameIsOpenForChanges(ctx);
  if (!guard.allowed) return guard;

  if (!isAssigned(ctx.slots, ctx.referee.id)) {
    return deny(
      'not-assigned',
      'Ersatz kannst du nur anfordern, wenn du selbst fuer dieses Spiel eingetragen bist.',
    );
  }

  const free = substituteSlots(ctx.slots).some((s) => s.assignment === null);
  if (!free) {
    return deny('no-open-substitute-slot', 'Beide Ersatzplaetze sind schon besetzt.');
  }

  if (ctx.game.overrides.substituteRequest) return allow();

  const limit = days(ctx.settings.substituteRequestDeadlineDays);
  if (!withinLeadTime(ctx.game.kickoff, ctx.now, limit)) {
    return deny(
      'substitute-request-deadline-passed',
      `Ersatz anfordern ist ab ${ctx.settings.substituteRequestDeadlineDays} Tage vor Anpfiff gesperrt. Der Admin kann es freigeben.`,
    );
  }
  return allow();
};

/**
 * Regel 4 in der Breite: wer kommt fuer dieses Spiel ueberhaupt in Frage?
 * Grundlage fuer Erinnerungen und fuer die Liste im Adminbereich.
 */
export const qualifiedReferees = (
  referees: readonly Referee[],
  leagueId: string,
): readonly Referee[] => referees.filter((r) => r.active && isQualified(r, leagueId));

/** Der fachliche Name eines Platzes, unabhaengig von der Oberflaeche. */
export const describeSlot = (index: SlotIndex): string =>
  `${SLOT_LABELS[index]} (${slotKind(index) === 'referee' ? 'Schiedsrichter' : 'Ersatz'})`;
