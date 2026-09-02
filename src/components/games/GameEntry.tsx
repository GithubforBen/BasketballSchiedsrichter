import { Button, Status, Tag } from '@/components/primitives';
import { CONFIRMATION_LABELS, type ConfirmationState } from '@/domain/confirmation';
import { matchTitle, timeLabel } from '@/domain/schedule';
import type { SlotView, SubstituteRequestView } from '@/domain/slot-actions';
import type { StatusView } from '@/domain/status';
import type { Game } from '@/domain/types';
import {
  claimAction,
  confirmAction,
  requestSubstituteAction,
  withdrawAction,
} from '@/app/spiele/actions';

/**
 * Ein Spiel mit seiner Besetzung, aus Sicht einer angemeldeten Person.
 *
 * Die Entscheidungen — wer darf was, und warum nicht — sind bereits in der
 * Regel-Engine gefallen. Hier wird nur noch dargestellt.
 */

export interface GameEntryProps {
  game: Game;
  day: string;
  timeZone: string;
  status: StatusView;
  slots: readonly SlotView[];
  substituteRequest: SubstituteRequestView;
  /** Kuerzel je Person, fuer die Besetzungszeilen. */
  initials: ReadonlyMap<string, string>;
  /** Hinweis zur Qualifikation und zur Reihenfolge der Plaetze. */
  /** Warum sich diese Person hier eintragen kann — oder warum nicht. */
  eligibilityNote: string;
  /** Ob Qualifikation **und** Lizenz fuer dieses Spiel reichen. */
  eligible: boolean;
  /** "Anpfiff in 5 Tagen · Austragen möglich" */
  leadNote: string;
  confirmation: ConfirmationState | null;
  confirmationHint: string;
}

const HiddenFields = ({ game, day }: { game: string; day: string }) => (
  <>
    <input type="hidden" name="spiel" value={game} />
    <input type="hidden" name="tag" value={day} />
  </>
);

export const GameEntry = ({
  game,
  day,
  timeZone,
  status,
  slots,
  substituteRequest,
  initials,
  eligibilityNote,
  eligible,
  leadNote,
  confirmation,
  confirmationHint,
}: GameEntryProps) => (
  <article className="game">
    <div className="game-time">{timeLabel(game.kickoff, timeZone)}</div>

    <div>
      <div className="row" style={{ gap: 'var(--space-2)' }}>
        <Tag tone="neutral">{game.leagueId}</Tag>
        {/* Die noetige Lizenz steht am Spiel, nicht nur im Hinweistext darunter. */}
        <Tag tone="neutral">Lizenz {game.requiredLicense}</Tag>
        <Status view={status} />
      </div>
      <h3 className="game-teams">{matchTitle(game)}</h3>
      <div className="text-muted" style={{ fontSize: '13px' }}>
        {game.venue}
      </div>
      <p
        style={{
          fontSize: '12px',
          marginTop: 'var(--space-2)',
          color: eligible ? 'var(--text-dim)' : 'var(--color-accent-700)',
        }}
      >
        {eligibilityNote}
      </p>
      <div className="text-muted" style={{ fontSize: '12px' }}>
        {leadNote}
      </div>

      {confirmation === 'pending' || confirmation === 'overdue' ? (
        <form action={confirmAction} className="confirm-box">
          <HiddenFields game={game.id} day={day} />
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '13px' }}>
            Pflichtbestätigung offen
          </div>
          <p className="text-muted" style={{ fontSize: '12px', marginTop: 'var(--space-1)' }}>
            {confirmationHint}
          </p>
          <Button type="submit" variant="primary">
            Ja, habe ich gelesen und mache es
          </Button>
        </form>
      ) : null}

      {confirmation === 'confirmed' ? (
        <div className="confirm-box confirm-box-done">
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '13px' }}>
            Bestätigt
          </div>
          <p className="text-muted" style={{ fontSize: '12px', margin: 0 }}>
            Du hast zugesagt. Die Admins sehen den Haken in der Übersicht.
          </p>
        </div>
      ) : null}

      {confirmation === 'scheduled' ? (
        <div className="text-muted" style={{ fontSize: '12px', marginTop: 'var(--space-2)' }}>
          {CONFIRMATION_LABELS.scheduled} — {confirmationHint}
        </div>
      ) : null}
    </div>

    <div className="stack" style={{ gap: 'var(--space-2)' }}>
      {slots.map((slot) => (
        <div
          key={slot.index}
          className={`slot${slot.isMine ? ' slot-mine' : ''}${
            slot.action === 'claim' ? ' slot-free' : ''
          }`}
        >
          <span className="slot-role">{slot.roleShort}</span>
          <span className={`slot-who${slot.occupantId === null ? ' slot-vacant' : ''}`}>
            {slot.isMine
              ? 'du'
              : slot.occupantId
                ? (initials.get(slot.occupantId) ?? '—')
                : 'frei'}
          </span>

          {slot.action === 'claim' ? (
            <form action={claimAction}>
              <HiddenFields game={game.id} day={day} />
              <Button type="submit" variant={slot.index < 2 ? 'primary' : 'secondary'}>
                {slot.actionLabel}
              </Button>
            </form>
          ) : slot.action === 'withdraw' ? (
            <form action={withdrawAction}>
              <HiddenFields game={game.id} day={day} />
              <Button type="submit" variant="secondary">
                {slot.actionLabel}
              </Button>
            </form>
          ) : (
            <Button variant="ghost" disabled>
              {slot.actionLabel}
            </Button>
          )}

          {slot.reason ? <span className="slot-reason">{slot.reason}</span> : null}
        </div>
      ))}

      <div className="row" style={{ marginTop: 'var(--space-2)' }}>
        {substituteRequest.possible ? (
          <form action={requestSubstituteAction}>
            <HiddenFields game={game.id} day={day} />
            <Button type="submit" variant="secondary">
              {substituteRequest.label}
            </Button>
          </form>
        ) : (
          <Button variant="secondary" disabled>
            {substituteRequest.label}
          </Button>
        )}
        <span className="text-muted" style={{ fontSize: '11px', flex: 1, minWidth: '200px' }}>
          {substituteRequest.note}
        </span>
      </div>
    </div>
  </article>
);
