import type { Metadata } from 'next';
import Link from 'next/link';
import { Button, Input, Note, Tag } from '@/components/primitives';
import { AdminShell, single } from '@/components/admin/AdminShell';
import { RefereeCsvImport } from '@/components/admin/RefereeCsvImport';
import { CLUB } from '@/config/club';
import { LICENSES } from '@/domain/license';
import { compareAdminsFirst, surnameOf } from '@/domain/name';
import { dateLabel } from '@/domain/schedule';
import { formatPhone } from '@/domain/phone';
import { REFEREE_CSV_EXAMPLE } from '@/domain/referee-csv';
import { requireAdmin } from '@/server/guard';
import { loadLeagues } from '@/server/queries/admin-view';
import {
  loadAllReferees,
  loadPasswordOverview,
  type PasswordOverview,
} from '@/server/queries/referees';
import { existingRefereeKeys } from '@/server/admin/referees';
import {
  createRefereeAction,
  deleteRefereeAction,
  importRefereeCsvAction,
  resetPasswordAction,
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

/** Kennung des Anlege-Formulars — die Felder der neuen Zeile zeigen darauf. */
const NEW_FORM = 'neue-person';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Der Passwortzustand einer Person. Regeln 35 bis 40.
 *
 * Das Start-Passwort steht hier im Klartext, und nur hier: es folgt aus dem
 * Namen und wird bei jedem Aufruf neu gerechnet. Damit muss es nirgends
 * gespeichert werden und kommt auch nicht — wie zuvor — über den Abfrageteil
 * einer Adresse in den Verlauf des Browsers.
 */
const PasswordCell = ({ entry }: { entry: PasswordOverview | undefined }) => {
  if (!entry || entry.state === 'own') {
    return <span className="text-muted">eigenes</span>;
  }
  if (entry.state === 'expired') {
    return <Tag tone="outline">abgelaufen</Tag>;
  }
  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      <code>{entry.startPassword}</code>
      <span className="text-muted" style={{ display: 'block', fontSize: '11px' }}>
        bis {entry.validUntil ? dateLabel(entry.validUntil, CLUB.timeZone) : '—'}
      </span>
    </span>
  );
};

