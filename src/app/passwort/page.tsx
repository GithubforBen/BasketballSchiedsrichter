import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Button, Field, Input, Note } from '@/components/primitives';
import { FOOTER_NAV, PUBLIC_NAV, PUBLIC_TABS, REFEREE_NAV, REFEREE_TABS } from '@/components/shell/navigation';
import { Shell } from '@/components/shell/Shell';
import { CLUB } from '@/config/club';
import { START_PASSWORD_VALID_DAYS } from '@/domain/password';
import { currentUser } from '@/server/viewer';
import { changePasswordAction } from './actions';

/**
 * Passwort setzen und aendern. Regeln 37 und 38.
 *
 * Eine Seite fuer zwei Anlaesse: den erzwungenen Wechsel nach dem ersten
 * Anmelden und die freiwillige Aenderung spaeter. Der Unterschied liegt im
 * Ton und darin, was daneben erreichbar ist — die Sache selbst ist dieselbe,
 * und zwei Formulare fuer denselben Vorgang waeren zwei Stellen zum Vertun.
 */

export const metadata: Metadata = { title: `Passwort · ${CLUB.appName}` };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const single = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const Password = async ({ searchParams }: PageProps) => {
  const user = await currentUser();
  if (!user) redirect('/anmelden');

  const params = await searchParams;
  const error = single(params.fehler);
  const hint = single(params.hinweis);
  const forced = user.mustChangePassword;

  return (
    <Shell
      /*
       * Beim erzwungenen Wechsel steht die öffentliche Navigation da: hinter
       * jedem Ziel der angemeldeten Navigation läge ohnehin nur die
       * Weiterleitung zurück auf diese Seite (Regel 37). Ein Menü, dessen
       * Einträge alle im Kreis führen, wäre eine Zumutung.
       */
      nav={forced ? PUBLIC_NAV : REFEREE_NAV}
      tabs={forced ? PUBLIC_TABS : REFEREE_TABS}
      footerNav={FOOTER_NAV}
      current="/profil"
      user={{ name: user.name, initials: user.initials }}
    >
      <div className="form-page">
        <div className="kicker kicker-accent">
          {forced ? 'Noch ein Schritt' : 'Anmeldung'}
        </div>
        <h1>{forced ? 'Passwort festlegen' : 'Passwort ändern'}</h1>

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        {hint ? <p className="form-success">{hint}</p> : null}

        <p className="text-muted" style={{ fontSize: '14px' }}>
          {forced
            ? `Du bist mit dem Start-Passwort angemeldet — das kennt jeder, der deinen Namen kennt, und es gilt nur ${START_PASSWORD_VALID_DAYS} Tage. Denk dir jetzt ein eigenes aus. Bis dahin ist der Rest der App zu.`
            : 'Denk dir ein neues Passwort aus. Es gilt sofort; auf anderen Geräten bleibst du angemeldet.'}
        </p>

        <form action={changePasswordAction}>
          <Field
            label={forced ? 'Start-Passwort' : 'Bisheriges Passwort'}
            htmlFor="bisher"
            hint={
              forced
                ? 'Dein Vor- und Nachname, klein und zusammengeschrieben'
                : undefined
            }
          >
            <Input
              id="bisher"
              name="bisher"
              type="password"
              autoComplete="current-password"
              required
              autoFocus
              style={{ minHeight: '46px' }}
            />
          </Field>
          <Field label="Neues Passwort" htmlFor="neu">
            <Input
              id="neu"
              name="neu"
              type="password"
              autoComplete="new-password"
              required
              style={{ minHeight: '46px' }}
            />
          </Field>
          <Field label="Neues Passwort wiederholen" htmlFor="wiederholung">
            <Input
              id="wiederholung"
              name="wiederholung"
              type="password"
              autoComplete="new-password"
              required
              style={{ minHeight: '46px' }}
            />
          </Field>
          <Button type="submit" variant="primary" block>
            Passwort speichern
          </Button>
        </form>

        <div className="row" style={{ marginTop: 'var(--space-4)' }}>
          {forced ? null : (
            <a href="/profil" className="btn btn-secondary">
              Zurück zum Profil
            </a>
          )}
          <form action="/abmelden" method="post">
            <Button type="submit" variant="ghost">
              Abmelden
            </Button>
          </form>
        </div>

        <div style={{ marginTop: 'var(--space-6)' }}>
          <Note>
            Es gibt keine Vorgaben zu Länge oder Zeichen — nimm etwas, das du dir merkst und das
            niemand rät. Das Passwort wird nur verschlüsselt gespeichert; auch ein Admin kann es
            nicht lesen, sondern nur zurücksetzen.
          </Note>
        </div>
      </div>
    </Shell>
  );
};

export default Password;
