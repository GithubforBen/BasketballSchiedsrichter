import type { Route } from 'next';
import type { ReactNode } from 'react';
import { ADMIN_NAV, ADMIN_TABS, FOOTER_NAV } from '@/components/shell/navigation';
import { Shell } from '@/components/shell/Shell';
import type { CurrentUser } from '@/server/viewer';

/**
 * Das Grundraster des Adminbereichs samt Rueckmeldung der letzten Aktion.
 *
 * Die Meldung steht in der Adresse und nicht in einem fluechtigen Zustand: so
 * bleibt sie nach dem Neuladen stehen, statt unbemerkt zu verschwinden.
 */

export interface AdminShellProps {
  user: CurrentUser;
  current: Route;
  title: string;
  kicker?: string | undefined;
  lead?: string | undefined;
  actions?: ReactNode;
  hint?: string | undefined;
  error?: string | undefined;
  children: ReactNode;
}

export const AdminShell = ({
  user,
  current,
  title,
  kicker,
  lead,
  actions,
  hint,
  error,
  children,
}: AdminShellProps) => (
  <Shell
    nav={ADMIN_NAV}
    tabs={ADMIN_TABS}
    footerNav={FOOTER_NAV}
    current={current}
    user={{ name: user.name, initials: user.initials }}
  >
    <div className="page-head">
      <div className="page-head-text">
        {kicker ? <div className="kicker kicker-accent">{kicker}</div> : null}
        <h1>{title}</h1>
        {lead ? <p className="text-muted">{lead}</p> : null}
      </div>
      {actions ? <div className="row">{actions}</div> : null}
    </div>

    {error ? (
      <p className="form-error" role="alert">
        {error}
      </p>
    ) : null}
    {hint ? <p className="form-success">{hint}</p> : null}

    {children}
  </Shell>
);

/** Liest einen einzelnen Wert aus den Suchparametern. */
export const single = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;
