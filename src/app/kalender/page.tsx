import type { Metadata } from 'next';
import { Fragment } from 'react';
import { CalendarExport, type CalendarExportGame } from '@/components/calendar/CalendarExport';
import { OwnGameActions, type OwnGameActionsProps } from '@/components/calendar/OwnGameActions';
import { Note, Panel, TableWrap } from '@/components/primitives';
import { FOOTER_NAV, navFor } from '@/components/shell/navigation';
import { Shell } from '@/components/shell/Shell';
import { CLUB } from '@/config/club';
import { CONFIRMATION_LABELS, type ConfirmationState } from '@/domain/confirmation';
import { dateLabel, matchdayLabel, matchTitle, timeLabel } from '@/domain/schedule';
import { slotViews, substituteRequestView } from '@/domain/slot-actions';
import { slotKind } from '@/domain/slots';
import { ownRank } from '@/domain/stats';
import { requireUser } from '@/server/guard';
import { gamesWithPendingRequest, gamesWithSlotsByIds } from '@/server/queries/games';
import { loadReferee } from '@/server/queries/referees';
import { monthlyCounts, myGames, seasonRanking } from '@/server/queries/referee-view';
import { loadSettings } from '@/server/queries/settings';

/**
 * Kalender und Verlauf.
 *
 * Der Bildschirm, der sich nach dem ersten Login oeffnet: die eigenen naechsten
 * Spiele, der Verlauf und die Zahlen, die fuer die Abrechnung zaehlen.
 *
 * Die Spiele stehen zweimal da: am Handy als Karten, ab 768px als Tabelle —
 * derselbe Wechsel wie im oeffentlichen Spielplan (`.only-narrow`/`.only-wide`).
 * Sechs Spalten sind auf einem Telefon keine Tabelle mehr, sondern ein Streifen,
 * an dem man waagerecht entlangschiebt.
 *
 * An jedem kommenden Spiel stehen **Austragen** und — auf einem
 * Schiedsrichter-Platz — **Ersatz anfordern**. Das ist der Ort dafuer: es
 * sind die eigenen Spiele, und wer eines abgeben will, sucht es hier und
 * nicht zwischen allen Spielen eines Spieltags.
 */

export const metadata: Metadata = { title: `Kalender & Verlauf · ${CLUB.appName}` };
export const dynamic = 'force-dynamic';

/* Schriftvarianten der Ampel — die vollen Toene sind als Text zu blass. */
const CONFIRMATION_COLORS: Readonly<Record<ConfirmationState, string>> = {
  confirmed: 'var(--status-filled-text)',
  pending: 'var(--status-substitute-missing-text)',
  overdue: 'var(--status-open-text)',
  scheduled: 'var(--text-dim)',
  'not-required': 'var(--text-dim)',
};

/*
 * Dieselbe Ampel als Flaeche — der Streifen an der Karte. Flaechen brauchen
 * 3:1 und behalten deshalb den vollen Ton, genau wie bei `StatusView`.
 */
