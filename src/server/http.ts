import { NextResponse } from 'next/server';
import { env } from './env';

/**
 * Weiterleitungen innerhalb der Anwendung.
 *
 * Das Ziel wird gegen PUBLIC_BASE_URL aufgeloest und nicht gegen die Adresse,
 * unter der der Server sich selbst sieht.
 *
 * Der Grund ist ein stiller Fehler, kein sichtbarer: Next ersetzt ein relativ
 * angegebenes `Location` durch eine absolute Adresse und nimmt dafuer die
 * Bindeadresse des Servers — im eigenstaendigen Betrieb also 0.0.0.0, hinter
 * dem Cloudflare Tunnel den internen Dienstnamen. `Host` und
 * `X-Forwarded-Host` werden dabei nicht beruecksichtigt. Das Sitzungscookie
 * gilt aber fuer den Host, den der Browser aufgerufen hat, und wuerde nach
 * einer Weiterleitung auf einen anderen Host nicht mitgeschickt: die Anmeldung
 * saehe erfolgreich aus und waere es nicht.
 *
 * PUBLIC_BASE_URL ist dieselbe Quelle, aus der der Anmeldelink gebaut wird —
 * Link und Weiterleitung koennen damit gar nicht auseinanderlaufen.
 */
export const redirectTo = (path: string, status: 303 | 307 = 307): NextResponse => {
  return new NextResponse(null, {
    status,
    headers: { Location: absoluteUrl(path) },
  });
};

/**
 * Baut eine absolute Adresse aus einem Pfad.
 * Ein Ziel ausserhalb der eigenen Anwendung wird abgelehnt, damit aus einem
 * Parameter keine Weiterleitung nach aussen werden kann.
 */
export const absoluteUrl = (path: string, baseUrl: string = env.baseUrl): string => {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new Error(`Weiterleitungsziel muss ein eigener Pfad sein: ${path}`);
  }
  const base = new URL(baseUrl);
  const target = new URL(path, base);
  if (target.origin !== base.origin) {
    throw new Error(`Weiterleitung nach außen abgelehnt: ${path}`);
  }
  return target.toString();
};

/** Weiterleitungsziel mit Abfrageteil, sicher zusammengesetzt. */
export const pathWithQuery = (path: string, query: Record<string, string>): string => {
  const params = new URLSearchParams(query);
  const suffix = params.toString();
  return suffix ? `${path}?${suffix}` : path;
};
