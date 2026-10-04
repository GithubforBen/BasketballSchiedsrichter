import { Initials, Status, Tag } from '@/components/primitives';
import { matchTitle, statusOf, timeLabel, type Matchday } from '@/domain/schedule';
import { refereeSlots, substituteSlots, SLOT_LABELS } from '@/domain/slots';
import type { Slot } from '@/domain/types';
import { leagueDisplay } from '@/domain/league';

/**
 * Ein Spieltag im Spielplan — ohne Anmeldung mit Kuerzeln, angemeldet mit
 * vollen Namen.
 *
 * Die Komponente bekommt, was sie zeigen soll, und nicht mehr: die
 * oeffentliche Seite gibt ihr ausschliesslich Kuerzel herein, die
 * Spieluebersicht der Angemeldeten die Namen. Ein Name kann in die
 * oeffentliche Ansicht nicht durchrutschen, weil er dort nie hereinkommt —
 * projiziert wird vorher in der Seite (Regel 29).
 */

export interface PublicMatchdayProps {
  matchday: Matchday;
  timeZone: string;
  /** Kuerzel oder Name je Person. Fehlt eine Id, gilt der Platz als unbekannt. */
  labels: ReadonlyMap<string, string>;
  /**
   * `initials` zeichnet die runden Kuerzel-Marken des oeffentlichen
   * Spielplans. `names` schreibt die Namen aus — in eine Marke von 24 Pixeln
   * passt kein "Jan Schnorrenberger".
   */
  display: 'initials' | 'names';
}

const labelFor = (slot: Slot, labels: ReadonlyMap<string, string>): string | null =>
  slot.assignment ? (labels.get(slot.assignment.refereeId) ?? '?') : null;

const slotLabel = (slot: Slot, labels: ReadonlyMap<string, string>): string =>
  `${SLOT_LABELS[slot.index]}: ${labelFor(slot, labels) ?? 'frei'}`;

const substituteLabel = (slots: readonly Slot[], labels: ReadonlyMap<string, string>): string => {
  const occupied = substituteSlots(slots).flatMap((slot) => {
    const value = labelFor(slot, labels);
    return value === null ? [] : [value];
  });
  return occupied.length > 0 ? occupied.join(', ') : '—';
};

/** Die beiden Schiedsrichter als Namen, einer je Zeile; ein leerer Platz heisst "frei". */
const RefereeNames = ({
  slots,
  labels,
}: {
  slots: readonly Slot[];
  labels: ReadonlyMap<string, string>;
}) => (
  <span className="referee-names">
    {refereeSlots(slots).map((slot) => {
      const name = labelFor(slot, labels);
      return (
        <span key={slot.index} className={name === null ? 'slot-vacant' : undefined}>
          <span className="visually-hidden">{SLOT_LABELS[slot.index]}: </span>
          {name ?? 'frei'}
        </span>
      );
    })}
  </span>
);

const RefereeMarks = ({
  slots,
  labels,
  size,
}: {
  slots: readonly Slot[];
  labels: ReadonlyMap<string, string>;
  size?: number;
}) => (
  <span className="row" style={{ gap: 'var(--space-2)' }}>
    {refereeSlots(slots).map((slot) => (
      <Initials
        key={slot.index}
        initials={labelFor(slot, labels)}
        label={slotLabel(slot, labels)}
        {...(size === undefined ? {} : { size })}
      />
    ))}
  </span>
);

export const PublicMatchday = ({ matchday, timeZone, labels, display }: PublicMatchdayProps) => (
  <section style={{ marginTop: 'var(--space-8)' }}>
    <div className="matchday-head">
      <h2 className="matchday-title">{matchday.label}</h2>
      <span className="text-muted" style={{ fontSize: '12px' }}>
        {matchday.summary}
      </span>
    </div>

    <div className="scroll-x only-wide">
      <table className="table table-aligned table-schedule">
        {/*
          Die Breiten stehen hier und nicht im Stilblatt: sie gehoeren zu dieser
          Spaltenfolge, und wer eine Spalte ergaenzt, sieht die Zeile daneben.
          Zusammen ergeben sie hundert Prozent. Mit Namen brauchen die beiden
          Besetzungsspalten mehr Platz als mit Kuerzeln — Spiel und Ort geben
          ihn her.
        */}
        {display === 'names' ? (
          <colgroup>
            <col style={{ width: '7%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '22%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '19%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '11%' }} />
          </colgroup>
        ) : (
          <colgroup>
            <col style={{ width: '7%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '26%' }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '11%' }} />
          </colgroup>
        )}
        <thead>
          <tr>
            <th>Zeit</th>
            <th>Liga</th>
            <th>Spiel</th>
            <th>Ort</th>
            <th>Schiedsrichter</th>
            <th>Ersatz</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {matchday.games.map((entry) => (
            <tr key={entry.game.id}>
              <td style={{ whiteSpace: 'nowrap' }}>{timeLabel(entry.game.kickoff, timeZone)}</td>
              <td>
                <Tag tone="neutral">{leagueDisplay(entry.game)}</Tag>
              </td>
              <td>{matchTitle(entry.game)}</td>
              <td className="text-muted">{entry.game.venue}</td>
              <td>
                {display === 'names' ? (
                  <RefereeNames slots={entry.slots} labels={labels} />
                ) : (
                  <RefereeMarks slots={entry.slots} labels={labels} />
                )}
              </td>
              <td style={{ fontSize: '13px' }}>{substituteLabel(entry.slots, labels)}</td>
              <td>
                <Status view={statusOf(entry)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <ul className="card-list only-narrow">
      {matchday.games.map((entry) => {
        const view = statusOf(entry);
        return (
          <li key={entry.game.id} className="game-card">
            <span className="game-card-bar" style={{ background: view.colorVar }} aria-hidden="true" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="game-card-title">{matchTitle(entry.game)}</div>
              <div className="text-muted" style={{ fontSize: '11px' }}>
                {timeLabel(entry.game.kickoff, timeZone)} · {leagueDisplay(entry.game)} · {entry.game.venue}
              </div>
              {display === 'names' ? (
                <div style={{ fontSize: '12px', marginTop: 'var(--space-2)' }}>
                  <div>
                    <span className="text-muted">Schiedsrichter: </span>
                    {refereeSlots(entry.slots)
                      .map((slot) => labelFor(slot, labels) ?? 'frei')
                      .join(', ')}
                  </div>
                  <div>
                    <span className="text-muted">Ersatz: </span>
                    {substituteLabel(entry.slots, labels)}
                  </div>
                </div>
              ) : (
                <div className="row" style={{ gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                  <RefereeMarks slots={entry.slots} labels={labels} size={20} />
                  <span className="text-muted" style={{ fontSize: '11px' }}>
                    Ersatz: {substituteLabel(entry.slots, labels)}
                  </span>
                </div>
              )}
            </div>
            <Status view={view} />
          </li>
        );
      })}
    </ul>
  </section>
);
