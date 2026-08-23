import type { Metadata } from 'next';
import Link from 'next/link';
import { Button, Status, Tag } from '@/components/primitives';
import { AdminShell, single } from '@/components/admin/AdminShell';
import { CLUB } from '@/config/club';
import { statusOf, timeLabel, matchTitle } from '@/domain/schedule';
import { describeLeadTime } from '@/domain/time';
import { editGameRoute } from '@/routes';
import { requireAdmin } from '@/server/guard';
import { adminOverview, adminRows } from '@/server/queries/admin-view';
import { loadSettings } from '@/server/queries/settings';
import { nudgeAction } from './actions';

/**
 * Spieluebersicht: die Zahlen oben, darunter alle kommenden Spiele nach
 * Spieltagen getrennt.
 */

export const metadata: Metadata = { title: `Spielübersicht · ${CLUB.appName}` };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const Overview = async ({ searchParams }: PageProps) => {
  const now = new Date();
  const user = await requireAdmin(now);
  const params = await searchParams;

  const settings = await loadSettings();
  const { matchdays, kpis } = await adminOverview(settings, now);
  const rowsPerDay = await Promise.all(
    matchdays.map(async (day) => ({ day, rows: await adminRows(day, settings, now) })),
  );

  const tiles = [
    { value: kpis.planned, label: 'Spiele geplant', color: 'var(--color-text)' },
    { value: kpis.filled, label: 'voll besetzt', color: 'var(--status-filled)' },
    {
      value: kpis.substituteMissing,
      label: 'Ersatz fehlt',
      color: 'var(--status-substitute-missing)',
    },
    { value: kpis.open, label: 'offen', color: 'var(--status-open)' },
  ];

  return (
    <AdminShell
      user={user}
      current="/uebersicht"
      kicker="Adminbereich"
      title="Spielübersicht"
      lead="Nach Spieltagen getrennt. Alle kommenden Spiele mit ihrer Besetzung."
      hint={single(params.hinweis)}
      error={single(params.fehler)}
      actions={
        <Link href="/anlegen" className="btn btn-primary">
          + Spiele anlegen
        </Link>
      }
    >
      <ul className="kpi-row">
        {tiles.map((tile) => (
          <li key={tile.label}>
            <span className="kpi-value" style={{ color: tile.color }}>
              {tile.value}
            </span>
            <span className="text-muted kpi-label">{tile.label}</span>
          </li>
        ))}
      </ul>

      <div className="row" style={{ margin: 'var(--space-4) 0' }}>
        <form action={nudgeAction}>
          <Button type="submit" variant="secondary">
            Erinnerung an alle offenen Spiele
          </Button>
        </form>
        <Link href="/meldungen" className="btn btn-primary">
          Offene Spiele &amp; Meldungen
        </Link>
      </div>

      {rowsPerDay.length === 0 ? (
        <p className="text-muted">Zurzeit sind keine kommenden Spiele eingetragen.</p>
      ) : (
        rowsPerDay.map(({ day, rows }) => (
          <section key={day.key} style={{ marginTop: 'var(--space-8)' }}>
            <div className="matchday-head">
              <h2 className="matchday-title">{day.label}</h2>
              <span className="text-muted" style={{ fontSize: '12px' }}>
                {day.summary}
              </span>
              <span
                className="text-muted"
                style={{ fontSize: '12px', marginLeft: 'auto' }}
              >
                Anpfiff {describeLeadTime(day.firstKickoff, now)}
              </span>
            </div>

            <div className="scroll-x">
              <table className="table">
                <thead>
                  <tr>
                    <th>Zeit</th>
                    <th>Liga</th>
                    <th>Spiel</th>
                    <th>Ort</th>
                    <th>Schiedsrichter</th>
                    <th>Ersatz</th>
                    <th>Bestätigt</th>
                    <th>Status</th>
                    <th>
                      <span className="visually-hidden">Aktion</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const entry = day.games[index];
                    return (
                      <tr key={row.game.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {timeLabel(row.game.kickoff, CLUB.timeZone)}
                        </td>
                        <td>
                          <Tag tone="neutral">{row.game.leagueId}</Tag>
                        </td>
                        <td>{matchTitle(row.game)}</td>
                        <td className="text-muted">{row.game.venue}</td>
                        <td>{row.refereeNames.join(', ') || '—'}</td>
                        <td className="text-muted">{row.substituteNames.join(', ') || '—'}</td>
                        <td style={{ color: row.confirmationColor, fontSize: '12px' }}>
                          {row.confirmationLabel}
                        </td>
                        <td>{entry ? <Status view={statusOf(entry)} /> : null}</td>
                        <td>
                          <Link
                            href={editGameRoute(row.game.id)}
                            className="btn btn-ghost btn-compact"
                          >
                            Bearbeiten
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </AdminShell>
  );
};

export default Overview;
