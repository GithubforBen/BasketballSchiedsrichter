import type { Metadata } from 'next';
import Link from 'next/link';
import { Button, Field, Input, Note, Tag } from '@/components/primitives';
import { AdminShell, single } from '@/components/admin/AdminShell';
import { CLUB } from '@/config/club';
import { CSV_COLUMNS, CSV_EXAMPLE } from '@/domain/csv';
import { licenseLabel } from '@/domain/license';
import { qualifiedReferees } from '@/domain/rules';
import { requireAdmin } from '@/server/guard';
import { adminOverview, loadLeagues } from '@/server/queries/admin-view';
import { previewCsv } from '@/server/admin/games';
import { loadSettings } from '@/server/queries/settings';
import { createGameAction, importCsvAction } from './actions';

/**
 * Spiele anlegen — einzeln oder per CSV.
 *
 * Die CSV-Vorschau zeigt vor dem Import, was entstehen wuerde: was neu ist,
 * was es schon gibt und was unbrauchbar ist. Der Import selbst ist
 * wiederholbar; ein zweiter Lauf derselben Datei legt nichts doppelt an.
 */

export const metadata: Metadata = { title: `Spiele anlegen · ${CLUB.appName}` };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const NewGames = async ({ searchParams }: PageProps) => {
  const now = new Date();
  const user = await requireAdmin(now);
  const params = await searchParams;

  const tab = single(params.tab) === 'csv' ? 'csv' : 'einzeln';
  const csvText = single(params.csv) ?? CSV_EXAMPLE;
  const selectedLeague = single(params.liga);

  const [leagues, settings] = await Promise.all([loadLeagues(), loadSettings()]);
  const activeLeagues = leagues.filter((league) => league.active);
  const league = selectedLeague ?? activeLeagues[0]?.id ?? '';

  const [{ referees }, preview] = await Promise.all([
    adminOverview(settings, now),
    tab === 'csv' ? previewCsv(csvText) : Promise.resolve(null),
  ]);
  const qualified = qualifiedReferees(referees, league);

  return (
    <AdminShell
      user={user}
      current="/anlegen"
      kicker="Adminbereich"
      title="Spiele anlegen"
      hint={single(params.hinweis)}
      error={single(params.fehler)}
      actions={
        /*
         * Der Umschalter ist hier aus Links gebaut, nicht aus Radio-Feldern —
         * er wechselt die Seite. `aria-current` sagt, welcher gerade gilt; die
         * Einfaerbung kommt aus `.seg-opt[aria-current]` in app.css und nicht
         * mehr aus einem Inline-Stil, der die Kontrast-Korrektur umgangen hat.
         */
        <div className="seg">
          <Link
            href="/anlegen"
            className="seg-opt"
            aria-current={tab === 'einzeln' ? 'page' : undefined}
          >
            Einzeln
          </Link>
          <Link
            href="/anlegen?tab=csv"
            className="seg-opt"
            aria-current={tab === 'csv' ? 'page' : undefined}
          >
            CSV-Import
          </Link>
        </div>
      }
    >
      {tab === 'einzeln' ? (
        <div className="split">
          <form action={createGameAction}>
            <div className="form-grid">
              <Field label="Datum" htmlFor="datum">
                <Input id="datum" name="datum" type="date" required />
              </Field>
              <Field label="Uhrzeit" htmlFor="zeit">
                <Input id="zeit" name="zeit" type="time" required />
              </Field>
              <Field label="Ort / Halle" htmlFor="ort" className="form-grid-wide">
                <Input id="ort" name="ort" required placeholder="Sporthalle Nordstadt, Feld 2" />
              </Field>
              <Field label="Heim" htmlFor="heim">
                <Input id="heim" name="heim" required placeholder="BG Nordstadt U14" />
              </Field>
              <Field label="Gast" htmlFor="gast">
                <Input id="gast" name="gast" required placeholder="TV Ostheim U14" />
              </Field>
              <Field label="Liga / Altersklasse" htmlFor="liga">
                <select id="liga" name="liga" className="input" defaultValue={league} required>
                  {activeLeagues.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Nötige Lizenz" htmlFor="lizenz">
                <select id="lizenz" name="lizenz" className="input" defaultValue="E" required>
                  <option value="E">E — Einstiegslizenz</option>
                  <option value="D">D — nur mit D-Lizenz</option>
                </select>
              </Field>
            </div>

            <Note>
              Zwei gleichwertige Schiedsrichter und zwei Ersatzplätze — das gilt für jedes Spiel
              und ist nicht einstellbar. Wer die D-Lizenz hat, darf auch E-Spiele pfeifen; wer
              gar keine hinterlegt hat, kann sich in kein Spiel eintragen.
            </Note>

            <div className="row" style={{ marginTop: 'var(--space-6)' }}>
              <Button type="submit" variant="primary">
                Anlegen &amp; Schiedsrichter benachrichtigen
              </Button>
              <Link href="/uebersicht" className="btn btn-secondary">
                Abbrechen
              </Link>
            </div>
          </form>

          <aside>
            <h2 className="kicker">Qualifiziert für {league || '—'}</h2>
            <ul style={{ listStyle: 'none', margin: 'var(--space-3) 0 0', padding: 0 }}>
              {qualified.map((referee) => (
                <li
                  key={referee.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: 'var(--space-2) 0',
                    borderBottom: '1px solid var(--color-divider)',
                    fontSize: '13px',
                  }}
                >
                  <span>{referee.name}</span>
                  <span className="text-muted">
                    {referee.initials} · {licenseLabel(referee.license)}
                  </span>
                </li>
              ))}
              {qualified.length === 0 ? (
                <li className="text-muted" style={{ fontSize: '13px' }}>
                  Für diese Liga ist noch niemand qualifiziert.
                </li>
              ) : null}
            </ul>
            <p className="text-muted" style={{ fontSize: '11px', marginTop: 'var(--space-3)' }}>
              Wer zuerst einträgt, hat den Platz.
            </p>
          </aside>
        </div>
      ) : (
        <div className="split">
          <form action={importCsvAction}>
            <Field label="CSV einfügen" htmlFor="csv">
              <textarea
                id="csv"
                name="csv"
                className="input input-mono"
                rows={10}
                defaultValue={csvText}
                style={{ width: '100%' }}
              />
            </Field>
            <Note>
              Spalten: {CSV_COLUMNS.join('; ')}. Semikolon getrennt, erste Zeile Kopfzeile.
              Spiele, die es schon gibt, werden übersprungen — derselbe Import zweimal legt
              nichts doppelt an.
            </Note>
            <Button type="submit" variant="primary">
              Importieren
            </Button>
          </form>

          <aside>
            <h2 className="kicker">Vorschau</h2>
            {preview?.fileProblem ? (
              <p className="form-error">{preview.fileProblem}</p>
            ) : (
              <>
                <div className="row" style={{ margin: 'var(--space-3) 0' }}>
                  <Tag tone="accent">{preview?.fresh.length ?? 0} neu</Tag>
                  <Tag tone="neutral">
                    {(preview?.duplicates.length ?? 0) + (preview?.repeated.length ?? 0)} schon da
                  </Tag>
                  <Tag tone="outline">{preview?.invalid.length ?? 0} unbrauchbar</Tag>
                </div>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {preview?.fresh.map((row) => (
                    <li
                      key={`${row.line}`}
                      style={{
                        padding: 'var(--space-2) 0',
                        borderBottom: '1px solid var(--color-divider)',
                      }}
                    >
                      <div style={{ fontSize: '13px' }}>
                        {row.home} — {row.away}
                      </div>
                      <div className="text-muted" style={{ fontSize: '11px' }}>
                        {row.date} · {row.time} · {row.league} · {row.venue}
                      </div>
                    </li>
                  ))}
                  {preview?.invalid.map((row) => (
                    <li
                      key={`fehler-${row.line}`}
                      style={{
                        padding: 'var(--space-2) 0',
                        borderBottom: '1px solid var(--color-divider)',
                        color: 'var(--color-accent-700)',
                        fontSize: '12px',
                      }}
                    >
                      Zeile {row.line}: {row.problem}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="text-muted" style={{ fontSize: '11px', marginTop: 'var(--space-3)' }}>
              Die Vorschau zeigt den Stand der Datei im Feld. Nach dem Bearbeiten neu laden, um
              sie zu aktualisieren.
            </p>
          </aside>
        </div>
      )}
    </AdminShell>
  );
};

export default NewGames;
