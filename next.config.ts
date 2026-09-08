import type { NextConfig } from 'next';

/**
 * Schutzkoepfe fuer jede Antwort.
 *
 * Sie kosten nichts und schliessen Wege, die sonst offenstehen. Der Reihe nach,
 * mit dem Grund, der hier gilt — nicht dem aus der allgemeinen Empfehlung:
 *
 * `Referrer-Policy: same-origin` ist der wichtigste. Diese Anwendung traegt
 * Geheimnisse in der Adresse: der Antwort-Token steht im Pfad
 * (`/antwort/<Token>`), und die Anmeldeseite fuehrt die Telefonnummer im
 * Abfrageteil (`?tel=`). Ohne diese Zeile schickt der Browser die *ganze*
 * Adresse als Herkunft mit, sobald jemand von dort nach draussen klickt — unter
 * `/dev/outbox` ist genau das anklickbar. Mit ihr verlaesst die Herkunft die
 * eigene Anwendung nicht mehr.
 *
 * `X-Frame-Options` und `frame-ancestors` verhindern, dass die Seite in einem
 * fremden Rahmen steckt. Der Adminbereich besteht aus Formularen, die mit einem
 * Klick ein Konto loeschen oder ein Passwort zuruecksetzen; unter einer
 * durchsichtigen Auflage waere dieser Klick zu erschleichen.
 *
 * `nosniff` gilt vor allem dem Datenauszug: er geht als `text/plain` raus und
 * besteht aus Namen, die jemand eingetippt hat. Ohne diese Zeile darf der
 * Browser raten, ob das nicht doch HTML ist.
 *
 * Die Richtlinie selbst ist bewusst **keine** strenge: `script-src` traegt
 * `'unsafe-inline'`, weil Next seine Hydrationsdaten in eingebettete
 * `<script>`-Bloecke schreibt und die ohne Nonce sonst blockiert wuerden — ein
 * Nonce verlangt eine Middleware und macht jede Seite dynamisch. Gegen
 * eingeschleustes Skript hilft sie damit wenig; das tut hier aber schon React,
 * das jeden Text maskiert, und die Anwendung setzt nirgends rohes HTML.
 * Was sie sehr wohl leistet, steht in den anderen Regeln: `connect-src` und
 * `img-src` lassen keinen Abfluss an einen fremden Host zu, `form-action`
 * verhindert ein Formular, das woandershin abschickt, `base-uri` einen
 * umgebogenen Pfadanfang, und `object-src 'none'` eingebettete Fremdinhalte.
 *
 * Nichts davon laedt von aussen: Schriften liegen unter /schriften, es gibt
 * kein fremdes Skript und kein fremdes Bild. `'self'` reicht deshalb ueberall.
 */
const SECURITY_HEADERS = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      // Das Design-System setzt Abstaende ueber `style`-Attribute am Element.
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
  { key: 'Referrer-Policy', value: 'same-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  // Die Anwendung fragt nichts davon je an; abgeschaltet kann es auch kein
  // eingebetteter Fremdinhalt anfragen.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

const config: NextConfig = {
  reactStrictMode: true,
  // Die App laeuft hinter einem Cloudflare Tunnel. Ohne diese Angabe sieht der
  // Server jede Anfrage mit der IP des Tunnels, wodurch Rate-Limits alle Nutzer
  // als einen behandeln wuerden.
  poweredByHeader: false,
  // Fuer das schlanke Docker-Abbild: Next legt einen eigenstaendigen Server ab.
  output: 'standalone',
  // Links werden gegen die tatsaechlich vorhandenen Routen geprueft: ein Tippfehler
  // oder ein Verweis auf eine noch nicht gebaute Seite faellt beim Build auf.
  typedRoutes: true,
  // Lint laeuft als eigener Schritt ("npm run lint") mit der Konfiguration aus
  // eslint.config.mjs, die auch die Design-System-Treue prueft. Der Build soll
  // ihn nicht ein zweites Mal mit anderen Regeln anstossen.
  eslint: { ignoreDuringBuilds: true },
  /*
   * `sharp` aus dem Auslieferungsstand nehmen.
   *
   * Next legt es unabhaengig davon ab, ob es gebraucht wird — es dient allein
   * der Bildoptimierung von `next/image`, und die verwendet diese Anwendung
   * nirgends. Mitgeliefert wuerde es ein Paket mit gemeldeten Luecken in
   * libvips in das Abbild bringen, das dort nichts zu tun hat. Wer spaeter
   * `next/image` einfuehrt, muss diese Zeile entfernen — der Build sagt es
   * nicht von selbst, deshalb steht es hier.
   */
  outputFileTracingExcludes: {
    '*': ['node_modules/sharp/**', 'node_modules/@img/**'],
  },
  headers: () => Promise.resolve([{ source: '/:pfad*', headers: SECURITY_HEADERS }]),
};

export default config;
