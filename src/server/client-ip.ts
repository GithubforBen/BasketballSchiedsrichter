/**
 * Die IP des Besuchers.
 *
 * Die App laeuft hinter einem Cloudflare Tunnel. Ohne diese Auswertung sieht
 * der Server jede Anfrage mit derselben Adresse — ein Rate-Limit wuerde dann
 * alle Nutzer als eine einzige Person behandeln und beim ersten Ansturm alle
 * aussperren.
 *
 * `CF-Connecting-IP` setzt Cloudflare selbst und ueberschreibt dabei einen
 * mitgeschickten Wert, ist also vertrauenswuerdig, solange die App
 * ausschliesslich ueber den Tunnel erreichbar ist. Genau so ist sie
 * eingerichtet (siehe docker-compose.yml: kein veroeffentlichter Port).
 */
export const clientIp = (headers: Headers): string => {
  const cloudflare = headers.get('cf-connecting-ip');
  if (cloudflare) return cloudflare.trim();

  // Ohne Tunnel — etwa in der Entwicklung — bleibt der erste Eintrag der Kette.
  const forwarded = headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  if (first) return first;

  return 'unbekannt';
};