const CONFIRMATION_TONES: Readonly<Record<ConfirmationState, string>> = {
  confirmed: 'var(--status-filled)',
  pending: 'var(--status-substitute-missing)',
  overdue: 'var(--status-open)',
  scheduled: 'var(--color-divider)',
  'not-required': 'var(--color-divider)',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const single = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const Calendar = async ({ searchParams }: PageProps) => {
  const now = new Date();
  const user = await requireUser(now);
  const params = await searchParams;
  const settings = await loadSettings();

  const [{ upcoming, past }, months, ranking, referee, pendingRequests] = await Promise.all([
    myGames(user.id, settings, now),
    monthlyCounts(user.id, now),
    seasonRanking(user.id, now),
    loadReferee(user.id),
    gamesWithPendingRequest(now),
  ]);
  if (!referee) throw new Error(`Konto ${user.id} nicht gefunden`);

  /*
   * Ob Austragen und Ersatz anfordern gehen, haengt an allen vier Plaetzen
   * eines Spiels — ob noch ein Ersatz da ist, ob schon eine Anfrage laeuft.
   * Die eigene Liste kennt nur den eigenen Platz; die Besetzung kommt deshalb
   * hier dazu, fuer genau diese Spiele.
   */
  const fullGames = await gamesWithSlotsByIds(upcoming.map((entry) => entry.game.id));
  const actions = new Map<string, OwnGameActionsProps>();
  for (const entry of upcoming) {
    const full = fullGames.get(entry.game.id);
    if (!full) continue;
    const context = {
      game: full.game,
      slots: full.slots,
      referee,
      /* Fuer Austragen und Abgeben ohne Belang — Regel 6 betrifft nur das Eintragen. */
      sameDayAssignments: [],
      settings,
      now,
      timeZone: CLUB.timeZone,
      pendingRequest: pendingRequests.has(entry.game.id),
    };
    const own = slotViews(context).find((slot) => slot.isMine);
    const request =
      slotKind(entry.slotIndex) === 'referee' ? substituteRequestView(context) : null;
    actions.set(entry.game.id, {
      gameId: entry.game.id,
      withdraw: {
        possible: own?.action === 'withdraw',
        note: own?.reason ?? '',
      },
      substituteRequest: request ? { possible: request.possible, note: request.note } : null,
    });
  }

  const ownActions = (gameId: string) => {
    const own = actions.get(gameId);
    return own ? <OwnGameActions {...own} /> : null;
  };

  const hint = single(params.hinweis);
  const error = single(params.fehler);

  /*
   * Die Auswahlliste fuer die Kalenderdatei. Voreingestellt sind die Spiele,
   * in denen man selbst pfeift (Plaetze 0 und 1); Ersatzplaetze stehen mit in
   * der Liste, aber ohne Haken — dort haelt man sich bereit, und ob das ein
   * Termin ist, entscheidet jeder selbst (Regel 12).
   */
  const exportable: readonly CalendarExportGame[] = upcoming.map((entry) => ({
    id: entry.game.id,
    when: `${matchdayLabel(entry.game.kickoff, CLUB.timeZone)}, ${timeLabel(
      entry.game.kickoff,
      CLUB.timeZone,
    )} Uhr`,
    title: matchTitle(entry.game),
    detail: `${entry.role} · ${entry.game.venue}`,
    preselected: entry.slotIndex < 2,
  }));

  const thisMonth = months[months.length - 1];
  const maxCount = Math.max(1, ...months.map((m) => m.count));
  const me = ownRank(ranking);

  const { nav, tabs } = navFor(user.role);

  return (
    <Shell
      nav={nav}
      tabs={tabs}
      footerNav={FOOTER_NAV}
      current="/kalender"
      user={{ name: user.name, initials: user.initials }}
    >
      <div className="page-head">
        <div className="page-head-text">
          <div className="kicker kicker-accent">Deine Einsätze</div>
          <h1>Kalender &amp; Verlauf</h1>
          <p className="lead text-muted">Deine nächsten Spiele und was bisher gezählt hat.</p>
        </div>
      </div>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {hint ? <p className="form-success">{hint}</p> : null}

      <div className="calendar-grid">
        <div>
          <h2 className="kicker">Nächste Spiele</h2>
          {upcoming.length === 0 ? (
            <Note>
              Du bist zurzeit für kein Spiel eingetragen. Unter „Offene Spiele“ findest du freie
              Plätze.
            </Note>
          ) : (
            <>
              <div className="only-wide">
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
                    {upcoming.map((entry) => {
                      const own = actions.get(entry.game.id);
                      return (
                        <Fragment key={entry.game.id}>
                          <tr className={own ? 'row-with-actions' : undefined}>
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
                          {own ? (
                            <tr className="row-actions">
                              <td colSpan={6}>
                                <OwnGameActions {...own} />
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </TableWrap>
              </div>

              <ul className="card-list only-narrow">
                {upcoming.map((entry) => (
                  <li key={entry.game.id} className="game-card">
                    <span
                      className="game-card-bar"
                      style={{ background: CONFIRMATION_TONES[entry.confirmation] }}
                      aria-hidden="true"
                    />
                    <div className="game-card-text">
                      <div className="game-card-title">{matchTitle(entry.game)}</div>
                      <div className="text-muted" style={{ fontSize: '11px' }}>
                        {dateLabel(entry.game.kickoff, CLUB.timeZone)},{' '}
                        {timeLabel(entry.game.kickoff, CLUB.timeZone)} · {entry.game.venue}
                      </div>
                      <div style={{ fontSize: '11px', marginTop: 'var(--space-1)' }}>
                        {entry.role}
                        <span aria-hidden="true"> · </span>
                        <span style={{ color: CONFIRMATION_COLORS[entry.confirmation] }}>
                          {CONFIRMATION_LABELS[entry.confirmation]}
                        </span>
                      </div>
                      {ownActions(entry.game.id)}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          {exportable.length > 0 ? (
            <>
              <h2 className="kicker" style={{ marginTop: 'var(--space-8)' }}>
                In den eigenen Kalender
              </h2>
              <p className="text-muted" style={{ fontSize: '12px', marginTop: 'var(--space-2)' }}>
                Wähle aus, welche Spiele in die Datei sollen. Vorgewählt sind die, bei denen du
                pfeifst.
              </p>
              <CalendarExport games={exportable} />
            </>
          ) : null}

          <h2 className="kicker" style={{ marginTop: 'var(--space-8)' }}>
            Vergangen
          </h2>
          {past.length === 0 ? (
            <Note>Noch keine vergangenen Einsätze.</Note>
          ) : (
            <>
              <div className="only-wide">
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
                            color: entry.countsForStats
                              ? 'var(--status-filled-text)'
                              : 'var(--text-dim)',
                          }}
                        >
                          {entry.countsForStats ? 'gezählt' : 'zählt nicht'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              </div>

              <ul className="card-list only-narrow">
                {past.map((entry) => (
                  <li key={entry.game.id} className="game-card">
                    <div className="game-card-text">
                      <div className="game-card-title">{matchTitle(entry.game)}</div>
                      <div className="text-muted" style={{ fontSize: '11px' }}>
                        {dateLabel(entry.game.kickoff, CLUB.timeZone)} · {entry.role}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '11px',
                        whiteSpace: 'nowrap',
                        color: entry.countsForStats
                          ? 'var(--status-filled-text)'
                          : 'var(--text-dim)',
                      }}
                    >
                      {entry.countsForStats ? 'gezählt' : 'zählt nicht'}
                    </span>
                  </li>
                ))}
              </ul>
            </>
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
                  <span className="month-track" aria-hidden="true">
                    <span
                      className="month-bar"
                      style={{ width: `${Math.round((month.count / maxCount) * 100)}%` }}
                    />
                  </span>
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
