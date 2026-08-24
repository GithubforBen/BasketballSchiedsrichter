import type { Route } from 'next';

/**
 * Adressen mit Abfrageteil.
 *
 * Die typisierte Routenpruefung von Next kennt nur Pfade, keine Abfrageteile —
 * `/spiele?tag=2026-08-29` laesst sich damit nicht ausdruecken. Statt an jeder
 * Verwendung eine Zusicherung hinzuschreiben, steht sie hier einmal, zusammen
 * mit dem Grund. Die Pfade selbst bleiben dadurch weiterhin geprueft: wer sich
 * hier vertippt, faellt beim Build auf.
 */

const withQuery = (path: Route, query: Record<string, string | undefined>): Route => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, value);
  }
  const suffix = params.toString();
  return suffix ? `${path}?${suffix}` : path;
};

/** Ein bestimmter Spieltag in „Offene Spiele“. */
export const openGamesRoute = (day?: string): Route => withQuery('/spiele', { tag: day });

/** „Offene Spiele“ mit einer Rückmeldung zur zuletzt ausgeführten Aktion. */
export const openGamesResultRoute = (
  day: string,
  result: { ok: boolean; message: string },
): Route =>
  withQuery('/spiele', {
    tag: day,
    [result.ok ? 'hinweis' : 'fehler']: result.message,
  });

/** Profilseite mit Rückmeldung. */
export const profileResultRoute = (result: { ok: boolean; message: string }): Route =>
  withQuery('/profil', { [result.ok ? 'hinweis' : 'fehler']: result.message });

/**
 * Profilseite mit offener Kostenrückfrage: „Du hast schon N Erinnerungen …“.
 * Der Vorlauf steht in der Adresse, damit die Rückfrage auch ein Neuladen
 * übersteht und nicht in einem flüchtigen Zustand hängt.
 */
export const profileConfirmRoute = (hoursBefore: number): Route =>
  withQuery('/profil', { bestaetigen: String(hoursBefore) });

/** Anmeldeseite in ihren beiden Schritten. */
export const loginRoute = (query: {
  schritt?: 'code';
  tel?: string;
  fehler?: string;
  hinweis?: string;
}): Route => withQuery('/anmelden', query);

/** Adminseiten mit Rückmeldung zur zuletzt ausgeführten Aktion. */
export const adminResultRoute = (
  path: Route,
  result: { ok: boolean; message: string },
): Route => withQuery(path, { [result.ok ? 'hinweis' : 'fehler']: result.message });

/** Ein bestimmtes Spiel im Bearbeiten-Bildschirm. */
export const editGameRoute = (gameId: string, result?: { ok: boolean; message: string }): Route =>
  withQuery('/bearbeiten', {
    spiel: gameId,
    ...(result ? { [result.ok ? 'hinweis' : 'fehler']: result.message } : {}),
  });
