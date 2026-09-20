import { licenseCovers } from './license';
import {
  isAssigned,
  nextFreeSlot,
  refereeSlots,
  slotOf,
  substituteSlots,
  SLOT_LABELS,
} from './slots';
import { calendarDay, days, hasPassed, withinLeadTime } from './time';
import {
  allow,
  deny,
  type ClubSettings,
  type Decision,
  type Game,
  type License,
  type Referee,
  type Slot,
  type SlotIndex,
} from './types';

/** Regel 4: Qualifikationspruefung. Pflicht, vom Admin nicht abschaltbar. */
export const isQualified = (referee: Referee, leagueId: string): boolean =>
  referee.qualifications.includes(leagueId);

/**
 * Lizenzpruefung. Ebenfalls Pflicht und ebenfalls nicht abschaltbar.
 *
 * Sie steht neben der Qualifikation und nicht an ihrer Stelle: die
 * Qualifikation sagt, fuer welche Liga jemand eingeteilt werden darf, die
 * Lizenz, welche Spiele er ueberhaupt pfeifen darf. Wer keine Lizenz hat,
 * kommt fuer kein Spiel in Frage — sehen darf er trotzdem jedes.
 */
export const isLicensedFor = (referee: Referee, game: Pick<Game, 'requiredLicense'>): boolean =>
  licenseCovers(referee.license, game.requiredLicense);

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
      'Für diese Liga fehlt dir die Qualifikation. Der Admin vergibt sie im Schiedsrichter-Bereich.',
    );
  }

  /*
   * Die Lizenz kommt nach der Qualifikation, weil sie der seltenere Grund ist:
   * wer sie gar nicht hat, soll das als Erstes erfahren, wenn die Liga sonst
   * passen wuerde.
   */
  if (ctx.referee.license === null) {
    return deny(
      'license-missing',
      'Für dich ist keine Lizenz hinterlegt — ohne sie ist keine Eintragung möglich. Der Admin trägt sie im Schiedsrichter-Bereich ein.',
    );
  }
  if (!isLicensedFor(ctx.referee, ctx.game)) {
    return deny(
      'license-too-low',
      `Dieses Spiel verlangt die Lizenz ${ctx.game.requiredLicense}, du hast die Lizenz ${ctx.referee.license}.`,
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
    return deny('slot-taken', 'Alle vier Plätze sind besetzt.');
  }
  if (next.index !== ctx.slotIndex) {
    return deny(
      'slot-out-of-order',
      `Plätze werden der Reihe nach vergeben. Als nächstes ist ${SLOT_LABELS[next.index]} frei.`,
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
    `Du bist an diesem Tag schon für ${clash.home} — ${clash.away} eingetragen. Pro Tag ist ein Spiel vorgesehen; der Admin kann das für dieses Spiel freigeben.`,
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
    return deny('not-assigned', 'Du bist für dieses Spiel nicht eingetragen.');
  }

  if (ctx.game.overrides.withdraw) return allow();

  const limit = days(ctx.settings.withdrawDeadlineDays);
  if (!withinLeadTime(ctx.game.kickoff, ctx.now, limit)) {
    return deny(
      'withdraw-deadline-passed',
      `Austragen ist nur bis ${ctx.settings.withdrawDeadlineDays} Tage vor Anpfiff möglich. Melde dich beim Admin — er kann den Platz für dich freigeben.`,
    );
  }
  return allow();
};

export interface SubstituteRequestContext {
  game: Game;
  slots: readonly Slot[];
  /** Wer den Knopf drueckt — ein eingeteilter Schiedsrichter oder ein Admin. */
  referee: Referee;
  settings: ClubSettings;
  now: Date;
  /**
   * Ob fuer dieses Spiel schon eine Anfrage laeuft.
   *
   * Zwei gleichzeitige Anfragen an denselben Ersatz waeren eine Zusage zu
   * viel: beide koennten angenommen werden, und einer der beiden Plaetze
   * waere danach doppelt belegt. Die laufende Anfrage hat deshalb Vorrang,
   * bis sie beantwortet ist oder ihre Frist verstreicht.
   */
  pendingRequest?: boolean;
}

/**
 * Der Platz, der abgegeben werden soll.
 *
 * Zwei Wege fuehren hierher, und beide enden am selben Punkt — ein
 * Schiedsrichter-Platz, den ein Ersatz uebernehmen soll:
 *
 * - **Der Schiedsrichter selbst.** Er steht auf Schiri 1 oder Schiri 2 und
 *   kann nicht; abgegeben wird *sein* Platz, und er raeumt ihn erst, wenn
 *   jemand zugesagt hat. Bis dahin bleibt er verantwortlich — sonst stuende
 *   das Spiel zwischendurch ohne Besetzung da.
 * - **Der Admin.** Er hat den Platz vorher geraeumt; abgegeben wird der erste
 *   leere Schiedsrichter-Platz, und es raeumt niemand mehr etwas.
 *
 * Ein Admin, der selbst eingeteilt ist, geht den ersten Weg: er gibt seinen
 * eigenen Platz ab wie jeder andere.
 */
export const handoverSlot = (
  slots: readonly Slot[],
  referee: Referee,
): Slot | null => {
  const own = refereeSlots(slots).find((slot) => slot.assignment?.refereeId === referee.id);
  if (own) return own;
  if (referee.role !== 'admin') return null;
  return refereeSlots(slots).find((slot) => slot.assignment === null) ?? null;
};

/** Der Ersatz, der als naechstes gefragt wird: der vorderste besetzte Ersatzplatz. */
export const nextSubstituteToAsk = (slots: readonly Slot[]): Slot | null =>
  substituteSlots(slots).find((slot) => slot.assignment !== null) ?? null;

/**
 * Regel 8: Ersatz anfordern — das Spiel abgeben.
 *
 * Was der Knopf tut, hat sich geaendert, und der alte Name traegt das neue
 * Verhalten nur knapp. Frueher rief er weitere Leute auf, sich als Ersatz
 * **einzutragen**, solange ein Ersatzplatz frei war. Das half dem, der nicht
 * konnte, genau gar nicht: er stand weiterhin auf seinem Platz, und die Bank
 * wurde nur laenger.
 *
 * Jetzt fragt er den vordersten eingetragenen Ersatz, ob er das Spiel
 * **uebernimmt**. Sagt der zu, tauschen die beiden die Plaetze — der
 * Anfragende ist raus. Sagt er ab, ist er offensichtlich nicht verfuegbar und
 * verlaesst die Bank; der naechste rueckt auf und wird gefragt.
 *
 * Daraus folgt die wichtigste Vorbedingung, und sie ist die Umkehrung der
 * alten: es muss ein Ersatz **da** sein. Eine leere Bank hat niemanden, den
 * man fragen koennte.
 */
export const canRequestSubstitute = (ctx: SubstituteRequestContext): Decision => {
  const guard = gameIsOpenForChanges(ctx);
  if (!guard.allowed) return guard;

  const target = handoverSlot(ctx.slots, ctx.referee);
  if (!target) {
    return deny(
      'not-assigned',
      ctx.referee.role === 'admin'
        ? 'Dafür muss ein Schiedsrichter-Platz frei sein. Trage zuerst jemanden aus — oder der Eingeteilte fordert selbst Ersatz an.'
        : 'Ersatz kannst du nur anfordern, wenn du selbst als Schiri 1 oder Schiri 2 eingetragen bist.',
    );
  }

  if (!nextSubstituteToAsk(ctx.slots)) {
    return deny(
      'no-substitute-available',
      'Für dieses Spiel ist kein Ersatz eingetragen, der übernehmen könnte.',
    );
  }

  if (ctx.pendingRequest) {
    return deny(
      'request-running',
      'Für dieses Spiel läuft schon eine Anfrage. Erst wenn sie beantwortet ist oder ihre Frist abläuft, geht die nächste raus.',
    );
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
 * Grundlage fuer Ausschreibungen und fuer die Liste im Adminbereich.
 *
 * Die Lizenz gehoert hier dazu und nicht nur in die Eintragungspruefung: eine
 * Ausschreibung an jemanden, der sich anschliessend nicht eintragen darf,
 * kostet Geld (Regel 33) und stiftet nur Verwirrung. Wird kein Spiel
 * uebergeben, bleibt es bei der reinen Ligapruefung — dann ist die Lizenz
 * nicht bekannt und die Liste absichtlich weiter gefasst.
 */
export const qualifiedReferees = (
  referees: readonly Referee[],
  leagueId: string,
  requiredLicense?: License,
): readonly Referee[] =>
  referees.filter(
    (r) =>
      r.active &&
      isQualified(r, leagueId) &&
      (requiredLicense === undefined || licenseCovers(r.license, requiredLicense)),
  );