const Referees = async ({ searchParams }: PageProps) => {
  const user = await requireAdmin();
  const params = await searchParams;

  const tab = single(params.tab) === 'csv' ? 'csv' : 'liste';

  const [referees, leagues, passwords, existingReferees] = await Promise.all([
    loadAllReferees(),
    loadLeagues(),
    loadPasswordOverview(),
    /*
     * Nur fuer die Vorschau des Imports. Sie braucht Nummern und Kuerzel des
     * Bestands, um zu sagen, wen es schon gibt — auf der Liste selbst waere
     * die Abfrage umsonst.
     */
    tab === 'csv' ? existingRefereeKeys() : Promise.resolve({ phones: [], initials: [] }),
  ]);
  const activeLeagues = leagues.filter((league) => league.active);
  /*
   * `loadAllReferees` liefert schon alphabetisch; hier kommen die Admins nach
   * vorn. Das ist eine Entscheidung dieser Seite und keine des Bestands —
   * ueberall sonst, etwa in der Besetzung eines Spiels, waere eine Liste, die
   * zwei Namen vorzieht, nur verwirrend.
   */
  const sortedReferees = [...referees].sort(compareAdminsFirst);
  const passwordOf = new Map(passwords.map((entry) => [entry.refereeId, entry]));
  /*
   * Die leere Zeile haengt an der Adresse und nicht an einem Zustand im
   * Browser: so ueberlebt sie die Rueckmeldung nach dem Anlegen, laesst sich
   * verlinken und braucht kein Javascript.
   */
  const draft = single(params.neu) === 'ja';

  return (
    <AdminShell
      user={user}
      current="/schiris"
      kicker="Adminbereich"
      title="Schiedsrichter"
      lead="Konten, Kürzel, Telefonnummern, Qualifikationen und Passwörter — nur hier änderbar."
      hint={single(params.hinweis)}
      error={single(params.fehler)}
      actions={
        <>
          {/* Umschalter aus Links, wie beim Spielplan: er wechselt die Seite. */}
          <div className="seg">
            <Link
              href="/schiris"
              className="seg-opt"
              aria-current={tab === 'liste' ? 'page' : undefined}
            >
              Liste
            </Link>
            <Link
              href="/schiris?tab=csv"
              className="seg-opt"
              aria-current={tab === 'csv' ? 'page' : undefined}
            >
              CSV-Import
            </Link>
          </div>
          {tab === 'liste' && !draft ? (
            <Link href="/schiris?neu=ja" className="btn btn-primary">
              + Schiedsrichter
            </Link>
          ) : null}
        </>
      }
    >
      {tab === 'csv' ? (
        <RefereeCsvImport
          action={importRefereeCsvAction}
          knownLeagues={leagues.map((league) => league.id)}
          existing={existingReferees}
          initialText={REFEREE_CSV_EXAMPLE}
        />
      ) : (
        <>
          {/*
            Der Rahmen scrollt hier in beide Richtungen und nicht mit der Seite:
            die Tabelle ist breiter als das Fenster *und* laenger, und der
            waagerechte Balken saesse sonst unter allen Zeilen. Warum das so
            gebaut ist, steht bei `.scroll-pane` in app.css.
          */}
          <div className="scroll-x scroll-pane">
            <table className="table">
              <thead>
                <tr>
                  <th>Nachname</th>
                  <th>Vorname</th>
                  <th>Kürzel</th>
                  <th>Telefon</th>
                  <th>Rolle</th>
                  <th>Lizenz</th>
                  {activeLeagues.map((league) => (
                    <th key={league.id}>{league.name}</th>
                  ))}
                  <th>Aktiv</th>
                  <th>Passwort</th>
                  <th>
                    <span className="visually-hidden">Speichern</span>
                  </th>
                  <th>
                    <span className="visually-hidden">Passwort zurücksetzen</span>
                  </th>
                  <th>
                    <span className="visually-hidden">Löschen</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {/*
              Die neue Person entsteht als Zeile in derselben Tabelle und nicht
              in einem Formular darunter. Sie sieht aus wie die anderen, traegt
              dieselben Felder — und vor allem gleich die Liga-Haekchen: ohne
              Qualifikation kann sich niemand eintragen (Regel 4), ein Konto
              ohne sie waere ein zweiter Arbeitsgang, den man vergisst.

              Die Felder gehoeren ueber `form` zum Anlege-Formular in der
              letzten Zelle. Ein Formular *in* der Zeile ginge nicht: eine
              Tabellenzeile darf kein <form> enthalten, das mehrere Zellen
              umspannt.
            */}
                {draft ? (
                  <tr>
                    <td>
                      <Input
                        form={NEW_FORM}
                        name="nachname"
                        required
                        placeholder="Schnorrenberger"
                        aria-label="Nachname der neuen Person"
                        style={{ width: '160px' }}
                      />
                    </td>
                    <td>
                      <Input
                        form={NEW_FORM}
                        name="vorname"
                        required
                        placeholder="Linda"
                        aria-label="Vorname der neuen Person"
                        style={{ width: '110px' }}
                      />
                    </td>
                    <td>
                      <Input
                        form={NEW_FORM}
                        name="kuerzel"
                        required
                        maxLength={4}
                        placeholder="JK"
                        aria-label="Kürzel der neuen Person"
                        style={{ width: '72px' }}
                      />
                    </td>
                    <td>
                      <Input
                        form={NEW_FORM}
                        name="telefon"
                        type="tel"
                        required
                        placeholder="0151 23456789"
                        aria-label="Telefonnummer der neuen Person"
                        style={{ width: '170px' }}
                      />
                    </td>
                    <td>
                      <select
                        form={NEW_FORM}
                        name="rolle"
                        className="input"
                        defaultValue="referee"
                        aria-label="Rolle der neuen Person"
                        style={{ width: '110px' }}
                      >
                        <option value="referee">Schiri</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td>
                      <select
                        form={NEW_FORM}
                        name="lizenz"
                        className="input"
                        defaultValue=""
                        aria-label="Lizenz der neuen Person"
                        style={{ width: '100px' }}
                      >
                        <option value="">keine</option>
                        {LICENSES.map((license) => (
                          <option key={license} value={license}>
                            {license}
                          </option>
                        ))}
                      </select>
                    </td>
                    {activeLeagues.map((league) => (
                      <td key={league.id}>
                        <input
                          form={NEW_FORM}
                          type="checkbox"
                          name="ligen"
                          value={league.id}
                          aria-label={`${league.name} für die neue Person`}
                          style={{ accentColor: 'var(--color-accent)' }}
                        />
                      </td>
                    ))}
                    <td>
                      <span className="text-muted">neu</span>
                    </td>
                    <td>
                      <span
                        className="text-muted"
                        style={{ whiteSpace: 'nowrap', fontSize: '11px' }}
                      >
                        aus dem Namen
                      </span>
                    </td>
                    <td>
                      <form action={createRefereeAction} id={NEW_FORM}>
                        <Button type="submit" variant="primary" className="btn-compact">
                          Anlegen
                        </Button>
                      </form>
                    </td>
                    <td colSpan={2}>
                      <Link href="/schiris" className="btn btn-ghost btn-compact">
                        Abbrechen
                      </Link>
                    </td>
                  </tr>
                ) : null}
                {sortedReferees.map((referee) => (
                  <tr key={referee.id}>
                    <td>
                      {/*
                    Der Nachname war hier lange nur Text. Damit liess sich ein
                    Konto, das mit dem Nachnamen allein in der Namensspalte
                    stand, nicht mehr geradeziehen — und sein Start-Passwort
                    hiess nach Regel 35 auch nur so.
                  */}
                      <Input
                        form={`person-${referee.id}`}
                        name="nachname"
                        defaultValue={surnameOf(referee.name, referee.firstName)}
                        style={{ width: '160px' }}
                        aria-label={`Nachname von ${referee.name}`}
                      />
                    </td>
                    <td>
                      {/*
                    Der Vorname steht in jeder Nachricht. Er ist ein eigenes
                    Feld, weil das erste Wort des Namens nicht immer der
                    Vorname ist.
                  */}
                      <Input
                        form={`person-${referee.id}`}
                        name="vorname"
                        defaultValue={referee.firstName}
                        style={{ width: '110px' }}
                        aria-label={`Vorname von ${referee.name}`}
                      />
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
                        style={{
                          width: '170px',
                          fontVariantNumeric: 'tabular-nums',
                        }}
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
                    <td>
                      {/*
                    Ohne Lizenz kann sich niemand eintragen — sehen darf er
                    trotzdem jedes Spiel. Deshalb ist "keine" ein gültiger Wert
                    und nicht bloß ein leeres Feld.
                  */}
                      <select
                        form={`person-${referee.id}`}
                        name="lizenz"
                        className="input"
                        defaultValue={referee.license ?? ''}
                        aria-label={`Lizenz von ${referee.name}`}
                        style={{ width: '100px' }}
                      >
                        <option value="">keine</option>
                        {LICENSES.map((license) => (
                          <option key={license} value={license}>
                            {license}
                          </option>
                        ))}
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
                    {/*
                  Reihenfolge wie in der Kopfzeile: erst „Aktiv“, dann
                  „Passwort“. Beide standen vertauscht — das Häkchen unter der
                  Passwortspalte, das Passwort unter „Aktiv“.
                */}
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
                      <PasswordCell entry={passwordOf.get(referee.id)} />
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
                    Regel 40: Das Passwort selbst steht nirgends — auch ein Admin
                    kann es nicht lesen, nur zurücksetzen. Danach gilt wieder das
                    Start-Passwort aus dem Namen, und die Person muss ein eigenes
                    setzen.
                  */}
                      <form action={resetPasswordAction}>
                        <input type="hidden" name="person" value={referee.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          className="btn-compact"
                          aria-label={`Passwort von ${referee.name} zurücksetzen`}
                        >
                          Passwort
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
            Eintragen kann sich nur, wer für die Liga qualifiziert ist <em>und</em> die nötige
            Lizenz hat: C deckt C, D und E ab, D deckt D und E, E nur E, ohne Lizenz geht gar
            nichts. Den Spielplan
            sieht weiterhin jeder. Wird eine Qualifikation oder eine Lizenz entzogen, bleiben
            bestehende Eintragungen erhalten — sie einfach zu löschen würde ein Spiel unbemerkt
            unbesetzt lassen.
          </Note>

          <p className="text-muted" style={{ fontSize: '12px', marginTop: 'var(--space-3)' }}>
            <Tag tone="neutral">Hinweis</Tag> „+ Schiedsrichter“ legt oben eine leere Zeile an —
            Qualifikationen werden dort gleich mit vergeben. Das Start-Passwort ist der Name, klein
            und zusammengeschrieben; es steht danach in der Spalte „Passwort“ und muss beim ersten
            Anmelden geändert werden.
          </p>
        </>
      )}
    </AdminShell>
  );
};

export default Referees;
