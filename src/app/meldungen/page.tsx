import type { Metadata } from 'next';
import Link from 'next/link';
import { Button, Tag } from '@/components/primitives';
import { AdminShell, single } from '@/components/admin/AdminShell';
import { CLUB } from '@/config/club';
import { matchTitle, timeLabel, dateLabel } from '@/domain/schedule';
import { editGameRoute } from '@/routes';
import { requireAdmin } from '@/server/guard';
import { adminOverview } from '@/server/queries/admin-view';
import { loadSettings } from '@/server/queries/settings';
import { actOnAlertAction } from './actions';

/**
 * Offene Spiele und Meldungen.
 *
 * Jede Meldung traegt alles bei sich, was zum Handeln noetig ist: welches
 * Spiel, welche Liga, welcher Ort, was fehlt und wie viel Vorlauf bleibt.
 */

export const metadata: Metadata = { title: `Meldungen · ${CLUB.appName}` };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const COLORS: Record<string, string> = {
  unfilled: 'var(--status-open)',
  'confirmation-overdue': 'var(--status-substitute-missing)',
  'substitute-missing': 'var(--status-substitute-missing)',
};

const ACTION_LABELS: Record<string, string> = {
  unfilled: 'Erinnerung senden',
  'confirmation-overdue': 'Jetzt nachfassen',
  'substitute-missing': 'Ersatz anfordern',
};

const Alerts = async ({ searchParams }: PageProps) => {
  const now = new Date();
  const user = await requireAdmin(now);
  const params = await searchParams;

  const settings = await loadSettings();
  const { alerts, matchdays } = await adminOverview(settings, now);
  const gameById = new Map(
    matchdays.flatMap((day) => day.games.map((entry) => [entry.game.id, entry.game] as const)),
  );

  return (
    <AdminShell
      user={user}
      current="/meldungen"
      kicker={`${alerts.length} ${alerts.length === 1 ? 'Meldung' : 'Meldungen'}`}
      title="Offene Spiele & Meldungen"
      lead="Das Dringendste steht oben — sortiert nach dem Anpfiff."
      hint={single(params.hinweis)}
      error={single(params.fehler)}
    >
      {alerts.length === 0 ? (
        <p className="text-muted">
          Nichts zu tun: alle kommenden Spiele sind besetzt und bestätigt.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {alerts.map((alert, index) => {
            const game = gameById.get(alert.gameId);
            const color = COLORS[alert.kind] ?? 'var(--status-open)';
            return (
              <li key={`${alert.gameId}-${alert.kind}-${index}`} className="alert">
                <span className="alert-bar" style={{ background: color }} aria-hidden="true" />
                <div>
                  <div className="row" style={{ gap: 'var(--space-2)', alignItems: 'baseline' }}>
                    <Tag tone="outline">{alert.label}</Tag>
                    <span
                      style={{
                        fontFamily: 'var(--font-heading)',
                        fontWeight: 800,
                        fontSize: '16px',
                      }}
                    >
                      {game ? matchTitle(game) : alert.gameId}
                    </span>
                    {game ? (
                      <span className="text-muted" style={{ fontSize: '12px' }}>
                        {dateLabel(game.kickoff, CLUB.timeZone)} ·{' '}
                        {timeLabel(game.kickoff, CLUB.timeZone)} · {game.leagueId} · {game.venue}
                      </span>
                    ) : null}
                  </div>
                  <p style={{ fontSize: '13px', marginTop: 'var(--space-2)' }}>{alert.detail}</p>
                  <div className="text-muted" style={{ fontSize: '12px' }}>
                    {alert.meta}
                  </div>
                </div>
                <div className="row">
                  <form action={actOnAlertAction}>
                    <input type="hidden" name="art" value={alert.kind} />
                    <input type="hidden" name="spiel" value={alert.gameId} />
                    <Button type="submit" variant="primary">
                      {ACTION_LABELS[alert.kind] ?? 'Erinnerung senden'}
                    </Button>
                  </form>
                  <Link href={editGameRoute(alert.gameId)} className="btn btn-secondary">
                    Bearbeiten
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </AdminShell>
  );
};

export default Alerts;
