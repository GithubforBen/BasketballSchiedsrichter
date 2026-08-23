import type { Metadata } from 'next';
import { Button, Field, Input, Note } from '@/components/primitives';
import { AdminShell, single } from '@/components/admin/AdminShell';
import { CLUB } from '@/config/club';
import { ROTATION_WINDOW_LABELS } from '@/domain/rotation';
import { describeHours } from '@/domain/time';
import { requireAdmin } from '@/server/guard';
import { loadLeagues } from '@/server/queries/admin-view';
import { loadAlertSettings, loadSettings } from '@/server/queries/settings';
import { saveSettingsAction, setLeagueAction } from './actions';

/**
 * Einstellungen des Vereins.
 *
 * Die Qualifikationspruefung fehlt hier bewusst: sie ist Pflicht und nicht
 * abschaltbar (Regel 4). Ein Schalter, der nichts bewirkt, waere schlimmer als
 * gar keiner — deshalb steht sie als Hinweis da, nicht als Regler.
 */

export const metadata: Metadata = { title: `Einstellungen · ${CLUB.appName}` };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const CONFIRMATION_CHOICES = [24, 48, 72, 96];

const Switch = ({
  name,
  label,
  description,
  checked,
}: {
  name: string;
  label: string;
  description: string;
  checked: boolean;
}) => (
  <label
    className="row"
    style={{
      alignItems: 'flex-start',
      gap: 'var(--space-3)',
      padding: 'var(--space-3) 0',
      borderBottom: '1px solid var(--color-divider)',
    }}
  >
    <input
      type="checkbox"
      name={name}
      value="an"
      defaultChecked={checked}
      className="check-inline-lg"
    />
    <span style={{ flex: 1 }}>
      <span
        style={{ display: 'block', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '15px' }}
      >
        {label}
      </span>
      <span className="text-muted" style={{ fontSize: '13px' }}>
        {description}
      </span>
    </span>
  </label>
);

