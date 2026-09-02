import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button, Field, Input, Note } from '@/components/primitives';
import { AdminShell, single } from '@/components/admin/AdminShell';
import { CLUB } from '@/config/club';
import { matchTitle } from '@/domain/schedule';
import { describeLeadTime } from '@/domain/time';
import { requireAdmin } from '@/server/guard';
import { adminGame } from '@/server/queries/admin-view';
import { loadSettings } from '@/server/queries/settings';
import { removeFromGameAction, saveGameAction } from './actions';

/**
 * Spiel bearbeiten.
 *
 * Regel 17: Sobald sich Termin oder Ort aendern, erhalten Schiedsrichter und
 * Ersatz den neuen Termin mit Absage-Option — darauf weist der Bildschirm vor
 * dem Speichern hin, damit niemand versehentlich eine Welle von Nachrichten
 * auslöst.
 */

export const metadata: Metadata = { title: `Spiel bearbeiten · ${CLUB.appName}` };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Datum und Uhrzeit in Ortszeit, wie die Eingabefelder sie erwarten. */
const localParts = (kickoff: Date): { date: string; time: string } => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CLUB.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(kickoff);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour') === '24' ? '00' : get('hour')}:${get('minute')}`,
  };
};

const EditGame = async ({ searchParams }: PageProps) => {
  const now = new Date();
  const user = await requireAdmin(now);
  const params = await searchParams;

  const gameId = single(params.spiel);
  if (!gameId) notFound();

  const settings = await loadSettings();
  const detail = await adminGame(gameId, settings, now);
  if (!detail) notFound();

  const { date, time } = localParts(detail.game.kickoff);
  const overrides = [
    {
      name: 'freigabeAustragen',
      label: 'Austragen für dieses Spiel freigeben',
      description: `Überschreibt die Frist von ${settings.withdrawDeadlineDays} Tagen.`,
      checked: detail.game.overrides.withdraw,
    },
    {
      name: 'freigabeErsatz',
      label: 'Ersatz anfordern freigeben',
      description: `Überschreibt die Sperre ${settings.substituteRequestDeadlineDays} Tage vor Anpfiff.`,
      checked: detail.game.overrides.substituteRequest,
    },
    {
      name: 'freigabeZweitesSpiel',
      label: 'Zweites Spiel am selben Tag erlauben',
      description: 'Überschreibt die Regel „ein Spiel pro Tag“.',
      checked: detail.game.overrides.oneGamePerDay,
    },
  ];

  return (
    <AdminShell
      user={user}
      current="/uebersicht"
      kicker={`${detail.game.leagueId} · Anpfiff ${describeLeadTime(detail.game.kickoff, now)}`}
      title="Spiel bearbeiten"
      lead={matchTitle(detail.game)}
      hint={single(params.hinweis)}
      error={single(params.fehler)}
    >
      <div className="split">
        <form action={saveGameAction}>
          <input type="hidden" name="spiel" value={detail.game.id} />

          <div className="form-grid">
            <Field label="Datum" htmlFor="datum">
              <Input id="datum" name="datum" type="date" defaultValue={date} required />
            </Field>
            <Field label="Uhrzeit" htmlFor="zeit">
              <Input id="zeit" name="zeit" type="time" defaultValue={time} required />
            </Field>
            <Field label="Ort / Halle" htmlFor="ort">
              <Input id="ort" name="ort" defaultValue={detail.game.venue} required />
            </Field>
            <Field label="Nötige Lizenz" htmlFor="lizenz">
              <select
                id="lizenz"
                name="lizenz"
                className="input"
                defaultValue={detail.game.requiredLicense}
                required
              >
                <option value="E">E — Einstiegslizenz</option>
                <option value="D">D — nur mit D-Lizenz</option>
              </select>
            </Field>
          </div>

          <fieldset style={{ border: 0, padding: 0, margin: 'var(--space-4) 0 0' }}>
            <legend className="field-label">Grund der Änderung</legend>
            <div className="seg">
              <label className="seg-opt">
                <input type="radio" name="grund" value="moved" defaultChecked />
                verschoben
              </label>
              <label className="seg-opt">
                <input type="radio" name="grund" value="venue" />
                Halle geändert
              </label>
              <label className="seg-opt">
                <input type="radio" name="grund" value="cancelled" />
                abgesagt
              </label>
            </div>
          </fieldset>

          <Note accent>
            Ändern sich Termin oder Ort, erhalten Schiedsrichter <strong>und</strong> Ersatz eine
            Nachricht mit dem neuen Termin und der Option abzusagen. Eine Absage öffnet den Platz
            sofort wieder.
          </Note>

          <fieldset
            style={{ border: 0, padding: 0, margin: 'var(--space-6) 0 0', display: 'grid', gap: 'var(--space-3)' }}
          >
            <legend className="field-label">Freigaben nur für dieses Spiel</legend>
            {overrides.map((override) => (
              <label
                key={override.name}
                className="row"
                style={{
                  alignItems: 'flex-start',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-3)',
                  border: '2px solid var(--color-divider)',
                }}
              >
                <input
                  type="checkbox"
                  name={override.name}
                  value="an"
                  defaultChecked={override.checked}
                  className="check-inline"
                />
                <span style={{ flex: 1 }}>
                  <span
                    style={{ display: 'block', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '14px' }}
                  >
                    {override.label}
                  </span>
                  <span className="text-muted" style={{ fontSize: '12px' }}>
                    {override.description}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="row" style={{ marginTop: 'var(--space-6)' }}>
            <Button type="submit" variant="primary">
              Speichern &amp; Beteiligte informieren
            </Button>
            <Link href="/uebersicht" className="btn btn-secondary">
              Abbrechen
            </Link>
          </div>
        </form>

        <aside>
          <h2 className="kicker">Besetzung</h2>
          <ul style={{ listStyle: 'none', margin: 'var(--space-3) 0 0', padding: 0 }}>
            {detail.slots.map((slot) => (
              <li
                key={slot.index}
                className="row"
                style={{
                  padding: 'var(--space-3) 0',
                  borderBottom: '1px solid var(--color-divider)',
                  gap: 'var(--space-2)',
                }}
              >
                <span className="slot-role">{slot.role}</span>
                <span style={{ flex: 1, minWidth: '120px' }}>
                  <span style={{ display: 'block', fontSize: '14px' }}>{slot.name}</span>
                  <span style={{ fontSize: '11px', color: slot.stateColor }}>{slot.state}</span>
                </span>
                {slot.refereeId ? (
                  <form action={removeFromGameAction}>
                    <input type="hidden" name="spiel" value={detail.game.id} />
                    <input type="hidden" name="platz" value={slot.index} />
                    <Button type="submit" variant="ghost" className="btn-compact">
                      Entfernen
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="text-muted" style={{ fontSize: '11px', marginTop: 'var(--space-3)' }}>
            Entfernen wirft die Person aus dem Spiel und informiert sie. Auf einem
            Schiedsrichter-Platz wird danach zuerst der Ersatz gefragt, ob er nachrückt.
          </p>
        </aside>
      </div>
    </AdminShell>
  );
};

export default EditGame;
