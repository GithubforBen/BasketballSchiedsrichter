import type { NextConfig } from 'next';

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
};

export default config;
