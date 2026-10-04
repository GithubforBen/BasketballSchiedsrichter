import type { Metadata } from 'next';
import Link from 'next/link';
import { Button, Tag } from '@/components/primitives';
import { AdminShell, single } from '@/components/admin/AdminShell';
import { CLUB } from '@/config/club';
import { matchTitle, timeLabel, dateLabel } from '@/domain/schedule';
import { leagueDisplay } from '@/domain/league';
import { alertReminderConfirmRoute, editGameRoute } from '@/routes';
import { openGameReminderRecipients } from '@/server/admin/games';
import { requireAdmin } from '@/server/guard';
import { adminOverview } from '@/server/queries/admin-view';
import { loadSettings } from '@/server/queries/settings';
import { actOnAlertAction, sendReminderAction } from './actions';

/**
 * Offene Spiele und Meldungen.
 *
 * Jede Meldung traegt alles bei sich, was zum Handeln noetig ist: welches
 * Spiel, welche Liga, welcher Ort, was fehlt und wie viel Vorlauf bleibt.
 *
 * Was sich von hier aus tun laesst, haengt an der Art der Meldung:
 *
 * - **Schiedsrichter fehlt** — „Erinnerung senden“ schreibt alle an, die das
 *   Spiel pfeifen koennen. Davor steht eine Rueckfrage mit der Zahl der
 *   Empfaenger: jede Nachricht kostet (Regel 33).
 * - **Bestaetigung offen** — „Jetzt nachfassen“.
 * - **Ersatz fehlt** — nur „Bearbeiten“. „Ersatz anfordern“ stand hier frueher
 *   und ergab keinen Sinn: der Knopf fragt einen *eingetragenen* Ersatz, ob er
 *   uebernimmt, und diese Meldung sagt gerade, dass keiner eingetragen ist.
 */

export const metadata: Metadata = { title: `Meldungen · ${CLUB.appName}` };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/*
 * Der Farbbalken links an der Meldung. Er ist Flaeche, keine Schrift, und
 * behaelt deshalb den vollen Ton aus dem Mockup — Flaechen brauchen 3:1.
 */
const BAR_COLORS: Record<string, string> = {
  unfilled: 'var(--status-open)',
  'confirmation-overdue': 'var(--status-substitute-missing)',
  'substitute-missing': 'var(--status-substitute-missing)',
};

/** Was die Rueckfrage zur Erinnerung zeigt. */
type ReminderPrompt =
  | { readonly gameId: string; readonly count: number }
  | { readonly gameId: string; readonly blocked: string };

const Alerts = async ({ searchParams }: PageProps) => {
  const now = new Date();
  const user = await requireAdmin(now);
  const params = await searchParams;

  const settings = await loadSettings();
  const { alerts, matchdays, kpis } = await adminOverview(settings, now);
  const gameById = new Map(
    matchdays.flatMap((day) => day.games.map((entry) => [entry.game.id, entry.game] as const)),
  );

  /*
   * Die Rueckfrage vor „an alle senden“. Gezaehlt wird mit derselben Funktion,
   * die danach verschickt — die Zahl hier ist die Zahl der Nachrichten.
   */
  const askedFor = single(params.erinnern);
  let prompt: ReminderPrompt | null = null;
  if (askedFor) {
    const recipients = await openGameReminderRecipients(askedFor, now);
    prompt = !recipients.ok
      ? { gameId: askedFor, blocked: recipients.message }
      : recipients.recipientIds.length === 0
        ? {
            gameId: askedFor,
            blocked: 'Für dieses Spiel gibt es niemanden, der angeschrieben werden könnte.',
          }
        : { gameId: askedFor, count: recipients.recipientIds.length };
  }
  const promptGame = prompt ? gameById.get(prompt.gameId) : undefined;

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
      {prompt ? (
        <div className="banner">
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '15px' }}>
            {'count' in prompt
              ? `${prompt.count} Schiedsrichter ${prompt.count === 1 ? 'wird' : 'werden'} jetzt angeschrieben`
              : 'Erinnerung nicht möglich'}
          </div>
          <p style={{ fontSize: '13px', marginTop: 'var(--space-1)' }}>
            {promptGame ? (
              <>
                {matchTitle(promptGame)} · {dateLabel(promptGame.kickoff, CLUB.timeZone)} ·{' '}
                {timeLabel(promptGame.kickoff, CLUB.timeZone)}.{' '}
              </>
            ) : null}
            {'count' in prompt
              ? prompt.count === 1
                ? 'Die Nachricht geht an die eine Person, die dieses Spiel pfeifen kann und noch nicht eingetragen ist. Wirklich senden?'
                : `Die Nachricht geht an alle ${prompt.count}, die dieses Spiel pfeifen können und noch nicht eingetragen sind. Wirklich an alle senden?`
              : prompt.blocked}
          </p>
          <div className="row">
            {'count' in prompt ? (
              <form action={sendReminderAction}>
                <input type="hidden" name="spiel" value={prompt.gameId} />
                <Button type="submit" variant="primary">
                  {prompt.count === 1 ? 'Ja, senden' : `Ja, an alle ${prompt.count} senden`}
                </Button>
              </form>
            ) : null}
            <Link href="/meldungen" className="btn btn-secondary">
              {'count' in prompt ? 'Abbrechen' : 'Schließen'}
            </Link>
          </div>
        </div>
      ) : null}

      {alerts.length === 0 ? (
        /*
         * Zwei sehr verschiedene Gruende fuehren zu einer leeren Liste, und
         * frueher stand fuer beide derselbe Satz da: "alle kommenden Spiele
         * sind besetzt und bestaetigt". Wer einen leeren Spielplan hatte, las
         * damit eine Entwarnung, die niemand gegeben hatte. Also sagt die
         * Seite jetzt, worauf sie sich stuetzt.
         */
        <p className="lead text-muted">
          {kpis.planned === 0
            ? 'Es stehen keine kommenden Spiele im Spielplan — deshalb gibt es hier nichts zu melden.'
            : `Nichts zu tun: alle ${kpis.planned} kommenden Spiele sind besetzt und bestätigt.`}
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {alerts.map((alert, index) => {
            const game = gameById.get(alert.gameId);
            const color = BAR_COLORS[alert.kind] ?? 'var(--status-open)';
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
                        {timeLabel(game.kickoff, CLUB.timeZone)} · {leagueDisplay(game)} · {game.venue}
                      </span>
                    ) : null}
                  </div>
                  <p style={{ fontSize: '13px', marginTop: 'var(--space-2)' }}>{alert.detail}</p>
                  <div className="text-muted" style={{ fontSize: '12px' }}>
                    {alert.meta}
                  </div>
                </div>
                <div className="row">
                  {alert.kind === 'unfilled' ? (
                    <Link
                      href={alertReminderConfirmRoute(alert.gameId)}
                      className="btn btn-primary"
                    >
                      Erinnerung senden
                    </Link>
                  ) : null}
                  {alert.kind === 'confirmation-overdue' ? (
                    <form action={actOnAlertAction}>
                      <input type="hidden" name="art" value={alert.kind} />
                      <input type="hidden" name="spiel" value={alert.gameId} />
                      <Button type="submit" variant="primary">
                        Jetzt nachfassen
                      </Button>
                    </form>
                  ) : null}
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
