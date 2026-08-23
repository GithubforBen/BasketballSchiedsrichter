/**
 * Ersatz fuer das Paket "server-only" in Tests.
 *
 * Das Original wirft ausserhalb einer Server-Umgebung absichtlich einen Fehler,
 * damit ein Modul nicht versehentlich im Browser landet. Genau diese Sperre
 * soll bleiben — im Test wird sie durch diese leere Datei ersetzt, statt sie
 * im Anwendungscode wegzulassen.
 */
export {};
