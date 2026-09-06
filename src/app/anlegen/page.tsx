import type { Metadata } from 'next';
import Link from 'next/link';
import { Button, Field, Input, Note } from '@/components/primitives';
import { AdminShell, single } from '@/components/admin/AdminShell';
import { CsvImport } from '@/components/admin/CsvImport';
import { CLUB } from '@/config/club';
import { CSV_EXAMPLE } from '@/domain/csv';
import { LICENSES, licenseLabel, licenseRequirementLabel } from '@/domain/license';
import { qualifiedReferees } from '@/domain/rules';
import { requireAdmin } from '@/server/guard';
import { adminOverview, loadLeagues } from '@/server/queries/admin-view';
import { existingGameCounts } from '@/server/admin/games';
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

  const [{ referees }, existingGames] = await Promise.all([
    adminOverview(settings, now),
    tab === 'csv' ? existingGameCounts() : Promise.resolve([]),
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
              <Field label="Uhrzeit (24 Stunden)" htmlFor="zeit">
                {/*
                  Textfeld statt `type="time"`: dessen Anzeige folgt der
                  Spracheinstellung des Browsers, und auf einem englischen
                  Chrome stand dort "06:00 PM".
                */}
                <Input
                  id="zeit"
                  name="zeit"
                  inputMode="numeric"
                  pattern="([01]?[0-9]|2[0-3])[:.][0-5][0-9]"
                  maxLength={5}
                  placeholder="18:30"
                  title="Uhrzeit als HH:MM, zum Beispiel 18:30"
                  required
                />
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
              <Field label="Liga oder Kürzel" htmlFor="liga">
                {/*
                  Freitext mit Vorschlaegen statt Auswahlliste. Der Verband
                  schreibt "XU14Bz", und genau das soll am Spiel stehen — die
                  Altersklasse wird daraus gedeutet, wie beim CSV-Import.
                */}
                <Input
                  id="liga"
                  name="liga"
                  list="ligen"
                  defaultValue={league}
                  placeholder="U14 oder XU14Bz"
                  required
                />
                <datalist id="ligen">
                  {activeLeagues.map((entry) => (
                    <option key={entry.id} value={entry.id} />
                  ))}
                </datalist>
              </Field>
              <Field label="Nötige Lizenz" htmlFor="lizenz">
                <select id="lizenz" name="lizenz" className="input" defaultValue="E" required>
                  {LICENSES.map((license) => (
                    <option key={license} value={license}>
                      {licenseRequirementLabel(license)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Note>
              Zwei gleichwertige Schiedsrichter und zwei Ersatzplätze — das gilt für jedes Spiel
              und ist nicht einstellbar. Die höhere Lizenz deckt die niedrigeren mit ab: C
              darf C, D und E pfeifen, D darf D und E, E nur E. Wer gar keine hinterlegt hat,
              kann sich in kein Spiel eintragen. Bei der Liga darfst du das Kürzel des Verbands
              eintragen — aus „XU14Bz“ wird U14, was keine Altersklasse nennt, gilt als
              Senioren.
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
        <CsvImport
          action={importCsvAction}
          knownLeagues={leagues.map((entry) => entry.id)}
          existing={existingGames}
          timeZone={CLUB.timeZone}
          initialText={csvText}
        />
      )}
    </AdminShell>
  );
};

export default NewGames;
