# Verzeichnis der verarbeiteten Daten

Vollständige Liste aller Felder, die SCHIRIPLAN speichert — aus
`src/db/schema.ts` abgeleitet, nicht aus der Erinnerung. Sie dient zwei Zwecken:
als Grundlage der [Datenschutzerklärung](datenschutzerklaerung.md) und als
Verzeichnis von Verarbeitungstätigkeiten nach Art. 30 DSGVO.

**Wer diese Liste ändert, ändert sie zusammen mit dem Schema.** Ein Verzeichnis,
das dem Code hinterherhinkt, ist schlimmer als keines: es sieht vollständig aus.

Spalte **PB**: enthält das Feld personenbezogene Daten?
`ja` · `mittelbar` (nur über eine Kennung zuordenbar) · `nein`

---

## Überblick: wo etwas über Personen steht

| Tabelle                 | Personenbezug             | Aufbewahrung           |
| ----------------------- | ------------------------- | ---------------------- |
| `referees`              | Stammdaten, Kern          | solange Konto besteht  |
| `qualifications`        | mittelbar                 | solange Konto besteht  |
| `assignments`           | mittelbar                 | solange Konto besteht  |
| `promotion_offers`      | mittelbar                 | solange Konto besteht  |
| `login_tokens`          | mittelbar                 | 7 Tage                 |
| `notification_outbox`   | **Wortlaut + Anrede**     | 90 Tage                |
| `admin_recovery_tokens` | mittelbar                 | solange Konto besteht  |
| `audit_log`             | mittelbar                 | 400 Tage               |
| `rate_limits`           | **Telefonnummer / IP**    | 2 Tage                 |
| `games`                 | nein (Mannschaften, Orte) | dauerhaft              |
| `leagues`, `settings`   | nein                      | dauerhaft              |

Beim Löschen eines Kontos räumen die Fremdschlüssel alles mit ab, was an der
Person hängt (`ON DELETE CASCADE`); im Prüfprotokoll bleibt der Vorgang, aber
ohne Bezug zur Person (`ON DELETE SET NULL` auf `actor_id`).

---

## `referees` — Stammdaten

Der Kern. Eine Zeile je Person.

| Feld                         | Inhalt                                       | PB        | Zweck                                        |
| ---------------------------- | -------------------------------------------- | --------- | -------------------------------------------- |
| `id`                         | technische Kennung (UUID)                    | mittelbar | Verknüpfung aller übrigen Tabellen           |
| `name`                       | vollständiger Name                           | **ja**    | Anzeige nach Anmeldung, Abrechnung           |
| `first_name`                 | Vorname                                      | **ja**    | Anrede in jeder Nachricht                    |
| `initials`                   | Kürzel, 2–4 Buchstaben                       | **ja**    | **einziges öffentlich sichtbares Feld**      |
| `license`                    | Lizenzstufe E, D oder C — oder leer          | **ja**    | Regel 4: ohne Lizenz keine Eintragung        |
| `phone`                      | Telefonnummer in E.164                       | **ja**    | Anmeldung und Nachrichtenversand             |
| `role`                       | `referee` oder `admin`                       | **ja**    | Rechtevergabe                                |
| `active`                     | aktiv oder stillgelegt                       | **ja**    | Zugang sperren, ohne Zahlen zu verlieren     |
| `avatar_url`                 | Verweis auf ein Profilbild                   | **ja**    | *reserviert — wird derzeit nie befüllt*      |
| `reminder_hours`             | eigene Erinnerungen, Vorlauf in Stunden      | **ja**    | Regel 21: persönliche Erinnerungen           |
| `digest_weeks`               | Zeitraum der Tagesübersicht in Wochen        | **ja**    | nur für Admins                               |
| `digest_enabled`             | ob die Tagesübersicht zugestellt wird        | **ja**    | nur für Admins                               |
| `password_hash`              | scrypt-Hash mit Salz und Parametern          | **ja**    | Anmeldung — **nie Klartext**                 |
| `own_password_set_at`        | wann zuletzt selbst gesetzt                  | **ja**    | Regel 37: Änderungszwang                     |
| `start_password_expires_at`  | Ende der Frist des Start-Passworts           | **ja**    | Regel 36: Frist                              |
| `session_epoch`              | Zähler zum Zurückrufen offener Sitzungen     | mittelbar | Passwortwechsel schließt fremde Sitzungen    |
| `last_screen`                | zuletzt geöffneter Bildschirm                | **ja**    | Einstieg nach der Anmeldung                  |
| `created_at`                 | Zeitpunkt der Anlage                         | **ja**    | Nachvollziehbarkeit                          |

Das Passwort selbst existiert nirgends. Gespeichert ist ausschließlich der
scrypt-Hash samt Zufallssalz und Kostenparametern; aus ihm lässt sich das
Passwort nicht zurückrechnen.

