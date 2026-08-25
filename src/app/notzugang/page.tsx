import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Button, Field, Input, Note } from '@/components/primitives';
import { FOOTER_NAV, PUBLIC_NAV, PUBLIC_TABS } from '@/components/shell/navigation';
import { Shell } from '@/components/shell/Shell';
import { CLUB } from '@/config/club';
import { currentUser } from '@/server/viewer';
import { redeemRecoveryAction } from './actions';

/**
 * Notzugang fuer ausgesperrte Admins. Regel 41.
 *
 * Diese Seite steht in keiner Navigation. Nicht weil sie geheim waere — sie
 * schuetzt sich durch den Token, nicht durch ihre Adresse —, sondern weil sie
 * niemanden angeht, der nicht gerade ausgesperrt ist. Wer den Token hat, hat
 * auch die Zeile aus dem Handbuch, in der die Adresse steht.
 */

export const metadata: Metadata = { title: `Notzugang · ${CLUB.appName}` };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const single = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const Recovery = async ({ searchParams }: PageProps) => {
  const user = await currentUser();
  // Wer angemeldet ist, ist nicht ausgesperrt und verbraucht hier nur einen Token.
  if (user) redirect(user.mustChangePassword ? '/passwort' : '/');

  const params = await searchParams;
  const error = single(params.fehler);

  return (
    <Shell nav={PUBLIC_NAV} tabs={PUBLIC_TABS} footerNav={FOOTER_NAV} current="/anmelden">
      <div className="form-page">
        <div className="kicker kicker-accent">Nur für Admins</div>
        <h1>Notzugang</h1>

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <p className="text-muted" style={{ fontSize: '14px' }}>
          Für den Fall, dass kein Admin mehr hineinkommt. Der Token wurde auf dem Server
          ausgestellt und einmal angezeigt — er gilt genau einmal.
        </p>

        <form action={redeemRecoveryAction}>
          <Field
            label="Notzugangs-Token"
            htmlFor="token"
            hint="64 Zeichen, so wie beim Ausstellen angezeigt"
          >
            <Input
              id="token"
              name="token"
              required
              autoFocus
              autoComplete="off"
              spellCheck={false}
              style={{ minHeight: '46px', fontVariantNumeric: 'tabular-nums' }}
            />
          </Field>
          <Button type="submit" variant="primary" block>
            Notzugang einlösen
          </Button>
        </form>

        <div style={{ marginTop: 'var(--space-6)' }}>
          <Note>
            Danach fällt das Konto auf das Start-Passwort zurück — Vor- und Nachname, klein und
            zusammengeschrieben — und du legst sofort ein eigenes fest. Der Vorgang steht im
            Prüfprotokoll.
          </Note>
        </div>
      </div>
    </Shell>
  );
};

export default Recovery;
