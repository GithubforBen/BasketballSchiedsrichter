import type { Metadata } from 'next';
import { Button, Field, Input, Note, Tag } from '@/components/primitives';
import { AdminShell, single } from '@/components/admin/AdminShell';
import { CLUB } from '@/config/club';
import { formatPhone } from '@/server/auth/phone';
import { requireAdmin } from '@/server/guard';
import { loadLeagues } from '@/server/queries/admin-view';
import { loadAllReferees } from '@/server/queries/referees';
import {
  createRefereeAction,
  deleteRefereeAction,
  toggleQualificationAction,
  updateRefereeAction,
} from './actions';

/**
 * Schiedsrichter-Verwaltung mit Qualifikationsmatrix.
 *
 * Konten entstehen ausschliesslich hier — eine Selbstregistrierung gibt es
 * nicht. Ohne passende Qualifikation kann sich niemand fuer ein Spiel
 * eintragen (Regel 4), deshalb ist die Matrix der wichtigste Teil dieser Seite.
 */

export const metadata: Metadata = { title: `Schiedsrichter · ${CLUB.appName}` };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const Referees = async ({ searchParams }: PageProps) => {
  const user = await requireAdmin();
  const params = await searchParams;

  const [referees, leagues] = await Promise.all([loadAllReferees(), loadLeagues()]);
  const activeLeagues = leagues.filter((league) => league.active);

  return (
    <AdminShell
      user={user}
      current="/schiris"
      kicker="Adminbereich"
      title="Schiedsrichter"
      lead="Konten, Kürzel, Telefonnummern und Qualifikationen — nur hier änderbar."
      hint={single(params.hinweis)}
      error={single(params.fehler)}
    >
      <div className="scroll-x">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Kürzel</th>
              <th>Telefon</th>
              <th>Rolle</th>
              {activeLeagues.map((league) => (
                <th key={league.id}>{league.name}</th>
              ))}
              <th>Aktiv</th>
              <th>
                <span className="visually-hidden">Speichern</span>
              </th>
              <th>
                <span className="visually-hidden">Löschen</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {referees.map((referee) => (
              <tr key={referee.id}>
                <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 800 }}>
                  {referee.name}
                </td>
                <td>
                  <Input
                    form={`person-${referee.id}`}
                    name="kuerzel"
                    defaultValue={referee.initials}
                    style={{ width: '72px' }}
                    aria-label={`Kürzel von ${referee.name}`}
                  />
                </td>
                <td>
                  <Input
                    form={`person-${referee.id}`}
                    name="telefon"
                    defaultValue={formatPhone(referee.phone)}
                    style={{ width: '170px', fontVariantNumeric: 'tabular-nums' }}
                    aria-label={`Telefonnummer von ${referee.name}`}
                  />
                </td>
                <td>
                  <select
                    form={`person-${referee.id}`}
                    name="rolle"
                    className="input"
                    defaultValue={referee.role}
                    aria-label={`Rolle von ${referee.name}`}
                    style={{ width: '110px' }}
                  >
                    <option value="referee">Schiri</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                {activeLeagues.map((league) => {
                  const on = referee.qualifications.includes(league.id);
                  return (
                    <td key={league.id}>
                      <form action={toggleQualificationAction}>
                        <input type="hidden" name="person" value={referee.id} />
                        <input type="hidden" name="liga" value={league.id} />
                        <input type="hidden" name="wert" value={on ? 'aus' : 'an'} />
                        <button
                          type="submit"
                          className="matrix-check"
                          aria-pressed={on}
                          aria-label={`${league.name} für ${referee.name} ${on ? 'entziehen' : 'erteilen'}`}
                        >
                          {on ? '✓' : ''}
                        </button>
                      </form>
                    </td>
                  );
                })}
                <td>
                  <input
                    form={`person-${referee.id}`}
                    type="checkbox"
                    name="aktiv"
                    value="an"
                    defaultChecked={referee.active}
                    aria-label={`${referee.name} ist aktiv`}
                    style={{ accentColor: 'var(--color-accent)' }}
                  />
                </td>
                <td>
                  <form action={updateRefereeAction} id={`person-${referee.id}`}>
                    <input type="hidden" name="person" value={referee.id} />
                    <Button type="submit" variant="ghost" className="btn-compact">
                      Speichern
                    </Button>
                  </form>
                </td>
                <td>
                  {/*
                    Löschen ist unumkehrbar und braucht deshalb eine bewusste
                    Bestätigung. Sie steht als Kästchen im Formular und wird auf
                    dem Server erneut geprüft — eine Rückfrage, die nur im
                    Browser existiert, ist keine.
                  */}
                  <form action={deleteRefereeAction} className="delete-cell">
                    <input type="hidden" name="person" value={referee.id} />
                    <label className="check-inline">
                      <input type="checkbox" name="bestaetigt" value="ja" />
                      <span className="visually-hidden">
                        Löschen von {referee.name} bestätigen
                      </span>
                      <span aria-hidden="true">sicher?</span>
                    </label>
                    <Button type="submit" variant="ghost" className="btn-compact">
                      Löschen
                    </Button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Note>
        Nur qualifizierte Schiedsrichter können sich für ein Spiel eintragen. Wird eine
        Qualifikation entzogen, bleiben bestehende Eintragungen erhalten — sie einfach zu löschen
        würde ein Spiel unbemerkt unbesetzt lassen.
      </Note>

      <section style={{ marginTop: 'var(--space-8)', maxWidth: '640px' }}>
        <h2 className="kicker">Schiedsrichter anlegen</h2>
        <form action={createRefereeAction}>
          <div className="form-grid" style={{ marginTop: 'var(--space-3)' }}>
            <Field label="Name" htmlFor="neu-name">
              <Input id="neu-name" name="name" required placeholder="Vorname Nachname" />
            </Field>
            <Field label="Kürzel" htmlFor="neu-kuerzel" hint="Zwei bis vier Buchstaben">
              <Input id="neu-kuerzel" name="kuerzel" required placeholder="JK" maxLength={4} />
            </Field>
            <Field label="Telefonnummer" htmlFor="neu-telefon" hint="Für die Anmeldung">
              <Input id="neu-telefon" name="telefon" type="tel" required placeholder="0151 23456789" />
            </Field>
            <Field label="Rolle" htmlFor="neu-rolle">
              <select id="neu-rolle" name="rolle" className="input" defaultValue="referee">
                <option value="referee">Schiedsrichter</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
          </div>
          <Button type="submit" variant="primary">
            + Schiedsrichter anlegen
          </Button>
        </form>
        <p className="text-muted" style={{ fontSize: '12px', marginTop: 'var(--space-3)' }}>
          <Tag tone="neutral">Hinweis</Tag> Qualifikationen werden nach dem Anlegen in der Tabelle
          oben vergeben.
        </p>
      </section>
    </AdminShell>
  );
};

export default Referees;
