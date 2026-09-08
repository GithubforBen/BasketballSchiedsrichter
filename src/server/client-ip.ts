import { isIP } from 'node:net';

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
 *
 * Zwei Einschraenkungen liegen darin, und beide stehen hier ausdruecklich:
 *
 * Erstens ist `X-Forwarded-For` etwas anderes als `CF-Connecting-IP`.
 * Cloudflare **haengt** dort nur an, statt zu ueberschreiben — der erste
 * Eintrag der Kette ist also das, was der Aufrufer selbst hineingeschrieben
 * hat. Als Notnagel fuer den Betrieb ohne Tunnel ist das in Ordnung, im
 * Echtbetrieb waere es ein frei waehlbarer Schluessel fuer das Rate-Limit.
 * Deshalb gilt der Notnagel nur ausserhalb der Produktion; dort steht
 * `CF-Connecting-IP` ohnehin immer.
 *
 * Zweitens ist der Wert eine Zeichenkette aus dem Netz und wird als Schluessel
 * in `rate_limits` geschrieben. Was keine IP-Adresse ist, kommt deshalb gar
 * nicht erst durch: sonst liesse sich mit einem frei erfundenen Kopf je
 * Anfrage eine neue Zeile anlegen. Die Aufbewahrung raeumt sie nach zwei Tagen
 * weg, es waere also kein Dauerschaden — aber eine Tabelle, in die jeder
 * Fremde schreiben darf, was er will, soll es trotzdem nicht geben.
 */

/**
 * Ein Kopf, dem zu trauen ist, oder nichts.
 *
 * `isIP` gibt 4, 6 oder 0 zurueck. Alles, was nicht als IPv4 oder IPv6 durchgeht
 * — ein Name, ein leerer Wert, eine ganze Kette —, faellt weg.
 */
const asAddress = (value: string | null): string | null => {
  if (value === null) return null;
  const trimmed = value.trim();
  return isIP(trimmed) === 0 ? null : trimmed;
};

/**
 * Wenn sich die Adresse nicht feststellen laesst.
 *
 * Alle diese Anfragen teilen sich einen Zaehler. Das ist die vorsichtige
 * Richtung: im Zweifel wird zu streng begrenzt und nicht zu lasch.
 */
const UNKNOWN = 'unbekannt';

export const clientIp = (headers: Headers): string => {
  const cloudflare = asAddress(headers.get('cf-connecting-ip'));
  if (cloudflare) return cloudflare;

  // Ohne Tunnel — etwa in der Entwicklung — bleibt der erste Eintrag der Kette.
  if (process.env.NODE_ENV !== 'production') {
    const forwarded = asAddress(headers.get('x-forwarded-for')?.split(',')[0] ?? null);
    if (forwarded) return forwarded;
  }

  return UNKNOWN;
};
