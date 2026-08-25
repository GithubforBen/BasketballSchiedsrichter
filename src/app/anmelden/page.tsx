import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Button, Field, Input, Note } from '@/components/primitives';
import { FOOTER_NAV, PUBLIC_NAV, PUBLIC_TABS } from '@/components/shell/navigation';
import { Shell } from '@/components/shell/Shell';
import { CLUB } from '@/config/club';
import { formatPhone } from '@/server/auth/phone';
import { CODE_LENGTH, TOKEN_LIFETIME_MINUTES } from '@/server/auth/tokens';
import { env } from '@/server/env';
import { currentUser } from '@/server/viewer';
import { passwordLoginAction, requestLoginAction, submitCodeAction } from './actions';

export const metadata: Metadata = {
  title: `Anmelden · ${CLUB.appName}`,
};

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const single = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const Login = async ({ searchParams }: PageProps) => {
  const user = await currentUser();
  if (user) redirect(user.mustChangePassword ? '/passwort' : '/');

  const params = await searchParams;
  // Der zweite Schritt gehoert zum Weg ueber den Link. Ist der zu, gibt es ihn
  // auch dann nicht, wenn jemand die Adresse von Hand eintippt.
  const step = env.magicLinkEnabled && single(params.schritt) === 'code' ? 'code' : 'password';
  const phone = single(params.tel) ?? '';
  const error = single(params.fehler);
  const hint = single(params.hinweis);

  return (
    <Shell nav={PUBLIC_NAV} tabs={PUBLIC_TABS} footerNav={FOOTER_NAV} current="/anmelden">
      <div className="form-page">
        <div className="kicker kicker-accent">Telefonnummer und Passwort</div>
        <h1>Anmelden</h1>

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        {step === 'password' ? (
          <>
            {hint ? <p className="form-success">{hint}</p> : null}
            <p className="text-muted" style={{ fontSize: '14px' }}>
              Konten legt ausschließlich der Admin an — eine eigene Registrierung gibt es nicht.
              Beim ersten Mal ist das Passwort dein Vor- und Nachname, klein und
              zusammengeschrieben.
            </p>
            <form action={passwordLoginAction}>
              <Field label="Telefonnummer" htmlFor="telefon">
                <Input
                  id="telefon"
                  name="telefon"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  required
                  defaultValue={phone}
                  placeholder="0151 23456789"
                  style={{ fontVariantNumeric: 'tabular-nums', minHeight: '46px' }}
                />
              </Field>
              <Field label="Passwort" htmlFor="passwort">
                <Input
                  id="passwort"
                  name="passwort"
                  type="password"
                  autoComplete="current-password"
                  required
                  style={{ minHeight: '46px' }}
                />
              </Field>
              <Button type="submit" variant="primary" block>
                Anmelden
              </Button>
            </form>

            {/*
              Der Weg über einen zugeschickten Link ist gebaut und geprüft, steht
              aber zu: jede Anmeldung kostet dabei eine Nachricht. Er erscheint
              erst, wenn LOGIN_MAGIC_LINK auf "an" steht.
            */}
            {env.magicLinkEnabled ? (
              <form action={requestLoginAction} style={{ marginTop: 'var(--space-4)' }}>
                <input type="hidden" name="telefon" value={phone} />
                <Button type="submit" variant="ghost">
                  Passwort vergessen — Link schicken
                </Button>
              </form>
            ) : (
              <p className="text-muted" style={{ fontSize: '13px', marginTop: 'var(--space-4)' }}>
                Passwort vergessen? Ein Admin der Abteilung setzt es zurück.
              </p>
            )}
          </>
        ) : (
          <>
            {hint ? <p className="form-success">{hint}</p> : null}
            <p className="text-muted" style={{ fontSize: '14px' }}>
              Tippe den Link aus der Nachricht an — oder gib hier den {CODE_LENGTH}-stelligen Code
              ein. Beides gilt {TOKEN_LIFETIME_MINUTES} Minuten.
            </p>
            <form action={submitCodeAction}>
              <input type="hidden" name="telefon" value={phone} />
              <Field
                label="Code aus der Nachricht"
                htmlFor="code"
                hint={phone ? `Gesendet an ${formatPhone(phone)}` : undefined}
              >
                <Input
                  id="code"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={CODE_LENGTH}
                  required
                  autoFocus
                  placeholder="123456"
                  style={{
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '0.3em',
                    minHeight: '46px',
                  }}
                />
              </Field>
              <Button type="submit" variant="primary" block>
                Anmelden
              </Button>
            </form>
            <form action={requestLoginAction} style={{ marginTop: 'var(--space-4)' }}>
              <input type="hidden" name="telefon" value={phone} />
              <Button type="submit" variant="ghost">
                Neuen Zugang anfordern
              </Button>
            </form>
          </>
        )}

        <div style={{ marginTop: 'var(--space-6)' }}>
          <Note>
            Ohne Anmeldung siehst du den Spielplan mit Kürzeln. Namen und Profilbilder erscheinen
            erst nach dem Login.
          </Note>
        </div>
      </div>
    </Shell>
  );
};

export default Login;
