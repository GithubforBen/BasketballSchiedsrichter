import Link from 'next/link';
import type { ReactNode } from 'react';
import { CLUB } from '@/config/club';
import { Initials } from '@/components/primitives';
import { isCurrent, tabTargets, type NavGroup, type NavTarget } from './nav';

/**
 * Das Grundraster der Anwendung.
 *
 * Dieselben Ziele erscheinen am Desktop als Seitenleiste und am Handy als
 * Tab-Leiste unten — eine responsive Oberflaeche, keine zwei Layouts. Der
 * Umbruch liegt bei 1024px und steckt vollstaendig in "app.css".
 */

export interface ShellProps {
  nav: readonly NavGroup[];
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

export type { NavGroup, NavTarget };

export const Shell = ({
  nav,
  tabs,
  footerNav = [],
  current,
  user,
  children,
}: ShellProps) => (
  <div className="shell">
    {/*
      Sprungmarke. Sichtbar erst beim Tabben, dann als erstes Element der Seite.
      Ohne sie muesste sich jemand, der mit der Tastatur bedient, auf jeder
      Seite erneut durch die gesamte Navigation arbeiten, bevor er beim Inhalt
      ankommt — bei sieben Zielen im Adminbereich sind das sieben Anschlaege
      pro Seitenwechsel.
    */}
    <a className="skip-link" href="#inhalt">
      Zum Inhalt springen
    </a>
    <header className="shell-topbar">
      <div className="shell-brand">
        {CLUB.appName} <span className="shell-brand-mark">·</span> {CLUB.shortName}
      </div>
      {user ? (
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <Initials initials={user.initials} size={28} label={user.name} />
          <span style={{ fontSize: '13px' }}>{user.name}</span>
          {/* Abmelden geht nur ueber POST, damit niemand per Link abgemeldet wird. */}
          <form action="/abmelden" method="post">
            <button type="submit" className="btn btn-ghost btn-compact">
              Abmelden
            </button>
          </form>
        </div>
      ) : (
        /*
         * Der Hinweis ist der Weg zur Anmeldung und kein blosser Zustand.
         * Als Text stand er genau dort, wo sonst "Abmelden" steht — wer
         * daraufklickte, erwartete die Anmeldung und bekam nichts.
         */
        <Link href="/anmelden" className="btn btn-ghost btn-compact">
          Anmelden
        </Link>
      )}
    </header>

    <div className="shell-body">
      <nav className="shell-nav" aria-label="Hauptnavigation">
        {nav.map((group) => (
          <div key={group.label ?? 'start'} className="nav-group">
            {group.label ? <h2 className="nav-group-label">{group.label}</h2> : null}
            {group.items.map((item) => (
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
          </div>
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

      <main className="shell-main" id="inhalt" tabIndex={-1}>
        {children}

        {/*
          Am Handy gibt es keine Seitenleiste, und in die Tab-Leiste passen nur
          vier Ziele — Regeln und Rechtliches waren dort schlicht nicht zu
          erreichen. Hier stehen sie am Ende jeder Seite, wo Rechtliches
          ueblicherweise steht; am Desktop bleibt die Fusszeile der Leiste.
        */}
        {footerNav.length > 0 ? (
          <div className="shell-footer">
            {footerNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isCurrent(current, item.href) ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
            <span className="text-muted">Alle Nachrichten laufen über WhatsApp.</span>
          </div>
        ) : null}
      </main>
    </div>

    {/*
      Eigener Name: die Seitenleiste heisst schon "Hauptnavigation". Zwei
      Bereiche mit demselben Namen sind fuer einen Screenreader nicht
      auseinanderzuhalten, auch wenn immer nur einer sichtbar ist.
    */}
    <nav className="shell-tabbar" aria-label="Bereiche">
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

