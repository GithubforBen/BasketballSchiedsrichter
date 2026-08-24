'use client';

import { useEffect } from 'react';

/**
 * Der unerwartete Fehler.
 *
 * Was hier ankommt, ist nicht vorhergesehen — eine abgerissene Verbindung zur
 * Datenbank, ein Fehler in einer Serveraktion. Zwei Dinge sind deshalb wichtig:
 *
 * Erstens verraet die Seite nichts ueber die Ursache. Die Meldung eines
 * Fehlers kann eine Datenbankabfrage samt Telefonnummer enthalten; das gehoert
 * nicht auf einen Bildschirm, an dem jemand steht. Next liefert im
 * Produktionsbetrieb ohnehin nur eine Kennung statt der Meldung — hier wird
 * auch diese Kennung nur angezeigt, damit sie beim Nachfragen genannt werden
 * kann, nicht als Erklaerung.
 *
 * Zweitens fuehrt sie zurueck. Ein Neuversuch reicht bei einem kurzen Aussetzer
 * meistens aus; der Weg zum Spielplan bleibt daneben stehen, falls nicht.
 *
 * Diese Seite laeuft im Browser und kann deshalb die Shell nicht verwenden —
 * die liest die Sitzung auf dem Server. Sie steht bewusst allein und benutzt
 * nur die Klassen des Design-Systems.
 */

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

const ErrorPage = ({ error, reset }: ErrorPageProps) => {
  useEffect(() => {
    /*
     * Nur die Kennung ins Protokoll, nie die Meldung: sie kann personenbezogene
     * Daten aus einer Abfrage enthalten. Der vollstaendige Fehler steht im
     * Serverprotokoll, wo er hingehoert.
     */
    console.error(`Unerwarteter Fehler in der Oberflaeche. Kennung: ${error.digest ?? 'ohne'}`);
  }, [error.digest]);

  return (
    <main className="shell-main" style={{ maxWidth: '60ch' }}>
      <div className="page-head">
        <div className="page-head-text">
          <div className="kicker kicker-accent">Fehler</div>
          <h1>Da ist etwas schiefgegangen</h1>
          <p className="text-muted">
            Der Vorgang konnte nicht abgeschlossen werden. Nichts ist halb gespeichert — was du
            zuletzt abgeschickt hast, ist entweder ganz oder gar nicht angekommen.
          </p>
        </div>
      </div>

      <div className="row">
        <button type="button" className="btn btn-primary" onClick={reset}>
          Noch einmal versuchen
        </button>
        <a className="btn" href="/">
          Zum Spielplan
        </a>
      </div>

      {error.digest ? (
        <p className="text-muted" style={{ marginTop: 'var(--space-6)', fontSize: '12px' }}>
          Kennung für Rückfragen: <code>{error.digest}</code>
        </p>
      ) : null}
    </main>
  );
};

export default ErrorPage;
