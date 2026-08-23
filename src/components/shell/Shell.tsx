import Link from 'next/link';
import type { ReactNode } from 'react';
import { CLUB } from '@/config/club';
import { Initials } from '@/components/primitives';
import { isCurrent, tabTargets, type NavTarget } from './nav';

/**
 * Das Grundraster der Anwendung.
 *
 * Dieselben Ziele erscheinen am Desktop als Seitenleiste und am Handy als
 * Tab-Leiste unten — eine responsive Oberflaeche, keine zwei Layouts. Der
 * Umbruch liegt bei 1024px und steckt vollstaendig in "app.css".
 */

export interface ShellProps {
  nav: readonly NavTarget[];
  /**
   * Die Ziele der Tab-Leiste am Handy. Dort ist nur Platz fuer vier Eintraege —
   * die Admin-Navigation hat sieben. Wer mehr als vier Ziele hat, muss hier
   * eine Auswahl uebergeben, statt die Leiste ueberlaufen zu lassen.
   */
  tabs?: readonly NavTarget[];
  footerNav?: readonly NavTarget[];
  /** Aktueller Pfad, entscheidet ueber die Markierung. */
  current: string;
  user?: { name: string; initials: string } | undefined;
  children: ReactNode;
}

export type { NavTarget };

export const Shell = ({
  nav,
  tabs,
  footerNav = [],
  current,
  user,
  children,
}: ShellProps) => (
  <div className="shell">
    <header className="shell-topbar">
      <div className="shell-brand">
        {CLUB.appName} <span className="shell-brand-mark">·</span> {CLUB.shortName}
      </div>
      {user ? (
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <Initials initials={user.initials} size={28} label={user.name} />
          <span style={{ fontSize: '13px' }}>{user.name}</span>
        </div>
      ) : (
        <span className="text-muted" style={{ fontSize: '13px' }}>
          nicht angemeldet
        </span>
      )}
    </header>

    <div className="shell-body">
      <nav className="shell-nav" aria-label="Hauptnavigation">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="nav-item"
            aria-current={isCurrent(current, item.href) ? 'page' : undefined}
          >
            <span className="nav-item-label">{item.label}</span>
            {item.badge ? <span className="tag tag-accent">{item.badge}</span> : null}
          </Link>
        ))}
        {footerNav.length > 0 ? (
          <div className="nav-footer">
            {footerNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isCurrent(current, item.href) ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
            <div className="text-muted" style={{ fontSize: '11px', marginTop: 'var(--space-2)' }}>
              Alle Nachrichten laufen über WhatsApp.
            </div>
          </div>
        ) : null}
      </nav>

      <main className="shell-main">{children}</main>
    </div>

    <nav className="shell-tabbar" aria-label="Hauptnavigation">
      {tabTargets(nav, tabs).map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="shell-tab"
          aria-current={isCurrent(current, item.href) ? 'page' : undefined}
        >
          {item.short}
        </Link>
      ))}
    </nav>
  </div>
);

