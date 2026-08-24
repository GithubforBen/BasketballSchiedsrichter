import type { Metadata } from 'next';
import Link from 'next/link';
import { FOOTER_NAV, PUBLIC_NAV, PUBLIC_TABS } from '@/components/shell/navigation';
import { Shell } from '@/components/shell/Shell';
import { CLUB } from '@/config/club';

/**
 * Seite nicht gefunden.
 *
 * Bewusst im Design-System und nicht als nackte Fehlermeldung: wer hier landet,
 * hat sich meist an einer Adresse vertan oder folgt einem alten Link aus einer
 * Nachricht. Der Weg zurueck soll ohne Nachdenken erreichbar sein.
 *
 * Ohne Anmeldung gerendert und deshalb ohne Nutzerangaben — diese Seite kann
 * jeden treffen, auch jemanden, der gar nicht angemeldet ist.
 */

export const metadata: Metadata = {
  title: `Seite nicht gefunden · ${CLUB.appName}`,
};

const NotFound = () => (
  <Shell nav={PUBLIC_NAV} tabs={PUBLIC_TABS} footerNav={FOOTER_NAV} current="/">
    <div className="page-head">
      <div className="page-head-text">
        <div className="kicker">Fehler 404</div>
        <h1>Diese Seite gibt es nicht</h1>
        <p className="text-muted">
          Vielleicht ist die Adresse veraltet — etwa ein Link aus einer älteren Nachricht zu
          einem Spiel, das inzwischen abgesagt wurde.
        </p>
      </div>
    </div>

    <div className="row">
      <Link className="btn btn-primary" href="/">
        Zum Spielplan
      </Link>
      <Link className="btn" href="/anmelden">
        Anmelden
      </Link>
    </div>
  </Shell>
);

export default NotFound;