## `qualifications` — für welche Ligen jemand qualifiziert ist

| Feld          | Inhalt                | PB        |
| ------------- | --------------------- | --------- |
| `referee_id`  | Verweis auf die Person| mittelbar |
| `league_id`   | Verweis auf die Liga  | nein      |

## `assignments` — Eintragungen auf Spiele

| Feld                      | Inhalt                                            | PB        |
| ------------------------- | ------------------------------------------------- | --------- |
| `game_id`                 | Verweis auf das Spiel                             | nein      |
| `slot_index`              | Platz 0–3 (zwei Schiedsrichter, zwei Ersatz)      | mittelbar |
| `referee_id`              | Verweis auf die Person                            | mittelbar |
| `claimed_at`              | wann eingetragen                                  | mittelbar |
| `confirmed_at`            | wann bestätigt                                    | mittelbar |
| `acknowledged_relocation` | bis zu welcher Verlegung zurückgemeldet wurde     | mittelbar |

Grundlage der Abrechnung ist der **Platz zum Anpfiff**: wer auf Schiri 1 oder
Schiri 2 steht, hat gepfiffen. Ein eigenes Feld dafür gibt es nicht mehr —
`played_as_referee` und der Bildschirm „Spiele nachpflegen“ sind entfallen.
Stimmt die Besetzung ausnahmsweise nicht, ändert der Admin sie am Spiel selbst,
das auch nach dem Anpfiff bearbeitbar bleibt.

## `promotion_offers` — Anfragen an den Ersatz

| Feld                  | Inhalt                                           | PB        |
| --------------------- | ------------------------------------------------ | --------- |
| `id`                  | Kennung der Anfrage                              | mittelbar |
| `game_id`             | Verweis auf das Spiel                            | nein      |
| `kind`                | `vacancy` (Platz frei geworden) oder `handover` (jemand gibt ab) | nein |
| `referee_id`          | wer gefragt wurde                                | mittelbar |
| `target_slot`         | um welchen Schiedsrichter-Platz es geht          | mittelbar |
| `substitute_slot`     | von welchem Ersatzplatz aus                      | mittelbar |
| `replaces_referee_id` | wer den Platz räumt, wenn zugesagt wird          | mittelbar |
| `requested_by`        | wer die Anfrage ausgelöst hat                    | mittelbar |
| `respond_by`          | Antwortfrist                                     | mittelbar |
| `outcome`             | `pending`, `accepted`, `declined` oder `expired` | mittelbar |
| `created_at`          | wann gefragt                                     | mittelbar |

`kind` entscheidet, was eine Absage bedeutet: bei `vacancy` bleibt die Person
Ersatz, bei `handover` wird sie aus dem Spiel genommen — sie hat gerade gesagt,
dass sie an diesem Termin nicht kann.

## `login_tokens` — Anmeldelinks und -codes

Nur belegt, solange der Anmeldeweg über einen zugeschickten Link eingeschaltet
ist (`LOGIN_MAGIC_LINK`); im Regelbetrieb läuft die Anmeldung über ein Passwort.

| Feld               | Inhalt                                    | PB        |
| ------------------ | ----------------------------------------- | --------- |
| `referee_id`       | für wen der Zugang gilt                   | mittelbar |
| `link_token_hash`  | HMAC des Links — **nie der Klartext**     | mittelbar |
| `code_hash`        | HMAC des sechsstelligen Codes             | mittelbar |
| `expires_at`       | Ablauf (15 Minuten)                       | mittelbar |
| `used_at`          | wann eingelöst                            | mittelbar |
| `attempts`         | Fehlversuche beim Code                    | mittelbar |
| `created_at`       | wann angefordert                          | mittelbar |

**Aufbewahrung: 7 Tage.** Wer die Datenbank liest, kann sich damit nicht
anmelden — gespeichert sind nur Ableitungen.

## `notification_outbox` — versandte und wartende Nachrichten

Die Tabelle mit dem größten Personenbezug: sie enthält den **Wortlaut** jeder
Nachricht einschließlich der namentlichen Anrede.

