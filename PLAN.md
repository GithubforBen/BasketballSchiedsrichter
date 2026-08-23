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

### M0 + M1 — Fundament, Datenmodell, Regel-Engine

- Next.js-Scaffold, TypeScript strict, Ordnerstruktur, Docker Compose (App + Postgres), `.env.example`
- Modernist-Tokens als Basis-Stylesheet, App-Shell: Desktop-Sidebar und Mobile-Tabs
- Primitives: Button, Tag, Input, Field, Seg, Table, Toggle, Hr, StatusDot, Avatar-Kürzel
- Komponenten-Galerie unter `/dev/ui` zum Abgleich gegen das Design-System
- Schema: `user`, `qualification`, `league`, `game`, `assignment`, `confirmation`, `reminder`, `notification_outbox`, `setting`, `audit_log`, `login_token`
- Regel-Engine als reine Funktionen ohne DB-Zugriff — alle 33 Regeln aus Abschnitt 2
- Seed mit den Mockup-Daten (5 Spieltage, 8 Spiele, 6 Personen, Qualifikationsmatrix)
- Lint inkl. Design-System-Adherence, Vitest, GitHub Actions

**Review-Fokus**: Keine Hex-Werte und keine rohen Pixelwerte außerhalb der Tokens · kein Border-Radius · Button-Labels linksbündig · Fokusring 2px Akzent · jede Regel aus Abschnitt 2 hat mindestens einen Test inkl. Grenzfall (genau 21 Tage, genau 3 Tage, genau 10 Erinnerungen).

### M2 — Öffentliche Ansicht und Anmeldung

- Öffentliche Spieltagsansicht, serverseitig gerendert, ohne personenbezogene Daten außer Kürzel
- Login: Telefonnummer → Token erzeugen → Versand über Kanal-Adapter (Dev: Outbox-Ansicht)
- Magic-Link **und** 6-stelliger Code, Link 15 Minuten gültig, Einmalverwendung, Rate-Limit
- Session-Cookie HTTP-only, 30 Tage, Rollen-Guard für alle Routen
- „Zuletzt geöffneter Screen" nach dem Login
- Regeln-Seite, Impressum & Datenschutz
- Seed-Kommando für den ersten Admin

**Review-Fokus**: Ohne Login taucht in **keiner** Antwort ein Name oder eine Telefonnummer auf — geprüft über die ausgelieferte HTML- und JSON-Nutzlast, nicht nur visuell. Tokens sind einmalig, zeitlich begrenzt und nicht erratbar. Cloudflare-Tunnel-Header korrekt ausgewertet, damit Rate-Limits nicht alle Nutzer als eine IP sehen.

### M3 — Schiedsrichter-Bereich

- Offene Spiele mit Tagesnavigation, Wischgeste, Tastaturbedienung
- Eintragen / Austragen / Als Ersatz eintragen — transaktionssicher
- Pflichtbestätigung mit Zustandsanzeige
- Verschiebungs-Banner mit „Bleibe dabei" / „Absagen"
- Kalender & Verlauf, Monatsstatistik, Ranking
- Profil & Erinnerungen inkl. Kostenrückfrage und Limits

**Review-Fokus**: Nebenläufigkeitstest — zwei parallele Eintragungen auf denselben Platz, genau eine gewinnt, die andere bekommt eine verständliche Meldung. Alle Sperrgründe erzeugen eine erklärende Meldung statt eines toten Knopfs.

### M4 — Admin-Bereich

- Spielübersicht mit KPI-Zeile, Meldungsliste mit Aktionen
- Spiele anlegen einzeln, CSV-Import mit Vorschau und Duplikaterkennung
- Spiel bearbeiten: verschieben, Halle ändern, absagen, Overrides, Besetzung entfernen
- Schiedsrichter-Verwaltung mit Qualifikationsmatrix
- Einstellungen: Regeln, Pflichtbestätigung, Fristen, Admin-Meldungen, Ligen
- Neuer Screen „Spiele nachpflegen" für Regel 27

**Review-Fokus**: Jede Admin-Aktion erzeugt die richtigen Nachrichten **und** einen Audit-Eintrag. Entfernen eines Schiris stößt die Nachrück-Kaskade korrekt an. CSV-Import ist idempotent.

### M5 — Nachrichten und Hintergrundjobs

- Kanal-Adapter: WhatsApp Cloud API, E-Mail, Dev-Outbox — per Config umschaltbar
- Nachrichtentexte als Templates, WhatsApp-Template-Struktur berücksichtigt
- Scheduler für alle Auslöser: persönliche Erinnerungen, Pflichtbestätigung, 24-h-Nachfassen, Nachrück-Fristen, Auto-Nachfrage bei offenen Spielen, tägliche Zusammenfassung
- Outbox mit Retry, Idempotenzschlüssel, Zustellstatus und Kostenzähler
- Rotation als Anschreib-Reihenfolge (Regel 19)

**Review-Fokus**: Keine Doppelversendung bei Neustart oder doppeltem Cron-Lauf. Limits greifen. Alles im Trockenlauf testbar, ohne echte Nachrichten.

### M6 — Härtung und Abnahme

- Barrierefreiheit: Tastaturbedienung, Kontraste, Fokusreihenfolge, Screenreader-Beschriftungen
- Responsive-Feinschliff gegen beide Artboards, Screen für Screen
- Rate-Limits, Fehlerseiten, Logging ohne personenbezogene Daten
- Datenschutz: Löschkonzept, Aufbewahrungsfristen, Auskunftsfähigkeit
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
