# Schiriplan — Implementierungsplan

Umsetzung des Claude-Design-Handoffs `design/Schiri-Planer Mockup.dc.html` als echte Anwendung.
Stand: 23.08.2026 · abgestimmt mit dem Auftraggeber in Session 1.

---

## 1. Entscheidungen

| Thema | Entscheidung |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript strict |
| Styling | Plain CSS auf den Modernist-Tokens (`design/_ds/.../styles.css` wird Basis), kein Tailwind |
| Datenbank | PostgreSQL, ORM: Drizzle |
| Hosting | Eigener VPS, Docker Compose, Zugriff ausschließlich über Cloudflare Tunnel (kein offener Port) |
| Nachrichten | Meta WhatsApp Cloud API als Ziel; E-Mail-Kanal für Test/Übergang, per Config abschaltbar |
| Login | Passwordless: Magic-Link **und** 6-stelliger Code in derselben Nachricht |
| Mandanten | Ein Verein, Vereinsdaten aus einer Config-Datei (kein `club_id` im Schema) |
| Sprache | Deutsch fest, `<html lang="de">`, keine i18n-Ebene. UI-Texte deutsch, Code englisch |
| Öffentliche Ansicht | Wirklich öffentlich ohne Login, nur Kürzel sichtbar, indexierbar |
| Tests | Vitest (Regel-Engine), Integrationstests gegen echtes Postgres, Playwright E2E (Desktop + Mobile) |

### Offene Punkte, die ich als Annahme setze (Widerspruch jederzeit möglich)

- **Ligen**: U14 / U16 / U18 / Erwachsene / Senioren vorbelegt, vom Admin in den Einstellungen anlegbar, umbenennbar und deaktivierbar.
- **Erster Admin**: per Seed-Kommando (`npm run seed:admin -- --name "..." --phone "+49..."`), da Konten sonst ausschließlich Admins anlegen.
- **CSV**: Format `Datum;Zeit;Liga;Heim;Gast;Ort` wie im Mockup. Duplikaterkennung über `(Datum, Zeit, Heim, Gast)`.
- **Nachrück-Frist**: einstellbar, Standard 12 Stunden, automatisch gekürzt auf ein Drittel der Restzeit bis Anpfiff, wenn weniger als 36 Stunden bleiben.

---

## 2. Fachlogik — verbindliche Regeln

Aus dem Mockup extrahiert und in Session 1 ergänzt. Diese Liste ist die Referenz für die Regel-Engine und ihre Tests.

### Besetzung
1. Pro Spiel 2 **gleichwertige** Schiedsrichter-Plätze und 2 Ersatzplätze.
2. Plätze werden strikt der Reihe nach vergeben: Schiri 1 → Schiri 2 → Ersatz 1 → Ersatz 2. Nur der jeweils erste freie Platz ist belegbar.
3. Eintragen ist sofort verbindlich, First come first served. Bei zwei gleichzeitigen Zugriffen gewinnt genau einer — abgesichert per Transaktion und Unique-Constraint auf `(game_id, slot_index)`.
4. Eintragen nur mit gültiger Qualifikation für die Liga des Spiels.
5. Wer bereits auf einem Platz dieses Spiels steht, kann keinen zweiten belegen.
6. **Max. 1 Spiel pro Tag und Person** (Ersatzplätze zählen mit) — harte Sperre, vom Admin pro Spiel freigebbar.

### Fristen
7. Selbst austragen bis 3 Wochen vor Anpfiff. Danach gesperrt, Admin kann pro Spiel freigeben.
8. Ersatz anfordern bis 3 Tage vor Anpfiff, nur wenn man selbst eingetragen ist. Admin-Override pro Spiel.
9. Beide Fristen sind global in den Einstellungen konfigurierbar.

### Pflichtbestätigung
10. Vorlauf wählbar: 24 / 48 / 72 / 96 Stunden vor Anpfiff. Nachricht mit Knopf „Ja, habe ich gelesen und mache es".
11. Ohne Antwort innerhalb von 24 Stunden: erneute Erinnerung an die Person **und** Meldung an alle Admins.
12. Nur Schiedsrichter-Plätze brauchen eine Bestätigung, Ersatzplätze nicht.