| Feld             | Inhalt                                                   | PB        |
| ---------------- | -------------------------------------------------------- | --------- |
| `id`, `key`      | Kennung und Idempotenzschlüssel                          | mittelbar |
| `kind`           | Art der Nachricht (Erinnerung, Bestätigung, …)           | mittelbar |
| `channel`        | `whatsapp`, `email` oder `dev`                           | nein      |
| `recipient_id`   | Empfänger                                                | mittelbar |
| `game_id`        | betroffenes Spiel                                        | nein      |
| `payload`        | Werte für den Text (JSON)                                | **ja**    |
| `cost_units`     | verbrauchte Nachrichteneinheiten                         | nein      |
| `state`          | `queued`, `sending`, `sent` oder `failed`                | nein      |
| `attempts`       | Zustellversuche                                          | nein      |
| `send_after`     | Fälligkeit                                               | mittelbar |
| `sent_at`        | Zeitpunkt der Zustellung                                 | mittelbar |
| `last_error`     | Fehlermeldung des Versanddienstes                        | mittelbar |
| `sent_subject`   | Betreff, wie verschickt                                  | **ja**    |
| `sent_body`      | **Wortlaut, wie verschickt** — mit Anrede                | **ja**    |
| `sent_template`  | verwendete WhatsApp-Vorlage samt Werten (JSON)           | **ja**    |

**Aufbewahrung: 90 Tage** ab Zustellung beziehungsweise Fälligkeit. Wartende
Zeilen (`queued`) werden nie durch die Frist gelöscht — sie sind eine Aufgabe,
keine Erinnerung.

Der Wortlaut steht auch im Datenauszug nach Art. 15 DSGVO. Er ist eine
gespeicherte Angabe über die betroffene Person; eine Auskunft, die ihn
verschwiege, wäre unvollständig.

## `admin_recovery_tokens` — Notzugang für ausgesperrte Admins

| Feld          | Inhalt                                | PB        |
| ------------- | ------------------------------------- | --------- |
| `id`          | Kennung                               | mittelbar |
| `referee_id`  | für welches Admin-Konto               | mittelbar |
| `token_hash`  | HMAC des Tokens — **nie der Klartext**| mittelbar |
| `label`       | Notiz, wo der Token liegt             | mittelbar |
| `created_at`  | wann ausgestellt                      | mittelbar |
| `used_at`     | wann eingelöst                        | mittelbar |
| `revoked_at`  | wann widerrufen                       | mittelbar |

Ausgestellt wird ausschließlich über die Kommandozeile auf dem Server, nicht
über die Oberfläche.

## `audit_log` — Protokoll der Verwaltungsvorgänge

| Feld         | Inhalt                                                | PB        |
| ------------ | ----------------------------------------------------- | --------- |
| `id`         | Kennung                                               | mittelbar |
| `actor_id`   | wer gehandelt hat                                     | mittelbar |
| `action`     | Vorgang, z. B. `referee.password-reset`               | mittelbar |
| `game_id`    | betroffenes Spiel                                     | nein      |
| `subject_id` | betroffene Person                                     | mittelbar |
| `detail`     | Einzelheiten des Vorgangs (JSON)                      | **ja**    |
| `created_at` | Zeitpunkt                                             | mittelbar |

**Aufbewahrung: 400 Tage.** Im Protokoll steht, *dass* ein Passwort
zurückgesetzt wurde — nie das Passwort selbst.

## `rate_limits` — Zähler gegen Durchprobieren

Klein, aber datenschutzrechtlich nicht unerheblich: der Schlüssel **enthält die
Telefonnummer beziehungsweise die IP-Adresse im Klartext**.

| Feld           | Inhalt                                                        | PB     |
| -------------- | ------------------------------------------------------------- | ------ |
| `key`          | `login:phone:+49…`, `login:pw:+49…` oder `login:ip:203.0.113.7`| **ja** |
| `window_start` | Beginn des Zeitfensters                                       | **ja** |
| `count`        | Anzahl der Versuche im Fenster                                | **ja** |

**Aufbewahrung: 2 Tage** — die kürzeste Frist der Anwendung, weil die Zeilen
nach Ablauf ihres Fensters wirkungslos sind, aber die Kennung weiter tragen.

Es werden ausschließlich gültige IP-Adressen übernommen; alles andere landet in
einem gemeinsamen Sammelzähler.

## `games` — Spiele

Ohne Personenbezug zu Schiedsrichtern, enthält aber Mannschaftsnamen und
Spielstätten.

`id` · `kickoff` · `league_id` · `league_label` · `home` · `away` · `venue` ·
`required_license` · `state` · `relocation_version` · `vacancy_version` ·
`override_withdraw` · `override_substitute_request` ·
`override_one_game_per_day` · `created_at`

## `leagues` und `settings` — Konfiguration

Als einzige Tabellen hier **nicht Feld für Feld aufgeführt**, sondern
zusammengefasst: sie enthalten keinerlei Personenbezug, sondern ausschließlich
Einstellungen des Vereins.

- `leagues` — die Ligen des Vereins (Kennung, Name, aktiv, Sortierung).
- `settings` — eine einzige Zeile mit den vereinsweiten Regeln: Austrage- und
  Ersatzfristen, Vorlauf der Bestätigung, Grenzen für Erinnerungen,
  Antwortfrist beim Nachrücken, ein Spiel pro Tag, Rotation und ihr Zeitraum,
  automatische Nachfrage, Sichtbarkeit offener Plätze, Quittung bei
  Eintragung sowie die Schalter, welche Meldungen ein Admin erhält.

