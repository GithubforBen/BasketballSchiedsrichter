/**
 * Ersatz fuer das Paket "server-only" in Tests und Kommandozeilen-Skripten.
 *
 * Das Original wirft ausserhalb einer Server-Umgebung absichtlich einen Fehler,
 * damit ein Modul nicht versehentlich im Browser landet. Genau diese Sperre
 * soll bleiben — sie gilt weiter fuer alles, was Next uebersetzt.
 *
 * Ein Test und ein Skript wie `db:seed` sind aber weder Server- noch
 * Client-Komponente: sie laufen unter Node, und dort wirft das Original ohne
 * Grund. Deshalb wird es dort durch diese leere Datei ersetzt — in `vitest.config.ts`
 * und in `tsconfig.skripte.json` —, statt die Markierung im Anwendungscode
 * wegzulassen.
 */
export {};
