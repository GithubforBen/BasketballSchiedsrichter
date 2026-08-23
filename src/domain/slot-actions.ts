import { canClaimSlot, canRequestSubstitute, canWithdraw, type ClaimContext } from './rules';
import { isAssigned, nextFreeSlot, SLOT_LABELS, SLOT_LABELS_SHORT } from './slots';
import type { Slot, SlotIndex } from './types';

/**
 * Was an jedem der vier Plaetze zu sehen und zu tun ist.
 *
 * Rein und ohne Oberflaechenbezug, damit die wichtigste Zusicherung des
 * Schiedsrichter-Bereichs testbar bleibt: **kein Knopf ist stumm gesperrt**.
 * Jede Sperre traegt ihren Grund mit.
 */

export type SlotActionKind =
  /** Frei und fuer diese Person belegbar. */
  | 'claim'
  /** Die Person steht selbst auf diesem Platz und darf sich austragen. */
  | 'withdraw'
  /** Frei, aber fuer diese Person nicht belegbar — mit Begruendung. */
  | 'blocked'
  /** Von jemand anderem belegt. */
  | 'occupied';

export interface SlotView {
  index: SlotIndex;
  role: string;
  roleShort: string;
  /** Was in der Zeile steht: ein Kuerzel, „frei“ oder „du“. */
  occupantId: string | null;
  isMine: boolean;
  action: SlotActionKind;
  /** Beschriftung des Knopfes. */
  actionLabel: string;
  /**
   * Warum die Aktion nicht moeglich ist. Leer, wenn sie moeglich ist.
   * Wird immer angezeigt — ein Knopf, der nur nicht reagiert, ist ein Fehler.
   */
  reason: string;
}

export interface SlotViewContext extends Omit<ClaimContext, 'slotIndex'> {
  slots: readonly Slot[];
}

export const slotViews = (ctx: SlotViewContext): readonly SlotView[] => {
  const next = nextFreeSlot(ctx.slots);
  const mineAlready = isAssigned(ctx.slots, ctx.referee.id);

  return ctx.slots.map((slot): SlotView => {
    const base = {
      index: slot.index,
      role: SLOT_LABELS[slot.index],
      roleShort: SLOT_LABELS_SHORT[slot.index],
      occupantId: slot.assignment?.refereeId ?? null,
      isMine: slot.assignment?.refereeId === ctx.referee.id,
    };

    if (base.isMine) {
      const decision = canWithdraw({
        game: ctx.game,
        slots: ctx.slots,
        referee: ctx.referee,
        settings: ctx.settings,
        now: ctx.now,
      });
      return decision.allowed
        ? { ...base, action: 'withdraw', actionLabel: 'Austragen', reason: '' }
        : { ...base, action: 'blocked', actionLabel: 'Austragen', reason: decision.message };
    }

    if (slot.assignment) {
      return { ...base, action: 'occupied', actionLabel: 'belegt', reason: '' };
    }

    const decision = canClaimSlot({ ...ctx, slotIndex: slot.index });
    if (decision.allowed) {
      return {
        ...base,
        action: 'claim',
        actionLabel: slot.kind === 'referee' ? 'Eintragen' : 'Als Ersatz eintragen',
        reason: '',
      };
    }

    /*
     * Ein Platz hinter dem naechsten freien ist nicht „gesperrt“, sondern
     * schlicht noch nicht an der Reihe. Das ist eine andere Aussage und
     * verdient eine andere Beschriftung.
     */
    const notYetInLine =
      decision.reason === 'slot-out-of-order' && next !== null && slot.index > next.index;

    return {
      ...base,
      action: 'blocked',
      actionLabel: notYetInLine ? 'erst danach frei' : mineAlready ? 'frei' : 'nicht möglich',
      reason: decision.message,
    };
  });
};

export interface SubstituteRequestView {
  possible: boolean;
  label: string;
  /** Erklaerung — bei Sperre der Grund, sonst was passieren wird. */
  note: string;
}

/** Der Knopf „Ersatz anfordern“ samt Begruendung. Regel 8. */
export const substituteRequestView = (ctx: SlotViewContext): SubstituteRequestView => {
  const decision = canRequestSubstitute({
    game: ctx.game,
    slots: ctx.slots,
    referee: ctx.referee,
    settings: ctx.settings,
    now: ctx.now,
  });
  return decision.allowed
    ? {
        possible: true,
        label: 'Ersatz anfordern',
        note: `Die Nachricht geht an alle mit Qualifikation ${ctx.game.leagueId}.`,
      }
    : { possible: false, label: 'Ersatz anfordern', note: decision.message };
};
