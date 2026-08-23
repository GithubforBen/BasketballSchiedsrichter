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
};

export default config;
