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

### Anmeldung mit Passwort

Nachgetragen in Session 2. Der Verein hat für WhatsApp nur ein Budget von **2000 Nachrichten
im Monat**; ein Anmeldeweg, der pro Anmeldung eine Nachricht verbraucht, passt da nicht hinein.
Die Anmeldung läuft deshalb über ein Passwort. Der Nachrichtenweg bleibt vollständig erhalten
und ist per Einstellung wieder zuschaltbar.

34. Angemeldet wird mit **Telefonnummer und Passwort**. Die Telefonnummer bleibt die Kennung —
    sie ist im Verein ohnehin eindeutig und jeder kennt seine eigene.
35. Ein neues Konto bekommt ein **Start-Passwort aus dem Namen**: Vorname und Nachname
    zusammengeschrieben, alles klein, Umlaute ausgeschrieben, alles andere entfällt.
    „Anna-Lena Weiß" ergibt `annalenaweiss`. Es steht **nirgends im Klartext** in der Datenbank
    — es folgt aus dem Namen und wird dem Admin bei Bedarf neu berechnet angezeigt.
36. Das Start-Passwort gilt **14 Tage**. Danach ist es wertlos, und ein Admin muss es neu setzen.
37. Nach der Anmeldung mit dem Start-Passwort **muss** ein eigenes Passwort gesetzt werden. Bis
    dahin ist außer der Passwortseite und dem Abmelden nichts erreichbar.
38. Für das eigene Passwort gibt es **keine Längen- oder Zeichenregeln** — bewusst so
    entschieden, die Schwäche ist bekannt. Zwei Mechaniken bleiben: es darf nicht leer sein, und
    es muss sich vom bisherigen unterscheiden, sonst wäre der Zwang aus Regel 37 folgenlos.
39. **Passwörter werden ausschließlich gehasht gespeichert** (scrypt, mit Salz je Konto).
    Klartext ist überall verboten — in der Datenbank, im Protokoll, im Prüfprotokoll und im
    Datenauszug.
40. Ein Admin kann das Passwort **zurücksetzen**. Das Konto fällt damit auf das Start-Passwort
    aus Regel 35 zurück, mit neuer 14-Tage-Frist und erneutem Änderungszwang.
41. Sperrt sich ein Admin aus, gibt es einen **Notzugang**: ein Befehl auf dem Server erzeugt für
    genau diesen Admin einen sehr langen Token, zeigt ihn **einmal** an und speichert nur seinen
    Hash. Er gilt einmal, ist einzeln widerrufbar und steht im Prüfprotokoll.

### Telefonnummern

42. Die Eingabe akzeptiert **jede übliche Schreibweise** — `+49 151 …`, `0049 151 …`,
    `0151/23456789`, mit Leerzeichen, Klammern oder Bindestrichen. Daraus wird immer dieselbe
    Nummer.
43. **Angezeigt** wird einheitlich die nationale Schreibweise mit führender Null:
    `0151 23456789`. Gespeichert bleibt E.164 (`+4915123456789`), weil der Nachrichtenversand
    kein Format raten darf und weil WhatsApp später zurückkommen soll — das ist unter der
    Oberfläche und für niemanden sichtbar.

### Nachrichten — allgemeine Regeln

Nachgetragen in Session 3, nachdem die elf Vorlagen zum ersten Mal nebeneinander lagen. Sie
gelten für **alle** Nachrichten und nicht nur für die, an der sie aufgefallen sind.

44. **Jede Nachricht zu einem Spiel nennt Datum, Uhrzeit *und* den Vorlauf** — „Sa 29.08.2026,
    10:30 Uhr" und „Anpfiff in 3 Tagen". Das Datum sagt, welches Spiel gemeint ist, der Vorlauf,
    wie eilig es ist. Das gilt auch für jede einzelne Zeile der Tagesübersicht an die Admins.
