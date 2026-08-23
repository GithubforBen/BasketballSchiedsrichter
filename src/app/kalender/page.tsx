import type { Metadata } from 'next';
import { Note, Panel, TableWrap } from '@/components/primitives';
import { FOOTER_NAV, REFEREE_NAV, REFEREE_TABS } from '@/components/shell/navigation';
import { Shell } from '@/components/shell/Shell';
import { CLUB } from '@/config/club';
import { CONFIRMATION_LABELS } from '@/domain/confirmation';
import { dateLabel, matchTitle, timeLabel } from '@/domain/schedule';
import { ownRank } from '@/domain/stats';
import { requireUser } from '@/server/guard';
import { monthlyCounts, myGames, seasonRanking } from '@/server/queries/referee-view';
import { loadSettings } from '@/server/queries/settings';

/**
 * Kalender und Verlauf.
 *
 * Der Bildschirm, der sich nach dem ersten Login oeffnet: die eigenen naechsten
 * Spiele, der Verlauf und die Zahlen, die fuer die Abrechnung zaehlen.
 */

export const metadata: Metadata = { title: `Kalender & Verlauf · ${CLUB.appName}` };
export const dynamic = 'force-dynamic';

const CONFIRMATION_COLORS: Record<string, string> = {
  confirmed: 'var(--status-filled)',
  pending: 'var(--status-substitute-missing)',
  overdue: 'var(--status-open)',
  scheduled: 'var(--text-dim)',
  'not-required': 'var(--text-dim)',
};

const Calendar = async () => {
  const now = new Date();
  const user = await requireUser(now);
  const settings = await loadSettings();

  const [{ upcoming, past }, months, ranking] = await Promise.all([
    myGames(user.id, settings, now),
    monthlyCounts(user.id, now),
    seasonRanking(user.id, now),
  ]);

  const thisMonth = months[months.length - 1];
  const maxCount = Math.max(1, ...months.map((m) => m.count));
  const me = ownRank(ranking);

  return (
    <Shell
      nav={REFEREE_NAV}
      tabs={REFEREE_TABS}
      footerNav={FOOTER_NAV}
      current="/kalender"
      user={{ name: user.name, initials: user.initials }}
    >
      <div className="page-head">
        <div className="page-head-text">
          <div className="kicker kicker-accent">Deine Einsätze</div>
          <h1>Kalender &amp; Verlauf</h1>
          <p className="text-muted">Deine nächsten Spiele und was bisher gezählt hat.</p>
        </div>
      </div>

      <div className="calendar-grid">
        <div>
          <h2 className="kicker">Nächste Spiele</h2>
          {upcoming.length === 0 ? (
            <Note>
              Du bist zurzeit für kein Spiel eingetragen. Unter „Offene Spiele“ findest du freie
              Plätze.
            </Note>
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Zeit</th>
                  <th>Spiel</th>
                  <th>Ort</th>
                  <th>Rolle</th>
                  <th>Bestätigung</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((entry) => (
                  <tr key={entry.game.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {dateLabel(entry.game.kickoff, CLUB.timeZone)}
                    </td>
                    <td>{timeLabel(entry.game.kickoff, CLUB.timeZone)}</td>
                    <td>{matchTitle(entry.game)}</td>
                    <td className="text-muted">{entry.game.venue}</td>
                    <td>{entry.role}</td>
                    <td style={{ color: CONFIRMATION_COLORS[entry.confirmation] }}>
                      {CONFIRMATION_LABELS[entry.confirmation]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}

          <h2 className="kicker" style={{ marginTop: 'var(--space-8)' }}>
            Vergangen
          </h2>
          {past.length === 0 ? (
            <Note>Noch keine vergangenen Einsätze.</Note>
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Spiel</th>
                  <th>Rolle</th>
                  <th>Gezählt</th>
                </tr>
              </thead>
              <tbody>
                {past.map((entry) => (
                  <tr key={entry.game.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {dateLabel(entry.game.kickoff, CLUB.timeZone)}
                    </td>
                    <td>{matchTitle(entry.game)}</td>
                    <td className="text-muted">{entry.role}</td>
                    <td
                      style={{
                        color: entry.countsForStats ? 'var(--status-filled)' : 'var(--text-dim)',
                      }}
                    >
                      {entry.countsForStats ? 'gezählt' : 'zählt nicht'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </div>

        <div className="stack" style={{ gap: 'var(--space-6)' }}>
          <Panel>
            <div className="kicker kicker-accent">{thisMonth?.label ?? 'Dieser Monat'}</div>
            <div className="statistic-number">{thisMonth?.count ?? 0}</div>
            <div className="text-muted" style={{ fontSize: '12px' }}>
              gepfiffene Spiele (als Schiedsrichter)
            </div>
            <Note>
              Gezählt wird nur, wo du als Schiedsrichter auf dem Feld standst. Ersatz ohne Einsatz
              zählt nicht — Ersatz mit Einsatz zählt.
            </Note>
            <hr className="hr" />
            <ul className="month-bars">
              {months.map((month) => (
                <li key={month.key}>
                  <span className="month-name text-muted">{month.label}</span>
                  <span
                    className="month-bar"
                    style={{ width: `${Math.round((month.count / maxCount) * 100)}%` }}
                    aria-hidden="true"
                  />
                  <span className="month-count">{month.count}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <div className="kicker kicker-accent">Ranking Saison</div>
            <div className="row" style={{ alignItems: 'baseline', gap: 'var(--space-2)' }}>
              <span className="statistic-rank">#{me?.rank ?? '—'}</span>
              <span className="text-muted" style={{ fontSize: '12px' }}>
                von {ranking.length} Schiedsrichtern
              </span>
            </div>
            <ul className="ranking">
              {ranking.map((row) => (
                <li key={row.rank} className={row.isMe ? 'ranking-me' : undefined}>
                  <span className="ranking-place">#{row.rank}</span>
                  <span className="ranking-name">{row.label}</span>
                  <span className="ranking-count">{row.count ?? '—'}</span>
                </li>
              ))}
            </ul>
            <div className="text-muted" style={{ fontSize: '11px' }}>
              Andere erscheinen ohne Namen und ohne Zahl.
            </div>
          </Panel>
        </div>
      </div>
    </Shell>
  );
};

export default Calendar;
