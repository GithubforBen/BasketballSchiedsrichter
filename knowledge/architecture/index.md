# Component

* [Betriebsskripte (src/cli)](cli.md) - Kommandozeilen-Skripte für den Betrieb: Notzugang, WhatsApp-Vorlagen anlegen, reparieren und testen, Namen zusammenführen.
* [Betriebsverbund (docker-compose.yml)](betriebsverbund.md) - Die Dienste im Betrieb: App, Postgres, Zeitgeber, tägliche Sicherung, Cloudflare Tunnel und CloudBeaver nur im LAN.
* [Datenbank-Schema (src/db, drizzle/)](datenbank.md) - Drizzle-Schema, Migrationen und Seeds: Schiedsrichter, Spiele, Plätze, Outbox, Einstellungen, Prüfprotokoll.
* [Nachrichtenversand (src/notifications)](nachrichtenversand.md) - Vorlagen-Texte, Kanal-Schnittstelle (WhatsApp oder E-Mail) und Antwortlinks.
* [Oberfläche (src/app, src/components)](oberflaeche.md) - Next.js-Seiten für öffentliche Ansicht, Schiedsrichter- und Adminbereich, eine responsive App für Desktop und Handy.
* [Regel-Engine (src/domain)](regel-engine.md) - Reine Fachlogik ohne Datenbank: Eintragen, Fristen, Nachrücken, Nachrichtenplan, Statistik, Sichtbarkeit.
* [Serverschicht (src/server)](server.md) - Liest und schreibt die Datenbank, ruft die Regel-Engine, führt Admin-Aktionen, Anmeldung, Outbox, Aufbewahrung und Auskunft aus.

# Data Flow

* [Verarbeitete personenbezogene Daten und ihre Wege](verarbeitete-daten.md) - Welche Tabelle welche personenbezogenen Daten hält, wie lange, und wer außerhalb des Vereins etwas bekommt (Meta, Cloudflare, SMTP).

# Interface

* [Antwortlinks /antwort/<Token>](antwortlinks.md) - Signierte Einmal-Adressen für Bestätigung, Nachrück-Anfrage und Verschiebung; gelten bis Anpfiff und handeln erst auf Knopfdruck.
* [Cron-Endpunkt /api/cron](cron-endpunkt.md) - POST arbeitet fällige Fristen und Nachrichten ab, GET zeigt nur, was fällig wäre; geschützt mit CRON_SECRET.
* [CSV-Import und -Export des Spielplans](csv-import-export.md) - Import: Datum;Zeit;Liga;Heim;Gast;Ort plus freiwillige Lizenz-Spalte. Export: dieselben sieben Spalten plus die Kürzel der vier Plätze.
* [Kalenderdatei der eigenen Einsätze (ICS)](kalenderdatei.md) - Eigener Einsatzplan als iCalendar-Datei zum Import; stabile UIDs, keine eigenen Erinnerungen (VALARM).
