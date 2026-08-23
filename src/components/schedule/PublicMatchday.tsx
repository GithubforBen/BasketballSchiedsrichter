import { Initials, Status, Tag } from '@/components/primitives';
import { matchTitle, statusOf, timeLabel, type Matchday } from '@/domain/schedule';
import { refereeSlots, substituteSlots, SLOT_LABELS } from '@/domain/slots';
import type { Slot } from '@/domain/types';

/**
 * Ein Spieltag in der oeffentlichen Ansicht.
 *
 * Die Komponente bekommt ausschliesslich Kuerzel. Ein Name kann hier nicht
 * durchrutschen, weil er nie hereinkommt — projiziert wird vorher in der Seite
 * (Regel 29).
 */

export interface PublicMatchdayProps {
  matchday: Matchday;
  timeZone: string;
  /** Kuerzel je Person. Fehlt eine Id, gilt der Platz als unbekannt. */
  initials: ReadonlyMap<string, string>;
}

const initialsFor = (slot: Slot, initials: ReadonlyMap<string, string>): string | null =>
  slot.assignment ? (initials.get(slot.assignment.refereeId) ?? '?') : null;

const slotLabel = (slot: Slot, initials: ReadonlyMap<string, string>): string =>
  `${SLOT_LABELS[slot.index]}: ${initialsFor(slot, initials) ?? 'frei'}`;

const substituteLabel = (
  slots: readonly Slot[],
  initials: ReadonlyMap<string, string>,
): string => {
  const occupied = substituteSlots(slots).flatMap((slot) => {
    const value = initialsFor(slot, initials);
    return value === null ? [] : [value];
  });
  return occupied.length > 0 ? occupied.join(', ') : '—';
};

export const PublicMatchday = ({ matchday, timeZone, initials }: PublicMatchdayProps) => (
  <section style={{ marginTop: 'var(--space-8)' }}>
    <div className="matchday-head">
      <h2 className="matchday-title">{matchday.label}</h2>
      <span className="text-muted" style={{ fontSize: '12px' }}>
        {matchday.summary}
      </span>
    </div>

    <div className="scroll-x only-wide">
      <table className="table">
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
                <Tag tone="neutral">{entry.game.leagueId}</Tag>
              </td>
              <td>{matchTitle(entry.game)}</td>
              <td className="text-muted">{entry.game.venue}</td>
              <td>
                <span className="row" style={{ gap: 'var(--space-2)' }}>
                  {refereeSlots(entry.slots).map((slot) => (
                    <Initials
                      key={slot.index}
                      initials={initialsFor(slot, initials)}
                      label={slotLabel(slot, initials)}
                    />
                  ))}
                </span>
              </td>
              <td style={{ fontSize: '13px' }}>{substituteLabel(entry.slots, initials)}</td>
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
            <div style={{ flex: 1 }}>
              <div className="game-card-title">{matchTitle(entry.game)}</div>
              <div className="text-muted" style={{ fontSize: '11px' }}>
                {timeLabel(entry.game.kickoff, timeZone)} · {entry.game.leagueId} · {entry.game.venue}
              </div>
              <div className="row" style={{ gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                {refereeSlots(entry.slots).map((slot) => (
                  <Initials
                    key={slot.index}
                    initials={initialsFor(slot, initials)}
                    size={20}
                    label={slotLabel(slot, initials)}
                  />
                ))}
                <span className="text-muted" style={{ fontSize: '11px' }}>
                  Ersatz: {substituteLabel(entry.slots, initials)}
                </span>
              </div>
            </div>
            <Status view={view} />
          </li>
        );
      })}
    </ul>
  </section>
);