const Settings = async ({ searchParams }: PageProps) => {
  const user = await requireAdmin();
  const params = await searchParams;

  const [settings, alerts, leagues] = await Promise.all([
    loadSettings(),
    loadAlertSettings(),
    loadLeagues(),
  ]);

  return (
    <AdminShell
      user={user}
      current="/einstellungen"
      kicker="Adminbereich"
      title="Einstellungen"
      lead="Eintragen ist immer sofort verbindlich. Hier stellt der Verein Fristen, Pflichtbestätigung und Meldungen ein."
      hint={single(params.hinweis)}
      error={single(params.fehler)}
    >
      <form action={saveSettingsAction} style={{ maxWidth: '760px' }}>
        <Note>
          <strong>Qualifikation prüfen</strong> ist Pflicht und lässt sich nicht abschalten: ohne
          passende Liga kann sich niemand eintragen.
        </Note>

        <h2 className="kicker" style={{ marginTop: 'var(--space-6)' }}>
          Regeln
        </h2>
        <Switch
          name="einSpielProTag"
          label="Max. 1 Spiel pro Tag und Schiedsrichter"
          description="Ersatz-Eintragungen am gleichen Tag zählen mit. Der Admin kann es pro Spiel freigeben."
          checked={settings.oneGamePerDay}
        />
        <Switch
          name="rotation"
          label="Faire Rotation"
          description="Wer im gewählten Zeitraum am wenigsten gepfiffen hat, wird zuerst angeschrieben. Eintragen bleibt für alle gleichzeitig möglich."
          checked={settings.rotation}
        />
        <Field
          label="Zeitraum der Rotation"
          htmlFor="rotationszeitraum"
          hint="Wirkt nur, wenn die faire Rotation an ist."
        >
          <select
            id="rotationszeitraum"
            name="rotationszeitraum"
            className="input"
            defaultValue={settings.rotationWindow}
            style={{ maxWidth: '220px' }}
          >
            {(['week', 'month', 'season'] as const).map((window) => (
              <option key={window} value={window}>
                {ROTATION_WINDOW_LABELS[window]}
              </option>
            ))}
          </select>
        </Field>
        <Switch
          name="autoNachfrage"
          label="Automatische Nachfrage bei offenen Spielen"
          description="Erinnerung an alle Qualifizierten, solange Plätze offen sind."
          checked={settings.autoNudge}
        />

        <h2 className="kicker" style={{ marginTop: 'var(--space-6)' }}>
          Pflichtbestätigung vor dem Spiel
        </h2>
        <p className="text-muted" style={{ fontSize: '13px' }}>
          Nachricht mit dem Knopf „Ja, habe ich gelesen und mache es“. Ohne Antwort innerhalb von{' '}
          {describeHours(settings.confirmationFollowUpHours)} geht eine erneute Erinnerung an den
          Schiedsrichter und eine Meldung an alle Admins.
        </p>
        <Field label="Vorlauf" htmlFor="bestaetigungsvorlauf">
          <select
            id="bestaetigungsvorlauf"
            name="bestaetigungsvorlauf"
            className="input"
            defaultValue={settings.confirmationLeadHours}
            style={{ maxWidth: '220px' }}
          >
            {CONFIRMATION_CHOICES.map((hours) => (
              <option key={hours} value={hours}>
                {describeHours(hours)} vor Anpfiff
              </option>
            ))}
          </select>
        </Field>

        <h2 className="kicker" style={{ marginTop: 'var(--space-6)' }}>
          Fristen für Schiedsrichter
        </h2>
        <div className="form-grid">
          <Field label="Austragen möglich bis (Tage vorher)" htmlFor="austragefrist">
            <Input
              id="austragefrist"
              name="austragefrist"
              type="number"
              min={0}
              max={120}
              defaultValue={settings.withdrawDeadlineDays}
            />
          </Field>
          <Field label="Ersatz anfordern bis (Tage vorher)" htmlFor="ersatzfrist">
            <Input
              id="ersatzfrist"
              name="ersatzfrist"
              type="number"
              min={0}
              max={120}
              defaultValue={settings.substituteRequestDeadlineDays}
            />
          </Field>
          <Field
            label="Max. Erinnerungen pro Schiri"
            htmlFor="erinnerungslimit"
            hint="Jede Nachricht kostet den Verein Geld."
          >
            <Input
              id="erinnerungslimit"
              name="erinnerungslimit"
              type="number"
              min={1}
              max={50}
              defaultValue={settings.reminderLimit}
            />
          </Field>
        </div>
        <p className="text-muted" style={{ fontSize: '12px' }}>
          Beide Fristen kann der Admin pro Spiel überschreiben — im Spiel bearbeiten.
        </p>

        <h2 className="kicker" style={{ marginTop: 'var(--space-6)' }}>
          Meldungen an Admins
        </h2>
        <Switch
          name="meldungUnbesetzt"
          label="Sofort, wenn ein Spiel ohne zwei Schiedsrichter ist"
          description="Die häufigste und dringendste Meldung."
          checked={alerts.unfilled}
        />
        <Switch
          name="meldungBestaetigung"
          label="Wenn eine Pflichtbestätigung offen bleibt"
          description={`Nach ${describeHours(settings.confirmationFollowUpHours)} ohne Antwort.`}
          checked={alerts.confirmationOverdue}
        />
        <Switch
          name="meldungErsatz"
          label="Wenn Ersatzplätze offen sind"
          description="Obwohl beide Schiedsrichter stehen."
          checked={alerts.substituteMissing}
        />
        <Switch
          name="meldungAbsage"
          label="Bei Austragung oder Absage nach Verschiebung"
          description="Damit ein frei gewordener Platz nicht übersehen wird."
          checked
        />
        <Switch
          name="meldungTaeglich"
          label="Tägliche Zusammenfassung aller offenen Spiele"
          description="Eine Nachricht am Tag statt vieler einzelner."
          checked
        />
        <Switch
          name="meldungImport"
          label="Nach jedem CSV-Import"
          description="Meist unnötig — der Import passiert ja bewusst."
          checked={false}
        />

        <Button type="submit" variant="primary" style={{ marginTop: 'var(--space-6)' }}>
          Einstellungen speichern
        </Button>
      </form>

      <section style={{ marginTop: 'var(--space-8)', maxWidth: '760px' }}>
        <h2 className="kicker">Ligen</h2>
        <p className="text-muted" style={{ fontSize: '13px' }}>
          Abgeschaltete Ligen lassen sich nicht mehr für neue Spiele auswählen. Bestehende Spiele
          und Qualifikationen bleiben erhalten.
        </p>
        <ul className="chip-row" style={{ marginTop: 'var(--space-3)' }}>
          {leagues.map((league) => (
            <li key={league.id}>
              <form action={setLeagueAction}>
                <input type="hidden" name="liga" value={league.id} />
                <input type="hidden" name="wert" value={league.active ? 'aus' : 'an'} />
                <button
                  type="submit"
                  className={`chip${league.active ? ' chip-on' : ''}`}
                  aria-pressed={league.active}
                >
                  {league.name}
                </button>
              </form>
            </li>
          ))}
        </ul>

        <form action={setLeagueAction} className="row" style={{ marginTop: 'var(--space-4)' }}>
          <input type="hidden" name="wert" value="an" />
          <Field label="Neue Liga" htmlFor="neue-liga">
            <Input id="neue-liga" name="liga" placeholder="z. B. U20" required />
          </Field>
          <Button type="submit" variant="secondary" style={{ alignSelf: 'flex-end' }}>
            Liga hinzufügen
          </Button>
        </form>
      </section>
    </AdminShell>
  );
};

export default Settings;