45. **Keine Nachricht stellt einen Nachfolger in Aussicht.** Kein „sonst müssen wir den Platz neu
    besetzen", kein „ohne Antwort fragen wir den nächsten Ersatz". Wer liest, dass sich ohnehin
    jemand findet, sagt eher ab. Was ohne Antwort geschieht, ist Sache der Anwendung.
46. **Jede Antwort läuft über einen eindeutigen Link.** Bitte um Bestätigung, Nachrück-Anfrage und
    Verschiebung tragen je eine eigene Adresse `…/antwort/<Token>`. Der signierte Token benennt
    Vorgang, Spiel, Person und den Schlüssel der Nachricht und gilt bis zum Anpfiff. Eine
    Bestätigung trifft damit genau das Spiel, um das gebeten wurde, und die Seite kann sagen, ob
    **genau dieses** Spiel schon bestätigt ist. Der Token steht am Ende des Pfades, weil ein
    dynamischer URL-Knopf bei Meta genau eine Variable erlaubt — und nur dort.
47. **Zwei Nachrichten sind im Adminbereich schaltbar:** die Quittung nach dem Eintragen (Regel 31)
    ganz an oder aus, und die Ausschreibung eines offenen Platzes (Regeln 15 und 32) an *alle
    Qualifizierten*, *nur die Admins* oder *aus*. Die Ausschreibung ist die einzige Nachricht an
    viele Personen auf einmal und bestimmt die Kosten fast allein (Regel 33); der Verein
    entscheidet darüber, nicht der Code.

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

- **Die erste Ausschreibung hängt nicht am Schalter für die automatische Nachfrage** — der
  steuert nur die Wiederholungen, denn sie kosten erneut Geld. Ob überhaupt ausgeschrieben wird
  und an wen, entscheidet seit Session 3 die Einstellung *Offene Plätze ausschreiben an*
  (Regel 47): alle Qualifizierten, nur die Admins oder niemand. Vorher ging die erste
  Ausschreibung immer an alle, weil sonst niemand von der Lücke erführe; mit „nur Admins" gibt es
  dafür jetzt einen leiseren Weg und mit „aus" eine bewusste Entscheidung des Vereins.
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

### M6 — Härtung und Abnahme ✅ fertig

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