Wer hier ein Feld ergänzt, prüft, ob es weiterhin ohne Personenbezug ist —
sonst gehört es in eine eigene Tabelle dieser Liste.

---

## CSV-Export des Spielplans

Der Adminbereich gibt den Spielplan unter „Spielübersicht“ als Datei heraus
(`/api/export/spielplan`). Sie enthält je Spiel Datum, Zeit, Liga, Heim, Gast,
Ort, die nötige Lizenz und auf den vier Plätzen die **Kürzel** der
Eingetragenen — keine Namen, keine Telefonnummern, keine Kennungen, keine
Bestätigungszeitpunkte.

Kürzel und nicht Namen, weil das Kürzel nach Regel 29 ohnehin im öffentlichen
Spielplan an jedem Spiel steht: die Datei trägt damit nichts aus dem Haus, was
nicht schon draußen wäre. Wer den Namen hinter einem Kürzel kennt, wusste ihn
vorher.

Der Abruf ist trotzdem auf die Admin-Rolle beschränkt und wird nicht
zwischengespeichert — der vollständige Spielplan auf einmal ist ein Werkzeug
der Verwaltung.

Abgesagte Spiele stehen nicht darin — die Spalten sagen nichts über den Zustand
eines Spiels, und eine abgesagte Begegnung sähe in der Datei aus wie eine
angesetzte.

## Kalenderdatei der eigenen Einsätze

Unter „Kalender & Verlauf“ lädt jede angemeldete Person ihre **eigenen**
kommenden Spiele als iCalendar-Datei herunter (`/api/export/kalender`), um sie
in Google Kalender oder Apple Kalender zu importieren. Welche Spiele in die
Datei kommen, wählt sie selbst aus; vorgewählt sind die, auf denen sie als
Schiedsrichter steht.

In der Datei steht je Termin: Anpfiff, ein angenommenes Ende zwei Stunden
später, die eigene Rolle, die Begegnung, der Ort, die Liga und die nötige
Lizenz. **Kein anderer Mensch kommt darin vor** — weder Name noch Kürzel der
übrigen Eingetragenen, und auch keine Teilnehmerfelder (`ATTENDEE`,
`ORGANIZER`), die ein Kalender sonst an fremde Adressen zurückmelden würde.

Der Abruf liefert ausschließlich die eigenen Einsätze: die Auswahl ist ein
Filter auf die eigene Liste, eine fremde Spiel-Kennung in der Adresse fällt
wirkungslos heraus.

Wichtig für die Einordnung: **wohin die Datei danach geht, entscheidet die
Person selbst.** Importiert sie sie in Google Kalender oder iCloud, liegen
Termin, Ort und Rolle anschließend bei diesem Anbieter. Das ist keine
Übermittlung durch den Verein — die Datei landet zuerst auf dem Gerät —, aber
es ist der Grund, warum in ihr nichts über andere Personen steht.

## Was **nicht** verarbeitet wird

- keine Geburtsdaten, Adressen, E-Mail-Adressen der Mitglieder, Bankverbindungen
- keine besonderen Kategorien nach Art. 9 DSGVO (Gesundheit, Herkunft, …)
- keine Standortdaten
- keine Analyse-, Tracking- oder Werbedaten
- keine Zugriffsprotokolle mit IP-Adressen — die Anwendung schreibt in ihr
  eigenes Protokoll ausdrücklich keine Namen und keine Telefonnummern, sondern
  nur Kennungen, Zahlen und Fehlerarten (`src/server/log.ts`)
- kein Profiling, keine automatisierte Entscheidung nach Art. 22 DSGVO

## Empfänger außerhalb des Vereins

| Empfänger                    | Was übermittelt wird                     | Wann                          |
| ---------------------------- | ---------------------------------------- | ----------------------------- |
| Meta Platforms Ireland Ltd.  | Telefonnummer und Nachrichteninhalt      | bei `NOTIFICATION_CHANNEL=whatsapp` |
| Cloudflare                   | IP-Adresse, Verbindungsdaten             | bei jedem Seitenaufruf        |
| AUSFÜLLEN: SMTP-Anbieter     | E-Mail-Adresse und Nachrichteninhalt     | nur bei `NOTIFICATION_CHANNEL=email` |

Einen Hoster nennt die Tabelle nicht: der Server steht beim Verein, die Daten
liegen dort und werden niemandem zur Verarbeitung überlassen.

Für Cloudflare und gegebenenfalls den SMTP-Anbieter sind Verträge zur
Auftragsverarbeitung nach Art. 28 DSGVO erforderlich.
