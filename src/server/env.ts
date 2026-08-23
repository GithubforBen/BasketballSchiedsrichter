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

export const env = {
  get sessionSecret(): string {
    const secret = required('SESSION_SECRET');
    if (process.env.NODE_ENV === 'production' && secret === 'bitte-ersetzen') {
      throw new Error('SESSION_SECRET steht noch auf dem Beispielwert.');
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
};