### Ausfall und Nachrücken
13. Sagt ein Schiedsrichter ab oder wird er vom Admin entfernt, wird **Ersatz 1** angefragt („Rückst du nach?") mit Frist.
14. Läuft die Frist ab oder lehnt Ersatz 1 ab, wird **Ersatz 2** mit derselben Frist angefragt.
15. Lehnt auch Ersatz 2 ab oder verstreicht die Frist, wird der Platz für alle Qualifizierten ausgeschrieben.
16. Wer nachrückt, belegt den Schiedsrichter-Platz und bekommt eine Pflichtbestätigung. Der frei gewordene Ersatzplatz wird ausgeschrieben.

### Verschiebung
17. Beim Verschieben erhalten Schiedsrichter **und** Ersatz den neuen Termin mit Absage-Option.
18. Eine Absage öffnet den Platz sofort wieder und stößt die Nachrück-Kaskade an.

### Rotation und Benachrichtigung
19. „Faire Rotation" steuert ausschließlich die **Reihenfolge beim Anschreiben**: wer im gewählten Zeitraum (Woche / Monat / Saison) am wenigsten gepfiffen hat, wird zuerst benachrichtigt, alle anderen zeitversetzt. Das Eintragen selbst bleibt für alle gleichzeitig offen — First come first served wird nicht eingeschränkt.
20. Admin-Meldungen einzeln schaltbar: Spiel ohne zwei Schiris · Pflichtbestätigung 24 h offen · Austragung/Absage · tägliche Zusammenfassung · nach CSV-Import.

### Persönliche Erinnerungen
21. Frei wählbar zwischen 1 Stunde und 168 Stunden (7 Tagen) vor Anpfiff.
22. Ab der 4. Erinnerung Kostenrückfrage („Jede Nachricht kostet den Verein Geld").
23. Hard-Limit 10 Erinnerungen pro Person, Limit konfigurierbar.
24. Die Pflichtbestätigung kommt immer zusätzlich und zählt nicht gegen das Limit.

### Statistik
25. Gezählt werden nur Einsätze **als Schiedsrichter auf dem Feld**. Die Zahl ist abrechnungsrelevant — der Verein bezahlt pro gepfiffenem Spiel. Entsprechend muss sie nachvollziehbar und korrigierbar sein.
26. Ersatz **mit** Einsatz zählt, Ersatz **ohne** Einsatz zählt nicht.
27. Nachrücken zählt automatisch als Einsatz; der Admin kann das pro Spiel nachträglich korrigieren.
28. Ranking: nur die eigene Person namentlich mit Zahl, alle anderen als „anonym" ohne Zahl.

### Sichtbarkeit
29. Ohne Login sind ausschließlich Kürzel sichtbar — kein Name, keine Telefonnummer, kein Profilbild. Das gilt auch für ausgelieferte JSON-Daten und HTML-Attribute, nicht nur für die Anzeige.
30. Name, Kürzel und Telefonnummer ändert ausschließlich der Admin. Das **Profilbild** ändert die Person selbst.

### Nachrichten an Schiedsrichter
31. Wer sich einträgt, bekommt sofort eine Zuteilungsnachricht („Das Spiel gehört dir") mit Datum, Zeit, Ort und Liga.
32. Der Admin kann per Knopf alle Qualifizierten an **offene Spiele** erinnern (die „Notruf"-Erinnerung aus dem Erst-Briefing).
33. Jede Nachricht kostet den Verein Geld — Sparsamkeit ist ein Produktziel, kein Detail. Jeder neue Nachrichtenauslöser muss begründet sein und im Kostenzähler auftauchen.

### Statusfarben
| Zustand | Bedingung | Farbe |
|---|---|---|
| `offen` / `Schiri fehlt` | weniger als 2 Schiedsrichter | `--color-accent` #ec3013 |
| `Ersatz fehlt` | 2 Schiedsrichter, weniger als 2 Ersatz | #c58a00 |
| `besetzt` | alle 4 Plätze belegt | #1f7a4d |

---

## 3. Screens

13 Screens aus dem Mockup, je einmal Desktop und Mobile. **Eine responsive App**: ab 1024px Sidebar-Layout, darunter Bottom-Tab-Bar.

| Screen | Rolle | Kern |
|---|---|---|
| Öffentliche Ansicht | alle | Spieltage, Kürzel-Chips, Statusampel |
| Anmelden | alle | Telefonnummer → Link + Code |
| Offene Spiele | Schiri | Tagesnavigation mit Wischgeste, Eintragen/Austragen, Pflichtbestätigung, Verschiebungs-Banner |
| Kalender & Verlauf | Schiri | Nächste Spiele, Vergangene, Monatsstatistik, Ranking |
| Profil & Erinnerungen | Schiri | Stammdaten (lesend), Qualifikationen, Erinnerungs-Presets, Slider, Limit |
| Spielübersicht | Admin | KPI-Zeile, Spieltage-Tabellen |
| Offene Spiele & Meldungen | Admin | Handlungsfähige Meldungen mit Aktion |
| Spiele anlegen | Admin | Einzeln und CSV-Import mit Vorschau |
| Spiel bearbeiten | Admin | Verschieben/absagen, Overrides, Besetzung entfernen |
| Schiedsrichter | Admin | Konten, Kürzel, Telefon, Qualifikationsmatrix |
| Einstellungen | Admin | Regeln, Pflichtbestätigung, Fristen, Meldungen, Ligen |
| Regeln | alle | Regularien als Text |
| Impressum & Datenschutz | alle | Pflichtangaben |

Zusätzlich, weil im Mockup nicht enthalten aber fachlich nötig: **Spiele nachpflegen** (Admin korrigiert Einsätze nach dem Spiel, Regel 27).

---

## 4. Meilensteine

Jeder Meilenstein ist eine Session und endet mit zwei Review-Stufen:

- **Stufe A — laufend**: Selbstprüfung pro Datei beim Schreiben.
- **Stufe B — Abschluss-Review**: eigener Durchgang am Ende gegen die Checkliste unten. Erst wenn der durch ist, gilt der Meilenstein als fertig.

### M0 + M1 — Fundament, Datenmodell, Regel-Engine ✅ fertig

- Next.js-Scaffold, TypeScript strict, Ordnerstruktur, Docker Compose (App + Postgres), `.env.example`
- Modernist-Tokens als Basis-Stylesheet, App-Shell: Desktop-Sidebar und Mobile-Tabs
- Primitives: Button, Tag, Input, Field, Seg, Table, Toggle, Hr, StatusDot, Avatar-Kürzel
- Komponenten-Galerie unter `/dev/ui` zum Abgleich gegen das Design-System
- Schema: `user`, `qualification`, `league`, `game`, `assignment`, `confirmation`, `reminder`, `notification_outbox`, `setting`, `audit_log`, `login_token`
- Regel-Engine als reine Funktionen ohne DB-Zugriff — alle 33 Regeln aus Abschnitt 2
- Seed mit den Mockup-Daten (5 Spieltage, 8 Spiele, 6 Personen, Qualifikationsmatrix)
- Lint inkl. Design-System-Adherence, Vitest, GitHub Actions

**Review-Fokus**: Keine Hex-Werte und keine rohen Pixelwerte außerhalb der Tokens · kein Border-Radius · Button-Labels linksbündig · Fokusring 2px Akzent · jede Regel aus Abschnitt 2 hat mindestens einen Test inkl. Grenzfall (genau 21 Tage, genau 3 Tage, genau 10 Erinnerungen).

**Ergebnis des Abschluss-Reviews:** 176 Tests grün, davon 4 gegen eine echte Postgres-Instanz.
Alle 33 Regeln tragen mindestens einen Test, der ihre Nummer im Namen führt. Drei Befunde
wurden im Zuge des Reviews behoben:

1. `describeLeadTime` bildete „in 7 Tage" statt „in 7 Tagen" — die Stundenangabe braucht nach
   „in" den Dativ. Dafür gibt es jetzt `describeHoursDative`.
2. Die Duplikaterkennung beim Spielimport griff nicht: `timestamptz` speichert Mikrosekunden,
   JavaScript liest nur Millisekunden, und ein zurückgeschriebener Zeitstempel traf deshalb
   nie den Unique-Index. Die Spalte steht jetzt auf Sekundengenauigkeit.
3. Die Basisklasse `.btn` des Design-Systems zentriert Beschriftungen, obwohl der Leitfaden
   linksbündige verlangt — das Mockup korrigiert das an jedem einzelnen Button. Die Korrektur
   steht jetzt einmal zentral in `app.css`.

### M2 — Öffentliche Ansicht und Anmeldung ✅ fertig

- Öffentliche Spieltagsansicht, serverseitig gerendert, ohne personenbezogene Daten außer Kürzel
- Login: Telefonnummer → Token erzeugen → Versand über Kanal-Adapter (Dev: Outbox-Ansicht)
- Magic-Link **und** 6-stelliger Code, Link 15 Minuten gültig, Einmalverwendung, Rate-Limit
- Session-Cookie HTTP-only, 30 Tage, Rollen-Guard für alle Routen
- „Zuletzt geöffneter Screen" nach dem Login
- Regeln-Seite, Impressum & Datenschutz
- Seed-Kommando für den ersten Admin

**Review-Fokus**: Ohne Login taucht in **keiner** Antwort ein Name oder eine Telefonnummer auf — geprüft über die ausgelieferte HTML- und JSON-Nutzlast, nicht nur visuell. Tokens sind einmalig, zeitlich begrenzt und nicht erratbar. Cloudflare-Tunnel-Header korrekt ausgewertet, damit Rate-Limits nicht alle Nutzer als eine IP sehen.

**Ergebnis des Abschluss-Reviews:** 247 Unit- und Integrationstests plus 30 E2E-Tests
(Desktop und Handy, gegen den Produktionsbuild). Vier Befunde wurden im Zuge des Reviews
behoben:

1. **Anmeldelinks führten ins Leere.** Next ersetzt ein relativ angegebenes `Location` durch
   eine absolute Adresse und nimmt dafür die *Bindeadresse* des Servers — im eigenständigen
   Betrieb `0.0.0.0`, hinter dem Cloudflare Tunnel den internen Dienstnamen. `Host` und
   `X-Forwarded-Host` werden dabei nicht ausgewertet. Das Sitzungscookie gilt aber für den
   Host, den der Browser aufgerufen hat, und wurde nach der Weiterleitung nicht mehr
   mitgeschickt: die Anmeldung sah erfolgreich aus und war es nicht. Weiterleitungen lösen
   jetzt gegen `PUBLIC_BASE_URL` auf — dieselbe Quelle, aus der auch der Anmeldelink entsteht.
2. **`+49 0151 …` wurde stillschweigend zu einer falschen Nummer.** Die Vermischung aus
   Ländervorwahl und nationaler Null ist die häufigste Fehleingabe; die Nachricht wäre nie
   angekommen. Wird jetzt mit Begründung abgelehnt.
3. **Ein fehlendes `PUBLIC_BASE_URL` wäre unbemerkt geblieben.** Da Anmeldelink und
   Weiterleitung daran hängen, bricht der Start im Echtbetrieb jetzt ab, statt auf localhost
   zu zeigen.
4. **„Sa." statt „Sa"** — die deutsche Kurzform des Wochentags trägt in Node einen Punkt,
   das Mockup schreibt sie ohne. Die Beschriftung wird jetzt aus zwei Formatierungen
   zusammengesetzt, statt am Ergebnis herumzuschneiden.

Nicht behoben, sondern festgehalten: `/dev/ui` und `/dev/outbox` sind im Produktionsbetrieb
nicht erreichbar (geprüft). Die E2E-Tests lesen die Anmeldenachricht deshalb direkt aus der
Datenbank statt über die Entwicklerseite.

Zwei Dinge am Rande, die beim Prüfen auffielen und gleich mitkorrigiert wurden: der
Vorbereitungsschritt für den eigenständigen Server war nicht wiederholbar (beim zweiten Lauf
entstanden verschachtelte Verzeichnisse), und ein Build ohne vorheriges Aufräumen nahm eine
gelöschte Route aus dem Zwischenspeicher wieder mit.

### M3 — Schiedsrichter-Bereich ✅ fertig

- Offene Spiele mit Tagesnavigation, Wischgeste, Tastaturbedienung
- Eintragen / Austragen / Als Ersatz eintragen — transaktionssicher
- Pflichtbestätigung mit Zustandsanzeige
- Verschiebungs-Banner mit „Bleibe dabei" / „Absagen"
- Kalender & Verlauf, Monatsstatistik, Ranking
- Profil & Erinnerungen inkl. Kostenrückfrage und Limits

**Review-Fokus**: Nebenläufigkeitstest — zwei parallele Eintragungen auf denselben Platz, genau eine gewinnt, die andere bekommt eine verständliche Meldung. Alle Sperrgründe erzeugen eine erklärende Meldung statt eines toten Knopfs.

**Ergebnis des Abschluss-Reviews:** 290 Unit- und Integrationstests, dazu 23 E2E-Tests je
Geräteklasse für den Schiedsrichter-Bereich. Jede der 33 Regeln trägt weiterhin mindestens
einen Test mit ihrer Nummer im Namen. Zwei Befunde wurden im Zuge des Reviews behoben:

1. **Der Zweitschnellste hätte eine Fehlerseite bekommen.** Bei zwei gleichzeitigen
   Eintragungen auf denselben Platz greift der Primärschlüssel — aber der Datenbankfehler
   kommt aus der Transaktion *eingewickelt* zurück, und die Erkennung sah nur die oberste
   Ebene. Statt „jemand war schneller" wäre eine unbehandelte Ausnahme herausgefallen. Der
   Nebenläufigkeitstest hat das beim ersten Lauf aufgedeckt; die Ursachenkette wird jetzt
   durchsucht, abgesichert durch einen eigenen Test ohne Datenbank.
2. **Der Seed benutzte feste Kalenderdaten.** Damit rutschten alle Spiele mit der Zeit in die
   Vergangenheit — und schon zum Zeitpunkt des Reviews lag kein Spiel mehr weit genug
   entfernt, um die Austragefrist von drei Wochen überhaupt zu erreichen: die Funktion war im
   Seed nicht mehr erprobbar. Die Anpfiffzeiten liegen jetzt relativ zum heutigen Tag, mit
   denselben Abständen wie im Mockup (7, 8, 14, 21 und 28 Tage).

Der Kern des Bereichs, die Sichtbarkeit der Aktionen, liegt bewusst in der Regel-Engine
(`slot-actions.ts`) und nicht in der Oberfläche. Dadurch ist die Zusicherung „kein Knopf ist
stumm gesperrt" ohne Browser prüfbar — und wird zusätzlich im Browser über alle Plätze
hinweg nachgeprüft.

### M4 — Admin-Bereich ✅ fertig

- Spielübersicht mit KPI-Zeile, Meldungsliste mit Aktionen
- Spiele anlegen einzeln, CSV-Import mit Vorschau und Duplikaterkennung
- Spiel bearbeiten: verschieben, Halle ändern, absagen, Overrides, Besetzung entfernen
- Schiedsrichter-Verwaltung mit Qualifikationsmatrix
- Einstellungen: Regeln, Pflichtbestätigung, Fristen, Admin-Meldungen, Ligen
- Neuer Screen „Spiele nachpflegen" für Regel 27

**Review-Fokus**: Jede Admin-Aktion erzeugt die richtigen Nachrichten **und** einen Audit-Eintrag. Entfernen eines Schiris stößt die Nachrück-Kaskade korrekt an. CSV-Import ist idempotent.

**Ergebnis des Abschluss-Reviews:** 334 Unit- und Integrationstests, dazu 17 E2E-Tests für den
Adminbereich (55 E2E insgesamt). Alle drei Punkte des Review-Fokus sind eigens belegt: das
Prüfprotokoll je Aktion, die Nachrück-Kaskade beim Entfernen und ein zweifach ausgeführter
Import, der nichts doppelt anlegt. Zwei Befunde:

1. **Ein Test war von der Uhrzeit abhängig.** Der Test zu Regel 6 legte zwei Spiele „drei
   Stunden auseinander" an, ausgehend von der aktuellen Uhrzeit. Am Abend fiel das zweite Spiel
   damit auf den Folgetag — und die Regel griff zu Recht nicht. Der Test schlug also je nach
   Tageszeit des Laufs fehl, ohne dass sich am Code etwas geändert hätte. Anpfiffzeiten in
   Tests liegen jetzt auf einer festen Ortszeit, und der Bezugspunkt wird einmal je Datei
   festgehalten statt bei jedem Aufruf neu gelesen.
2. **`String(formData.get(…))` hätte „[object Object]" ergeben**, wenn statt eines Textfelds
   eine Datei ankommt. Der Linter hat es aufgedeckt; alle Formularfelder laufen jetzt über
   denselben typprüfenden Helfer.

Bewusst so gebaut: Die Qualifikationsprüfung hat in den Einstellungen **keinen** Schalter,
sondern einen Hinweis — sie ist Pflicht (Regel 4), und ein Regler, der nichts bewirkt, wäre
schlimmer als keiner. Wird eine Qualifikation entzogen, bleiben bestehende Eintragungen
erhalten: sie stillschweigend zu löschen würde ein Spiel unbemerkt unbesetzt lassen. Und der
letzte aktive Admin kann sich weder herabstufen noch stilllegen, sonst käme niemand mehr an
die Verwaltung.

### M5 — Nachrichten und Hintergrundjobs ✅ fertig

- Kanal-Adapter: WhatsApp Cloud API, E-Mail, Dev-Outbox — per Config umschaltbar
- Nachrichtentexte als Templates, WhatsApp-Template-Struktur berücksichtigt
- Scheduler für alle Auslöser: persönliche Erinnerungen, Pflichtbestätigung, 24-h-Nachfassen, Nachrück-Fristen, Auto-Nachfrage bei offenen Spielen, tägliche Zusammenfassung
- Outbox mit Retry, Idempotenzschlüssel, Zustellstatus und Kostenzähler
- Rotation als Anschreib-Reihenfolge (Regel 19)

**Review-Fokus**: Keine Doppelversendung bei Neustart oder doppeltem Cron-Lauf. Limits greifen. Alles im Trockenlauf testbar, ohne echte Nachrichten.

**Ergebnis des Abschluss-Reviews:** 459 Unit- und Integrationstests, dazu 115 E2E-Tests auf
Desktop und Handy — zweimal hintereinander grün, was vorher nicht möglich war (Befund 13).

Alle drei Punkte des Review-Fokus sind eigens belegt: ein zweiter Lauf über unveränderten Daten
legt null Zeilen an, zwei gleichzeitige Läufe teilen sich die Arbeit statt sie zu verdoppeln,
eine im Versand hängengebliebene Zeile wird nach ihrer Frist wieder abgeholt; die Grenze je Lauf
und das Tagesbudget greifen nachweislich; und `planNotifications` entscheidet ohne Datenbank,
ohne Netz und ohne dass eine Nachricht Geld kostet.

Dreizehn Befunde, davon zehn echte Fehler:

1. **Der Kostendeckel war jeden Abend zwei Stunden lang wirkungslos.** Der Tageszähler bildete
   „Mitternacht" als `Mitternacht UTC des Vereins-Kalendertags`. In Berliner Sommerzeit gehören
   die zwei Stunden vor Mitternacht Ortszeit aber schon zum nächsten UTC-Tag — die Grenze lag
   damit in der Zukunft, keine verschickte Nachricht zählte mehr, der Zähler stand auf null und
   das Tagesbudget griff nicht. Aufgefallen im Integrationstest zum Budget, der zur falschen
   Zeit lief und deshalb genau in dieses Fenster fiel. `localToUtc` ist aus den Seed-Daten in
   die Fachschicht gezogen und um `startOfLocalDay` ergänzt; drei Tests halten die Grenze fest.
2. **Ein Join ohne Join-Bedingung.** Die Abfrage für die Rotation verband Einsätze und Spiele
   über den Datumsbereich statt über die Spiel-Id — ein Kreuzprodukt, das jeden Einsatz mit
   jedem Spiel des Fensters gepaart hätte. Die Anschreib-Reihenfolge wäre Unsinn gewesen.
   Gefunden beim erneuten Lesen des eigenen Diffs.
3. **Die Nachrück-Anfrage wäre in einer zweiten Runde stumm geblieben.** Ihr Schlüssel bestand
   aus Spiel, Platz und Person. Rückt jemand nach und trägt sich später wieder aus, entsteht
   für denselben Ersatz auf demselben Platz eine neue Anfrage — mit demselben Schlüssel. Die
   Outbox hätte sie als Doppelung verworfen, und die Frage wäre nie gestellt worden. Der
   Schlüssel hängt jetzt an der Anfrage selbst.
4. **Dieselbe Lücke bei der Ausschreibung.** Wird ein Platz frei, besetzt und wieder frei, sah
   die zweite Ausschreibung wie eine Wiederholung der ersten aus. Dafür zählt `vacancyVersion`
   am Spiel jede neu entstandene Lücke mit; der Zähler steckt im Schlüssel.
5. **Die Anmeldenachricht galt beim ersten Fehler als endgültig gescheitert.** Sie lief an der
   Outbox vorbei und setzte im Fehlerfall `failed` mit einem Versuch — ein kurzer Ausfall des
   Kanals hätte den Zugang verschluckt, ohne dass es je einen zweiten Versuch gegeben hätte.
   Sie läuft jetzt über dieselbe Outbox wie alles andere, wird aber sofort zugestellt statt
   bis zum nächsten Cron-Lauf zu warten — es steht jemand davor und wartet.
6. **`queued` meldete Geplantes statt Angelegtes.** Ein zweiter Lauf hätte „25 Nachrichten
   angelegt" berichtet, obwohl er keine einzige angelegt hat. Gezählt wird jetzt, was
   tatsächlich entstanden ist — und genau daran hängt der Beleg für den doppelten Cron-Lauf.
7. **Grammatik im eigenen Text:** „7 Tagen vor Anpfiff". Der Dativ gehört hinter die
   Präposition („in 7 Tagen"), die Maßangabe davor steht im Nominativ.
8. **Eine längst verstrichene Erinnerung wäre nachträglich rausgegangen.** Nach einem Ausfall
   hätte die 7-Tage-Erinnerung sechs Tage zu spät „in 7 Tagen" geschrieben. Sie wird nur noch
   innerhalb von sechs Stunden nachgeholt — lieber keine Erinnerung als eine irreführende.
9. **Bitte und Mahnung im selben Augenblick.** Wer sich *innerhalb* des Bestätigungsvorlaufs
   einträgt — 40 Stunden vor Anpfiff bei 72 Stunden Vorlauf —, war nach der alten Rechnung
   sofort „überfällig": der Zeitpunkt der Anfrage lag ja schon 32 Stunden zurück. Er hätte im
   selben Lauf die Bitte und die Mahnung bekommen, zu einer Frage, die ihm nie gestellt wurde.
   Der Zeitpunkt der Anfrage ist jetzt der spätere von beidem — Vorlauf oder Eintragung.
   Derselbe Fehlertyp wie bei den Erinnerungen, an einer zweiten Stelle.
10. **Eine unbekannte Nachrichtenart hätte eine leere Nachricht verschickt.** Die Outbox liest
    ihre Art als Text zurück; wäre nach einem Umbau eine Art verschwunden, während alte Zeilen
    noch warten, hätte die Textfunktion nichts geliefert und eine Nachricht ohne Betreff und
    ohne Inhalt wäre rausgegangen — zum vollen Preis. Die Arten sind jetzt eine Liste zur
    Laufzeit, und was nicht darin steht, scheitert dauerhaft statt leer zuzustellen.

11. **Zwei Adminbildschirme scrollten am Handy waagerecht** — `/uebersicht` um 348, `/schiris`
    um 501 Pixel. Die Ursache saß nicht in den Tabellen: die stecken korrekt in einem
    scrollbaren Rahmen. Es waren die Screenreader-Beschriftungen in den Zellen. Sie sind
    `position: absolute`, und ohne positionierten Vorfahren ist ihr umschließender Block das
    Fenster selbst — sie entkommen dem Rahmen und ziehen die Seite auf. Ein `position: relative`
    auf `.scroll-x` behebt beides.
12. **Derselbe Fehler machte einen Knopf unklickbar.** Die entkommene Beschriftung lag über
    „+ Schiedsrichter anlegen"; der Test lief 90 Sekunden lang in Klickversuche, die ein
    unsichtbares Element abfing. Eine Person mit dem Finger hätte dasselbe erlebt.
13. **Die E2E-Suite war nicht wiederholbar.** Sie verschiebt Spiele und stellt sie nie zurück.
    Beim zweiten Lauf lag das erste Spiel bereits auf der Zeit, auf die ein Test es erst
    verschieben wollte — der Test schlug fehl, ohne dass sich am Code etwas geändert hatte. Das
    Zurücksetzen umfasst jetzt auch Anpfiff, Ort, Zustand und die beiden Zähler.

Befunde 11 und 12 waren nur zu sehen, weil die Suite überhaupt in vertretbarer Zeit lief. Sie
brauchte 75 Minuten, weil jeder Seitenaufbau rund zwölf Sekunden auf die Schrift von Google
Fonts wartete, bevor `load` ausgelöst wurde — die eigene Seite ist nach 75 Millisekunden fertig.
Der Browser im Test bekommt jetzt `--no-proxy-server`; die Suite läuft in anderthalb Minuten.
Die Mobil-Variante der Admin-Tests lief damit zum ersten Mal überhaupt durch, und beide Fehler
lagen dort.

Und die Fehlermeldung selbst wurde brauchbar gemacht: „läuft 348px über" sagt nicht, wo man
suchen soll. Der Test nennt jetzt die Elemente, die hinausragen — und lässt dabei aus, was ein
Scroll-Rahmen ohnehin abschneidet, sonst wäre jede breite Tabelle ein Fehlalarm.

Bewusst so gebaut:

- **Die erste Ausschreibung hängt nicht am Schalter für die automatische Nachfrage.** Ohne sie
  erführe niemand von der Lücke (Regel 15). Nur die Wiederholungen sind abschaltbar, denn sie
  kosten erneut Geld.
- **Der Trockenlauf ist der lesende Weg.** `GET /api/cron` zeigt, was ein Lauf täte; `POST`
  führt ihn aus. Ein vorausschauender Browser oder ein Linkprüfer darf nichts auslösen, was
  Geld kostet.
- **Der Text entsteht erst beim Versand**, aus dem frisch gelesenen Spiel: verschiebt sich der
  Anpfiff zwischen Anlegen und Versand, nennt die Nachricht den neuen Termin. Nur die
  Anmeldenachricht trägt ihren Text mit, weil Link und Code danach nicht mehr rekonstruierbar
  sind. Die Dev-Outbox benutzt dieselbe Funktion — was dort steht, geht auch so raus.
- **Eine Erinnerung geht nur an jemanden, der zu ihrem Zeitpunkt schon eingetragen war.** Wer
  sich zwei Stunden vor Anpfiff einträgt, bekommt keine „7 Tage vorher"-Nachricht mehr.
- **Der Zeitgeber läuft im internen Netz**, nicht über den Tunnel. Ein Ausfall bei Cloudflare
  soll die Erinnerungen nicht mitnehmen.

Nebenbei: `tsconfig.tsbuildinfo` lag seit M2 in der Versionsverwaltung. Ein reines
Build-Artefakt, das sich bei jedem Lauf ändert — jetzt in `.gitignore`.

### M6 — Härtung und Abnahme

- Barrierefreiheit: Tastaturbedienung, Kontraste, Fokusreihenfolge, Screenreader-Beschriftungen
- Responsive-Feinschliff gegen beide Artboards, Screen für Screen
- Rate-Limits, Fehlerseiten, Logging ohne personenbezogene Daten
- Datenschutz: Löschkonzept, Aufbewahrungsfristen, Auskunftsfähigkeit
- **Archivo selbst ausliefern statt von Google Fonts.** `modernist.css` lädt die Schrift per
  `@import` von `fonts.googleapis.com` — so steht es im Handoff, und so ist es bisher
  unverändert übernommen. Im Betrieb heißt das: der Browser jedes Besuchers der öffentlichen
  Seite verbindet sich mit Google, bevor irgendetwas zu sehen ist. Für einen deutschen Verein
  mit Impressum und Datenschutzerklärung ist das der bekannte Streitpunkt, und die Schrift ist
  zugleich ein fremder Punkt, an dem der Seitenaufbau hängen bleiben kann: in der Testumgebung
  wartete jeder Seitenaufbau zwölf Sekunden auf diese eine Anfrage, bevor `load` ausgelöst
  wurde. Für die Tests ist das umgangen (siehe M5); im Betrieb bleibt die Abhängigkeit.
- Vollständige E2E-Suite Desktop und Mobile
- Deployment auf den VPS, Cloudflare Tunnel, Backups, Monitoring

**Review-Fokus — großes Abschluss-Review**: Screen-für-Screen-Abgleich gegen `design/Schiri-Planer Mockup.dc.html` · alle 33 Regeln nachweislich getestet und fachlich richtig · Tests prüfen Verhalten, nicht Implementierung · kein toter Code · Design-System-Treue durchgehend.

---

## 5. Review-Checkliste (gilt für jeden Meilenstein)

**Design**
- [ ] Kein Hex-Wert und kein roher Pixelwert, wo ein Token existiert
- [ ] Border-Radius nirgends größer als 0
- [ ] Button-Labels linksbündig, auch in breiten Buttons
- [ ] Trennlinien 2px zwischen Abschnitten, 1px zwischen Zeilen — keine Hairlines
- [ ] `:focus-visible` überall als 2px Akzent-Outline
- [ ] Archivo 400/600/800, keine Fremdschrift

**Fachlichkeit**
- [ ] Jede berührte Regel aus Abschnitt 2 hat einen Test mit Grenzfall
- [ ] Sperren erklären sich dem Nutzer, statt nur zu blockieren
- [ ] Jede Nachricht ist idempotent und zählbar

**Code**
- [ ] TypeScript strict, keine `any`
- [ ] Regel-Engine bleibt frei von DB- und UI-Abhängigkeiten
- [ ] Kein auskommentierter oder unerreichbarer Code
- [ ] Tests grün und fachlich aussagekräftig — kein Test, der nur die Implementierung spiegelt

---

## 6. Bewusst gestrichen — nicht bauen

Zwischen Erst-Briefing und finalem Mockup hat der Auftraggeber mehrere Funktionen wieder
gestrichen. Sie stehen noch im ursprünglichen Auftragstext, sind aber **nicht** Teil des
Produkts. Wer sie im Code sieht, hat sich verlaufen.

| Gestrichen | Stand im Erst-Briefing | Warum weg |
|---|---|---|
| **Standard-Verfügbarkeit** | Wochenplan „Mo–Sa verfügbar, So nie" als Vorbelegung | Ausdrücklich zurückgezogen: „Standard-Verfügbarkeit rausnehmen" |
| **Automatische Zuteilung** | System verteilt Spiele nach Regeln automatisch | Ersetzt durch „immer First come first served". Die Regeln aus dem Briefing leben nur noch als Anschreib-Reihenfolge (Regel 19) und als Sperre (Regel 6) weiter |
| **Bewerbung mit Bestätigung** | Zwei Modi: sofort verbindlich **oder** Bewerbung, die Admin/System bestätigt | Fällt mit der automatischen Zuteilung weg. Es gibt nur noch einen Zustand: eingetragen = verbindlich. Kein „⏳ wartet auf Bestätigung" |
| **Sich für Tage sperren** | Swipe nach links sperrt den Tag | Ersatzlos gestrichen |
| **Telefonnummer selbst ändern** | Schiedsrichter ändert seine Nummer im Profil | Nur noch der Admin |

### Die Wischgeste hat ihre Bedeutung gewechselt

Im Erst-Briefing hieß Wischen: rechts = bewerben, links = Tag sperren. **Heute heißt Wischen:
Spieltag wechseln** — links zum nächsten, rechts zum vorherigen Spieltag. Das Eintragen läuft
ausschließlich über die Knöpfe an den vier Plätzen. Diese Umdeutung ist die häufigste
Fehlerquelle beim Nachbauen aus dem alten Auftragstext.

---

## 7. Referenzdateien im Repo

- `design/Schiri-Planer Mockup.dc.html` — der Handoff, maßgeblich für Layout, Texte und Verhalten
- `design/BRIEFING.md` — Erst-Briefing und alle Änderungswünsche aus der Design-Session, inklusive der
  Punkte, die später gestrichen wurden. Bei Widerspruch gilt: Mockup schlägt Änderungswunsch schlägt Erst-Briefing
- `design/_ds/modernist-.../styles.css` — Tokens und Komponentenklassen, Basis des App-Stylesheets
- `design/_ds/modernist-.../readme.md` — die Design-System-Regeln
- `design/_ds/modernist-.../_adherence.oxlintrc.json` — maschinenlesbare Adherence-Regeln für den Linter
- `design/support.js` — das Prototyp-Runtime von Claude Design. Nur zur Einordnung, geht **nicht** in die Anwendung ein.
