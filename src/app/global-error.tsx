'use client';

/* eslint-disable no-restricted-syntax --
 * Die einzige Datei, in der die Design-System-Regeln nicht gelten koennen.
 *
 * `global-error` greift, wenn schon das Grundgeruest scheitert. Next ersetzt
 * dann das gesamte Dokument — samt der Stylesheets, die das Layout eingebunden
 * haette. Ein `var(--space-4)` zeigte hier auf nichts, weil die Datei mit den
 * Tokens gar nicht geladen ist. Deshalb stehen die wenigen Angaben, die diese
 * Seite lesbar halten, ausnahmsweise direkt am Element.
 *
 * Entsprechend sparsam: alles, was der Browser von sich aus vernuenftig
 * darstellt, bleibt ungestylt. Das ist ein Notausgang, kein Bildschirm — er
 * soll niemanden je erreichen.
 */

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

const GlobalError = ({ error, reset }: GlobalErrorProps) => (
  <html lang="de">
    <body style={{ margin: '48px 24px', maxWidth: '60ch', lineHeight: 1.6 }}>
      <h1>Die Anwendung ist ausgefallen</h1>
      <p>
        Bitte lade die Seite neu. Bleibt es dabei, melde dich bei einem Admin der Abteilung.
      </p>
      <p>
        <button type="button" onClick={reset}>
          Neu laden
        </button>
      </p>
      {error.digest ? (
        <p>
          Kennung für Rückfragen: <code>{error.digest}</code>
        </p>
      ) : null}
    </body>
  </html>
);

export default GlobalError;
