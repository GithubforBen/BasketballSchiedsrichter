import type { Metadata } from 'next';
import { Button, Note, Panel } from '@/components/primitives';
import { ReminderSlider } from '@/components/profile/ReminderSlider';
import { FOOTER_NAV, REFEREE_NAV, REFEREE_TABS } from '@/components/shell/navigation';
import { Shell } from '@/components/shell/Shell';
import { CLUB, INITIAL_LEAGUES } from '@/config/club';
import { REMINDER_PRESETS, remindersLabel, sortReminders } from '@/domain/reminders';
import { describeHours, describeHoursDative } from '@/domain/time';
import { formatPhone } from '@/server/auth/phone';
import { requireUser } from '@/server/guard';
import { loadReferee, loadReminders } from '@/server/queries/referees';
import { loadSettings } from '@/server/queries/settings';
import { addReminderAction, confirmReminderAction, removeReminderAction } from './actions';

/**
 * Profil und Erinnerungen.
 *
 * Die Stammdaten stehen hier nur zum Lesen: Name, Kuerzel, Telefonnummer und
 * Qualifikationen aendert ausschliesslich der Admin (Regel 30). Aenderbar sind
 * die eigenen Erinnerungen.
 */

export const metadata: Metadata = { title: `Profil & Erinnerungen · ${CLUB.appName}` };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const single = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const HiddenHours = ({ hours }: { hours: number }) => (
  <input type="hidden" name="stunden" value={hours} />
);