**Ergebnis des großen Abschluss-Reviews:** 481 Unit- und Integrationstests, 167 E2E-Tests auf
Desktop und Handy — zweimal hintereinander grün. Alle **14 Bildschirme** (13 aus dem Mockup plus
„Spiele nachpflegen") wurden auf beiden Geräteklassen gegen ihre Kernelemente aus Abschnitt 3
geprüft: alle vollständig, keiner scrollt waagerecht. Alle **33 Regeln** tragen weiterhin einen
Test mit ihrer Nummer im Namen. Kein roher Hex-Wert außerhalb der Tokens, kein Border-Radius,
kein `any`, die Regel-Engine bleibt frei von Datenbank und Oberfläche.

Sechs Befunde:

1. **Die Farben des Handoffs halten den Kontrast für Text nicht ein.** Gemessen: gedämpfter Text
   3,66:1, Tabellenköpfe 4,23:1, der Akzent als Schrift *und* als Fläche hinter heller Schrift
   3,76:1, Amber als Schrift 2,68:1 — WCAG 2.1 AA verlangt 4,5:1. Jeder einzelne Bildschirm fiel
   durch. Die Regel dafür steht jetzt in `app.css`: **der Farbton bleibt, die Helligkeit gibt
   nach, sobald Schrift im Spiel ist.** Punkte, Balken und Rahmen behalten die vollen Töne — sie
   tragen keinen Text und brauchen nur 3:1. Gerechnet wird gegen den *dunkelsten* Untergrund,
   auf dem eine Farbe vorkommt: 15 % Abdunklung reichten gegen die Seite, nicht gegen die
   eingefärbte Tabellenzeile.
2. **Zwei Navigationsbereiche hießen beide „Hauptnavigation".** Für einen Screenreader sind sie
   damit nicht auseinanderzuhalten, auch wenn immer nur einer sichtbar ist.
3. **Es gab keine Sprungmarke.** Wer mit der Tastatur bedient, musste sich auf jeder Seite
   erneut durch die Navigation arbeiten — im Adminbereich sieben Anschläge pro Seitenwechsel.
4. **`npm start` konnte einen Build ohne Stylesheets ausliefern, und zwar stumm.** Ohne
   vorheriges `start:prepare` fehlen die statischen Dateien; der Server antwortet mit 200, die
   Seite kommt ungestylt. Das hat mich in diesem Review selbst mehrere Minuten gekostet: eine
   Messung meldete 531 Pixel Überlauf, und der Fehler lag nicht in der App. `start` ruft
   `start:prepare` jetzt selbst auf.
5. **Neun tote Exporte** — Funktionen, die niemand mehr aufruft, teils seit M2. Entfernt. Acht
   weitere waren exportiert, obwohl sie nur im eigenen Modul benutzt werden; sie sind jetzt
   modulintern.
6. **`sharp` lag im Auslieferungsstand**, obwohl die Anwendung nirgends `next/image` benutzt.
   Next legt es unabhängig davon ab. Damit kam ein Paket mit gemeldeten libvips-Lücken ins
   Abbild, das dort nichts zu tun hat. Über `outputFileTracingExcludes` entfernt: der
   Auslieferungsstand schrumpft von 81 auf 46 MB.

Bewusst so gebaut:

- **`global-error.tsx` ist die einzige Datei, in der die Design-System-Regeln nicht gelten.** Sie
  greift, wenn schon das Grundgerüst scheitert; Next ersetzt dann das ganze Dokument samt der
  Stylesheets, und ein `var(--space-4)` zeigte auf nichts. Der Linter ist dort mit schriftlicher
  Begründung abgeschaltet.
- **`src/server/log.ts` ist der einzige Weg ins Serverprotokoll** und nimmt keine freien Texte
  an — auch keine Fehlermeldung, weil darin eine Telefonnummer aus einer Datenbankabfrage
  stecken kann. Die ESLint-Regel gegen `console` ist genau für diese eine Datei ausgesetzt,
  damit die Zusicherung an einer Stelle durchsetzbar bleibt.
- **Löschen nimmt auch die vergangenen Einsätze mit.** Das ist gemeint, wenn jemand seine
  Löschung verlangt. Wer nur aufhört und dessen Zahlen bleiben sollen, wird **stillgelegt** —
  dafür gibt es den Schalter daneben. Wird durch das Löschen ein künftiger Schiedsrichter-Platz
  frei, zählt die Aktion die Lücke hoch, damit der nächste Lauf ihn ausschreibt.
- **Der Datenauszug ist Selbstbedienung und nur für die eigenen Daten.** Eine Id aus der Adresse
  gibt es nicht — sonst wäre der Auskunftsanspruch ein Weg, die Telefonnummer aller anderen
  abzufragen.

Offen, und zwar bewusst — es kann nur der Verein selbst erledigen:

- Impressum ausfüllen (Anschrift, Vorstand, Kontakt, Registergericht).
- Datenschutzerklärung juristisch prüfen lassen. Der Entwurf nennt die Fristen, die der Code
  tatsächlich anwendet.
- WhatsApp-Vorlagen bei Meta einreichen und freigeben lassen; die Texte stehen geschlossen in
  `src/notifications/templates.ts`.
- `SESSION_SECRET`, `CRON_SECRET`, `PUBLIC_BASE_URL` und die Meta-Zugangsdaten setzen.
- `npm audit` meldet Befunde in `postcss` (über Next) und in der `esbuild`-Kette (über
  `drizzle-kit`). Beide sind Build-Werkzeuge und im laufenden Betrieb nicht erreichbar;
  `drizzle-kit` liegt gar nicht im Abbild. Ein Wechsel auf Next 16 wäre ein Breaking Change und
  gehört nicht in einen Härtungs-Meilenstein.

### M7 — Anmeldung mit Passwort ✅ fertig

Nachgezogen, nachdem klar wurde, dass das Nachrichtenbudget bei 2000 im Monat liegt: jede
Anmeldung per Link kostet eine davon. Regeln 34–43.

- Start-Passwort aus dem Namen, vierzehn Tage gültig, erzwungener Wechsel danach
- Passwort ändern für alle, Zurücksetzen für Admins
- Notzugang für den Fall, dass kein Admin mehr hineinkommt
- Telefonnummern in jeder Schreibweise annehmen, einheitlich mit Null anzeigen
- Der Weg über den Link bleibt vollständig gebaut und geprüft, aber abgeschaltet

**Review-Fokus**: nirgends Klartext · das Hashen bewiesen, nicht behauptet · Frist und Zwang
tatsächlich wirksam · Notzugang genau einmal gültig · Rate-Limits wirksam · jede neue Regel
getestet.

**Ergebnis:** 547 Unit- und Integrationstests, 177 E2E-Tests auf Desktop und Handy — grün. Die
Regeln 34–43 tragen ihre Nummer im Namen eines Tests. Drei Zusicherungen sind maschinell
belegt statt behauptet: der gespeicherte Wert enthält das Passwort nicht, das Prüfprotokoll
enthält es nicht, und der Datenauszug nach Artikel 15 nennt nur den *Zustand* des Passworts —
nie den Hash, denn ein Auszug mit Hash wäre ein Auszug, aus dem sich Passwörter durchprobieren
lassen.

Sechs Befunde:

1. **Das Limit auf Fehlversuche zählte jede Anmeldung, nicht nur die falschen.** Wer sich an
   einem Abend neunmal anmeldete, sperrte sich selbst aus. Der Zähler muss vor der Prüfung
   hochgehen — sonst ließe sich gleichzeitig durchprobieren —, also fällt er bei Erfolg wieder
   weg. Gezählt wird, wer rät.
2. **Die Meldung des Rate-Limits passte nicht mehr.** „Für diese Telefonnummer wurden gerade
   schon 8 Anmeldungen angefordert" — es wurde nichts angefordert, es wurde falsch getippt.
   Jede Regel trägt ihren Satzteil jetzt selbst. Die Zahl steht nicht mehr darin: sie hilft
   niemandem weiter und sagt einem Angreifer, wie weit er zählen darf.
3. **`npm run db:seed` und `seed:admin` wären an `server-only` gescheitert.** Beide brauchen
   jetzt den Passwort-Hash, und das Paket wirft außerhalb einer Server-Umgebung absichtlich.
   Ein Skript unter Node ist aber weder Server- noch Client-Komponente. Statt die Markierung
   im Anwendungscode wegzulassen, ersetzt `tsconfig.skripte.json` sie für genau diese Aufrufe
   — für alles, was Next übersetzt, gilt die Sperre unverändert.
4. **Die E2E-Suite hing an einem Wert aus der Entwicklungsumgebung.** `PUBLIC_BASE_URL` zeigte
   auf Port 3000, der Testserver läuft auf 3100; nach dem Abmelden landete der Browser auf
   einem Port, auf dem nichts lief, und der Fehler sah aus wie ein Fehler in der Anwendung.
   Die Playwright-Konfiguration setzt den Wert jetzt selbst.
5. **`formatPhone` trennte an der falschen Stelle.** Mit `\d{2,4}` griff die Suche gierig und
   machte aus `+4915123456789` ein `01512 3456789`. Feste drei Ziffern treffen jede
   Mobilvorwahl; bei Festnetz kann die Trennung danebenliegen, die Nummer bleibt aber
   vollständig und lesbar.
6. **Das Start-Passwort stand im Abfrageteil einer Adresse.** Anlegen und Zurücksetzen gaben es
   in ihrer Rückmeldung zurück, und die reist über die Adresszeile — damit stand ein gültiges
   Passwort im Verlauf des Browsers und im Zugriffsprotokoll jedes Webservers davor. Gespeichert
   war es nie, aber protokolliert eben doch. Die Meldung nennt es jetzt nicht mehr; stattdessen
   hat die Schiedsrichter-Tabelle eine Spalte **Passwort**, die den Zustand zeigt und das
   Start-Passwort bei jedem Aufruf neu aus dem Namen rechnet. Für den Admin ist das sogar
   besser: er kann es jederzeit nachschlagen und nicht nur in der einen Sekunde nach dem
   Klick.

Bewusst so gebaut:

- **Keine Vorgaben zu Länge oder Zeichen (Regel 38).** So entschieden, die Schwäche ist bekannt
  und steht im Code. Geblieben sind zwei Mechaniken, die keine Komplexitätsregeln sind: leer
  geht nicht, und es muss sich vom bisherigen unterscheiden — sonst ließe sich der Zwang aus
  Regel 37 erfüllen, indem man dasselbe noch einmal eintippt.
- **Der Zwang sitzt in `requireUser`, nicht in jeder Seite.** Damit gilt er auch für jede
  künftige Seite und jede Server-Aktion, ohne dass jemand daran denken muss. Offen bleiben
  genau die Wege, die keinen angemeldeten Nutzer verlangen: die öffentliche Ansicht, die
  Passwortseite und das Abmelden.
- **Der Passwortzustand kommt aus der Datenbank, nicht aus dem Cookie.** Setzt ein Admin
  während einer laufenden Sitzung zurück, greift der Zwang beim nächsten Seitenaufruf — nicht
  erst beim nächsten Anmelden.
- **Jede Ablehnung sagt dasselbe und dauert gleich lang.** Falsche Nummer, falsches Passwort,
  stillgelegtes Konto, abgelaufenes Start-Passwort: derselbe Satz, und wo nichts zu prüfen
  ist, wird trotzdem gerechnet. Sonst wäre die Anmeldeseite ein Verzeichnis, mit dem sich
  prüfen ließe, wer im Verein pfeift.
- **Der Notzugang hat keine Frist.** Ein Notzugang, der nach ein paar Wochen stillschweigend
  abgelaufen ist, ist genau dann wertlos, wenn er gebraucht wird. Stattdessen gilt er einmal
  und lässt sich jederzeit widerrufen. Eingelöst setzt er das Konto auf das Start-Passwort
  zurück — derselbe Weg wie Regel 40. Es gibt also keinen zweiten Weg, ein Passwort zu setzen,
  den man absichern müsste.
- **Der Notzugang wird auf der Kommandozeile ausgestellt, nicht im Adminbereich.** Wer den
  Adminbereich erreicht, braucht keinen. Ein Knopf dafür wäre außerdem ein Knopf, mit dem sich
  ein übernommenes Adminkonto dauerhaft festsetzen ließe.
- **Die Beispieldaten bekommen ihr Passwort als *eigenes*, nicht als Start-Passwort.** Sonst
  stünde in der Entwicklung bei jeder Anmeldung der erzwungene Wechsel im Weg. Wie der
  aussieht, zeigt jedes neu angelegte Konto — das bekommt seinen Zwang über `createReferee`
  wie im Betrieb.

Offen, und zwar bewusst:

- **Das Start-Passwort ist erratbar.** Es folgt aus dem Namen, und im Verein kennt jeder jeden.
  Dagegen helfen nur die Frist aus Regel 36 und ein enges Limit auf Fehlversuche — acht in
  einer Viertelstunde. Das war die ausdrückliche Entscheidung; die Alternative wäre ein
  zufälliges Start-Passwort, das der Admin weitersagen müsste.
- **Der Weg über den Link ist abgeschaltet, nicht entfernt.** `LOGIN_MAGIC_LINK=an` schaltet
  ihn frei, sobald das Nachrichtenbudget es hergibt. Die Anmeldeseite, die Route für den Link
  und die Hilfsfunktionen der E2E-Suite bleiben dafür stehen.

---

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
