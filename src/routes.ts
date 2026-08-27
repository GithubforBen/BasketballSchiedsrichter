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

/**
 * Der Pfad der eindeutigen Antwortlinks aus den Nachrichten.
 *
 * Er steht hier, weil ihn zwei Seiten brauchen: die Nachricht, die den Link
 * schreibt (`src/notifications/action-links.ts`), und die Seite, die ihn
 * beantwortet. Zwei Schreibweisen desselben Pfads wären ein Fehler, der erst
 * beim Empfänger auffiele.
 */
export const ANSWER_PATH = '/antwort';

/**
 * Ein Antwortlink mit Rückmeldung zur zuletzt ausgeführten Antwort.
 *
 * Der Token steht im Pfad und nicht im Abfrageteil: die WhatsApp Cloud API
 * erlaubt in einem dynamischen URL-Knopf genau eine Variable, und nur am Ende
 * der Adresse. Die typisierte Routenprüfung von Next kennt diesen zur Laufzeit
 * zusammengesetzten Pfad nicht — deshalb die Zusicherung, hier an einer Stelle
 * und mit Begründung.
 */
export const answerRoute = (
  token: string,
  result?: { ok: boolean; message: string },
): Route =>
  withQuery(
    `${ANSWER_PATH}/${encodeURIComponent(token)}` as Route,
    result ? { [result.ok ? 'hinweis' : 'fehler']: result.message } : {},
  );

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

/**
 * Anmeldeseite.
 *
 * `tel` fuellt das Feld wieder, damit nach einem Tippfehler im Passwort nicht
 * auch die Nummer neu eingegeben werden muss. Das Passwort steht hier
 * selbstverstaendlich nie: eine Adresse landet im Verlauf, in Protokollen und
 * in der Adresszeile.
 *
 * `schritt` gehoert zum Weg ueber den Link, der nur mit `LOGIN_MAGIC_LINK=an`
 * offensteht.
 */
export const loginRoute = (query: {
  schritt?: 'code';
  tel?: string;
  fehler?: string;
  hinweis?: string;
}): Route => withQuery('/anmelden', query);

/** Notzugang mit Rückmeldung. Regel 41. */
export const recoveryRoute = (query: { fehler?: string } = {}): Route =>
  withQuery('/notzugang', query);

/** Passwortseite mit Rückmeldung. Regeln 37 und 38. */
export const passwordRoute = (query: { fehler?: string; hinweis?: string } = {}): Route =>
  withQuery('/passwort', query);

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