const Profile = async ({ searchParams }: PageProps) => {
  const now = new Date();
  const user = await requireUser(now);
  const params = await searchParams;

  const [referee, reminders, settings] = await Promise.all([
    loadReferee(user.id),
    loadReminders(user.id),
    loadSettings(),
  ]);
  if (!referee) throw new Error(`Konto ${user.id} nicht gefunden`);

  const active = sortReminders(reminders);
  const atLimit = active.length >= settings.reminderLimit;
  const pending = Number.parseInt(single(params.bestaetigen) ?? '', 10);
  const hint = single(params.hinweis);
  const error = single(params.fehler);

  return (
    <Shell
      nav={REFEREE_NAV}
      tabs={REFEREE_TABS}
      footerNav={FOOTER_NAV}
      current="/profil"
      user={{ name: user.name, initials: user.initials }}
    >
      <div className="page-head">
        <div className="page-head-text">
          <h1>Profil &amp; Erinnerungen</h1>
        </div>
      </div>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {hint ? <p className="form-success">{hint}</p> : null}

      <div className="profile-grid">
        <section>
          <h2 className="kicker">Stammdaten</h2>
          <div className="stack" style={{ marginTop: 'var(--space-3)' }}>
            <div className="field">
              <span className="field-label">Name</span>
              <div className="readonly-field">
                {referee.name} <span className="text-muted">· nur Admin</span>
              </div>
            </div>
            <div className="field">
              <span className="field-label">Kürzel (öffentlich)</span>
              <div className="readonly-field">
                {referee.initials} <span className="text-muted">· nur Admin</span>
              </div>
            </div>
            <div className="field">
              <span className="field-label">Telefonnummer</span>
              <div className="readonly-field" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatPhone(referee.phone)} <span className="text-muted">· nur Admin</span>
              </div>
            </div>
            <div className="field">
              <span className="field-label">Qualifikationen</span>
              <ul className="chip-row" style={{ marginTop: 'var(--space-1)' }}>
                {INITIAL_LEAGUES.map((league) => {
                  const on = referee.qualifications.includes(league);
                  return (
                    <li
                      key={league}
                      className={`chip chip-static${on ? ' chip-on' : ''}`}
                      aria-label={`${league}: ${on ? 'qualifiziert' : 'nicht qualifiziert'}`}
                    >
                      {league}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <Note>
            Änderungen an Name, Kürzel und Telefonnummer bitte beim Verein melden — die App gibt
            sie nur dem Admin zur Bearbeitung frei.
          </Note>

          {/*
            Auskunft nach Artikel 15 DSGVO als Selbstbedienung. Ein Anspruch,
            für den man erst jemanden ansprechen muss, wird selten eingelöst.
          */}
          <div className="row" style={{ marginTop: 'var(--space-6)' }}>
            <a className="btn" href="/profil/auszug" download>
              Meine Daten herunterladen
            </a>
            <form action="/abmelden" method="post">
              <Button type="submit" variant="secondary">
                Abmelden
              </Button>
            </form>
          </div>
          <p className="text-muted" style={{ fontSize: '12px', marginTop: 'var(--space-2)' }}>
            Enthält alles, was hier über dich gespeichert ist. Zum Löschen des Kontos wende dich
            an einen Admin der Abteilung.
          </p>
        </section>

        <section>
          <h2 className="kicker">Zusätzliche Erinnerungen</h2>
          <p className="text-muted" style={{ fontSize: '13px' }}>
            Frei wählbar zwischen {describeHours(settings.reminderMaxHours)} und{' '}
            {describeHours(settings.reminderMinHours)} vor Anpfiff. Die Pflichtbestätigung{' '}
            {describeHoursDative(settings.confirmationLeadHours)} vor dem Spiel kommt immer
            zusätzlich und zählt nicht mit.
          </p>

          <ul className="chip-row" style={{ marginTop: 'var(--space-4)' }}>
            {REMINDER_PRESETS.map((hours) => {
              const on = active.includes(hours);
              return (
                <li key={hours}>
                  <form action={on ? removeReminderAction : addReminderAction}>
                    <HiddenHours hours={hours} />
                    <button
                      type="submit"
                      className={`chip${on ? ' chip-on' : ''}`}
                      aria-pressed={on}
                    >
                      {describeHours(hours)}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>

          <Panel style={{ marginTop: 'var(--space-4)' }}>
            <div className="kicker kicker-accent">Eigener Zeitpunkt</div>
            <ReminderSlider
              min={settings.reminderMinHours}
              max={settings.reminderMaxHours}
              initial={12}
              disabled={atLimit}
              disabledLabel={`Limit von ${settings.reminderLimit} erreicht`}
              action={addReminderAction}
            />
          </Panel>

          {Number.isInteger(pending) ? (
            <div className="banner" style={{ marginTop: 'var(--space-4)' }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '15px' }}>
                Du hast schon {active.length} Erinnerungen
              </div>
              <p style={{ fontSize: '13px', marginTop: 'var(--space-1)' }}>
                Jede Nachricht kostet den Verein Geld. Wirklich eine weitere hinzufügen —{' '}
                {describeHours(pending)} vor Anpfiff?
              </p>
              <div className="row">
                <form action={confirmReminderAction}>
                  <HiddenHours hours={pending} />
                  <Button type="submit" variant="primary">
                    Ja, hinzufügen
                  </Button>
                </form>
                <a href="/profil" className="btn btn-secondary">
                  Abbrechen
                </a>
              </div>
            </div>
          ) : null}

          <div className="row" style={{ alignItems: 'baseline', marginTop: 'var(--space-6)' }}>
            <h3 className="kicker" style={{ margin: 0 }}>
              Aktive Erinnerungen
            </h3>
            <span
              style={{
                fontSize: '12px',
                marginLeft: 'auto',
                color: atLimit
                  ? 'var(--status-open-text)'
                  : active.length >= settings.reminderCostWarningFrom - 1
                    ? 'var(--status-substitute-missing-text)'
                    : 'var(--text-dim)',
              }}
            >
              {remindersLabel(active, settings)}
            </span>
          </div>

          {active.length === 0 ? (
            <Note>
              Keine zusätzlichen Erinnerungen. Pflichtbestätigung und Zuteilungsnachricht kommen
              trotzdem.
            </Note>
          ) : (
            <ul className="reminder-list">
              {active.map((hours) => (
                <li key={hours}>
                  <span className="reminder-dot" aria-hidden="true" />
                  <span style={{ flex: 1, fontFamily: 'var(--font-heading)', fontWeight: 800 }}>
                    {describeHours(hours)} vor Anpfiff
                  </span>
                  <form action={removeReminderAction}>
                    <HiddenHours hours={hours} />
                    <Button type="submit" variant="ghost" className="btn-compact">
                      Entfernen
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Shell>
  );
};

export default Profile;
