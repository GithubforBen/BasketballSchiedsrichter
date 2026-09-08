/**
 * Umgebungsvariablen an einer Stelle, mit Pruefung beim ersten Zugriff.
 *
 * Ein fehlender Sitzungsschluessel darf nicht erst dann auffallen, wenn sich
 * jemand anmelden will — deshalb wird er beim Lesen geprueft und nicht
 * stillschweigend durch einen Standardwert ersetzt.
 */

const required = (name: string): string => {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Umgebungsvariable ${name} fehlt. Siehe .env.example.`);
  }
  return value;
};

/**
 * Kuerzeste Laenge, die der Sitzungsschluessel im Echtbetrieb haben darf.
 *
 * An diesem einen Schluessel haengt alles, was diese Anwendung unterschreibt:
 * das Sitzungscookie, der Anmeldelink samt Code, der Antwort-Token aus jeder
 * Nachricht und die Ableitung der Notzugaenge. Wer ihn erraet, unterschreibt
 * sich selbst eine Admin-Sitzung — kein Passwort, kein Rate-Limit steht dann
 * noch dazwischen, denn geprueft wird nur die Signatur.
 *
 * Bisher wurde allein der Beispielwert abgewiesen. Damit waere "geheim"
 * durchgegangen, und der Fehler faellt nirgends auf: die Anwendung laeuft
 * damit tadellos. 32 Zeichen sind das, was `openssl rand -base64 24` liefert;
 * `.env.example` schlaegt ohnehin 48 Byte vor.
 */
const MIN_SESSION_SECRET_LENGTH = 32;

export const env = {
  get sessionSecret(): string {
    const secret = required('SESSION_SECRET');
    if (process.env.NODE_ENV === 'production') {
      if (secret === 'bitte-ersetzen') {
        throw new Error('SESSION_SECRET steht noch auf dem Beispielwert.');
      }
      if (secret.length < MIN_SESSION_SECRET_LENGTH) {
        throw new Error(
          `SESSION_SECRET ist zu kurz (${secret.length} Zeichen, mindestens ` +
            `${MIN_SESSION_SECRET_LENGTH}). An ihm haengen Sitzungen, Anmeldelinks, ` +
            'Antwortlinks und Notzugaenge. Neu erzeugen: openssl rand -base64 48',
        );
      }
    }
    return secret;
  },
  /**
   * Die oeffentliche Adresse der Anwendung.
   *
   * Sie steckt im Anmeldelink und in jeder Weiterleitung. Fehlt sie im
   * Echtbetrieb, zeigten beide auf localhost — die Anmeldung saehe erfolgreich
   * aus und liefe ins Leere. Deshalb ist der Standardwert ausdruecklich auf die
   * Entwicklung beschraenkt.
   */
  get baseUrl(): string {
    const value = process.env.PUBLIC_BASE_URL;
    if (value) return value.replace(/\/$/, '');
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'PUBLIC_BASE_URL fehlt. Ohne sie zeigen Anmeldelinks und Weiterleitungen auf localhost.',
      );
    }
    return 'http://localhost:3000';
  },
  get channel(): 'dev' | 'email' | 'whatsapp' {
    const value = process.env.NOTIFICATION_CHANNEL ?? 'dev';
    if (value !== 'dev' && value !== 'email' && value !== 'whatsapp') {
      throw new Error(`NOTIFICATION_CHANNEL kennt nur dev, email oder whatsapp — nicht "${value}".`);
    }
    return value;
  },
  /**
   * Ob der Anmeldelink zusaetzlich zum Passwort angeboten wird.
   *
   * Standard aus: der Verein hat fuer WhatsApp nur 2000 Nachrichten im Monat,
   * und ein Anmeldeweg, der je Anmeldung eine davon verbraucht, passt da nicht
   * hinein. Der ganze Weg bleibt gebaut und getestet — `LOGIN_MAGIC_LINK=an`
   * holt ihn zurueck, sobald das Budget steht.
   */
  get magicLinkEnabled(): boolean {
    return (process.env.LOGIN_MAGIC_LINK ?? 'aus').toLowerCase() === 'an';
  },
};
