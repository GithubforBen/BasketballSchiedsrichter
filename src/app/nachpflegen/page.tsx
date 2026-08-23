import type { Metadata } from 'next';
import { Button, Note } from '@/components/primitives';
import { AdminShell, single } from '@/components/admin/AdminShell';
import { CLUB } from '@/config/club';
import { dateLabel, matchTitle } from '@/domain/schedule';
import { requireAdmin } from '@/server/guard';
import { pendingAppearances } from '@/server/queries/admin-view';
import { setAppearanceAction } from './actions';

/**
 * Spiele nachpflegen. Regel 27.
 *
 * Wer nachgerueckt ist, zaehlt automatisch — hier steht nur, was die App nicht
 * wissen kann: ob ein Ersatz spontan eingesprungen ist. Die Zahl ist
 * abrechnungsrelevant, deshalb bleibt sie korrigierbar.
 */

export const metadata: Metadata = { title: `Spiele nachpflegen · ${CLUB.appName}` };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const Appearances = async ({ searchParams }: PageProps) => {
  const now = new Date();
  const user = await requireAdmin(now);
  const params = await searchParams;
  const pending = await pendingAppearances(now);

  return (
    <AdminShell
      user={user}
      current="/nachpflegen"
      kicker={`${pending.length} offen`}
      title="Spiele nachpflegen"
      lead="Nur Ersatzplätze vergangener Spiele: War die Person tatsächlich im Einsatz?"
      hint={single(params.hinweis)}
      error={single(params.fehler)}
    >
      <Note>
        Gezählt wird, wer als Schiedsrichter auf dem Feld stand. Wer nachgerückt ist, zählt
        automatisch — hier geht es nur um Ersatzleute, die spontan eingesprungen sind. Die Zahl
        ist für die Abrechnung maßgeblich.
      </Note>

      {pending.length === 0 ? (
        <p className="text-muted" style={{ marginTop: 'var(--space-6)' }}>
          Nichts nachzupflegen — alle vergangenen Ersatz-Eintragungen sind entschieden.
        </p>
      ) : (
        <div className="scroll-x" style={{ marginTop: 'var(--space-6)' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Spiel</th>
                <th>Person</th>
                <th>Platz</th>
                <th>War im Einsatz?</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((entry) => (
                <tr key={`${entry.game.id}-${entry.slotIndex}`}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {dateLabel(entry.game.kickoff, CLUB.timeZone)}
                  </td>
                  <td>{matchTitle(entry.game)}</td>
                  <td>{entry.refereeName}</td>
                  <td className="text-muted">{entry.role}</td>
                  <td>
                    <span className="row" style={{ gap: 'var(--space-2)' }}>
                      <form action={setAppearanceAction}>
                        <input type="hidden" name="spiel" value={entry.game.id} />
                        <input type="hidden" name="platz" value={entry.slotIndex} />
                        <input type="hidden" name="wert" value="ja" />
                        <Button type="submit" variant="primary" className="btn-compact">
                          Ja, gepfiffen
                        </Button>
                      </form>
                      <form action={setAppearanceAction}>
                        <input type="hidden" name="spiel" value={entry.game.id} />
                        <input type="hidden" name="platz" value={entry.slotIndex} />
                        <input type="hidden" name="wert" value="nein" />
                        <Button type="submit" variant="secondary" className="btn-compact">
                          Nein
                        </Button>
                      </form>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
};

export default Appearances;
