# Schiriplan

Schiedsrichter-Planung für die Basketball-Jugendabteilung der BG Nordstadt.

Zwei gleichwertige Schiedsrichter pro Spiel, zwei Ersatzplätze. Eintragen gilt sofort und
verbindlich — wer zuerst einträgt, hat den Platz. Angemeldet wird mit Telefonnummer und
Passwort. Nachrichten laufen über WhatsApp.

## Stand

Alle sechs Meilensteine sind fertig: Fundament, Datenmodell, die vollständige Regel-Engine, die
öffentliche Spieltagsansicht, die Anmeldung, der Schiedsrichter-Bereich, der
Adminbereich, der Nachrichtenversand und die Härtung — Barrierefreiheit nach WCAG 2.1 AA,
Datenschutz mit Lösch- und Auskunftskonzept, Fehlerseiten, Sicherungen und Healthcheck.

Danach kam die Anmeldung mit Passwort dazu (Regeln 34–43): Die Anmeldung per Link ist gebaut und
geprüft, steht aber voreingestellt zu — jeder Link kostet eine WhatsApp-Nachricht, und davon hat
der Verein 2000 im Monat. `LOGIN_MAGIC_LINK=an` schaltet sie wieder frei.

Danach kamen die Lizenzen und der neue Zuschnitt der Nachrichten dazu (Regeln 48–53): Jedes
Spiel verlangt eine Lizenz E oder D, jedes Konto trägt eine — oder keine, dann ist keine
Eintragung möglich. Gesehen wird der Spielplan trotzdem vollständig. Nachrichten sprechen mit
dem Vornamen an, die Admins bekommen offene Plätze als Tagesbilanz statt als Einzelnachricht,
und die Tagesübersicht stellt jeder Admin in seinem Profil ein: Zeitraum in Wochen (Standard 4)
und ob sie überhaupt kommt.

Der Versand läuft seitdem über **WhatsApp-Vorlagen** (`type: 'template'`) statt über freien
Text. Die Texte stehen in `src/notifications/templates.ts` mit `{{1}}`, `{{2}}` … und ihren
Werten; daraus entsteht der Vorlagen-Aufruf für WhatsApp und der Fließtext für E-Mail und
Vorschau. Was unter `/dev/outbox` steht, geht genau so raus.

Vor dem Echtbetrieb bleibt zu tun, was nur der Verein selbst kann: Impressum ausfüllen, die
Datenschutzerklärung juristisch prüfen lassen, die WhatsApp-Vorlagen bei Meta unter genau den
Namen aus [docs/whatsapp-vorlagen.md](docs/whatsapp-vorlagen.md) freigeben und die Zugangsdaten
setzen. Siehe [PLAN.md](PLAN.md).

## Loslegen

```bash
npm install
cp .env.example .env          # DATABASE_URL anpassen
npm run db:migrate            # Schema einspielen
npm run db:seed               # Beispieldaten aus dem Mockup
npm run dev
```

Der erste Admin entsteht nicht über den Seed, weil Konten sonst ausschließlich Admins anlegen:

```bash
npm run seed:admin -- --name "Nele Baumann" --initials NB --phone "0157 22067123"
```

Der Befehl nennt zum Schluss das Start-Passwort. Es ist der Name, klein und zusammengeschrieben
(`nelebaumann`), gilt vierzehn Tage und muss beim ersten Anmelden gegen ein eigenes getauscht
werden. Die Beispieldaten aus `db:seed` haben ihr Passwort nach derselben Regel — `jonaskeller`,
`lenabrandt`, `nelebaumann` —, dort aber gleich als eigenes gesetzt, damit in der Entwicklung
nicht bei jeder Anmeldung der erzwungene Wechsel im Weg steht.

## Anmeldung

| Fall | Weg |
| --- | --- |
| Gewöhnliche Anmeldung | Telefonnummer und Passwort auf `/anmelden`. Die Nummer darf in jeder Schreibweise stehen: `0151 …`, `+49 151 …`, `0049…`, mit Leerzeichen oder Schrägstrichen. |
| Neues Konto | Ein Admin legt es unter `/schiris` an; die Rückmeldung nennt das Start-Passwort. |
| Passwort vergessen | Ein Admin setzt es unter `/schiris` zurück — danach gilt wieder das Start-Passwort. |
| Passwort ändern | `/passwort`, verlinkt aus dem Profil. Keine Vorgaben zu Länge oder Zeichen; es muss sich nur vom bisherigen unterscheiden. |
| Kein Admin kommt mehr hinein | Notzugang, siehe unten. |

Gespeichert ist ausschließlich ein scrypt-Hash. Klartext gibt es nirgends — auch ein Admin kann
ein Passwort nicht lesen, nur zurücksetzen.

### Notzugang

Zurücksetzen kann nur ein Admin. Vergisst der einzige Admin sein Passwort, hilft nur ein Token,
der vorher ausgestellt wurde:

```bash
npm run notzugang -- --neu --telefon "0157 22067123" --notiz "Tresor Geschäftsstelle"
npm run notzugang -- --liste
npm run notzugang -- --widerrufen <id>
```

Der Token erscheint genau einmal — gespeichert ist nur eine Ableitung. Aufschreiben und dorthin
legen, wo der Vereinsschlüssel liegt. Eingelöst wird er unter `/notzugang`; er gilt einmal, setzt
das Konto auf das Start-Passwort zurück und verlangt sofort ein neues.

## Befehle

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsserver |
| `npm run check` | Typen, Lint und Tests in einem Rutsch |
| `npm test` | Regel-Engine; mit `TEST_DATABASE_URL` zusätzlich die Datenbank-Zusicherungen |
| `npm run db:generate` | Migration aus dem Schema erzeugen |
| `npm run notzugang` | Notzugänge für ausgesperrte Admins ausstellen, auflisten, widerrufen |
| `npm run test:e2e` | E2E-Tests im Browser, Desktop und Handy (braucht eine gefüllte `DATABASE_URL`) |
| `npm run build` | Produktionsbuild |
| `npm start` | Produktionsbuild starten (kopiert vorher die statischen Dateien — ohne das läuft der Server ohne Stylesheets, und zwar stumm) |

## Datenschutz

Was die Anwendung dafür tut, steht nicht nur in der Erklärung auf `/impressum`, sondern im Code:

- **Kein fremder Aufruf.** Schriften und alle weiteren Dateien kommen vom eigenen Server; ein
  E2E-Test verbietet jede Anfrage an eine fremde Herkunft und schlägt fehl, sobald eine
  hinzukommt.
- **Aufbewahrungsfristen** (`src/server/aufbewahrung.ts`) räumen Anmeldedaten, Zähler,
  versandte Nachrichten und das Prüfprotokoll ab. Der Nachrichtenlauf stößt das einmal täglich
  an. Die Fristen stehen an einer Stelle und werden auf der Datenschutzseite genau so genannt.
- **Löschkonzept**: Ein Admin löscht ein Konto samt Qualifikationen, Eintragungen — auch den
  vergangenen — Nachrück-Anfragen und wartenden Nachrichten. Wird dadurch ein künftiger
  Schiedsrichter-Platz frei, zählt die Aktion die Lücke hoch, damit der nächste Lauf ihn
  ausschreibt statt ihn still zu leeren. Wer nur aufhört und dessen Zahlen bleiben sollen, wird
  **stillgelegt**.
- **Auskunft**: Angemeldet lädt jede Person unter „Profil“ einen vollständigen Auszug herunter.
- **Protokoll ohne Personenbezug**: `src/server/log.ts` ist der einzige Weg ins Serverprotokoll
  und nimmt keine freien Texte an — auch keine Fehlermeldung, weil darin eine Telefonnummer aus
  einer Datenbankabfrage stecken kann.

## Barrierefreiheit

Jeder Bildschirm wird bei jedem E2E-Lauf gegen WCAG 2.1 AA geprüft, auf Desktop **und** Handy.
Dazu kommen Tastaturbedienung, Fokussichtbarkeit und die Sprungmarke zum Inhalt.

Die Farben aus dem Handoff halten den Kontrast für Text nicht durchgehend ein. Die Regel dafür
steht in `app.css`: **der Farbton bleibt, die Helligkeit gibt nach, sobald Schrift im Spiel
ist.** Punkte, Balken und Rahmen behalten die vollen Töne — sie tragen keinen Text und brauchen
nur 3:1.

## Nachrichten

Nichts geht direkt hinaus. Jede Nachricht entsteht als Zeile in der Outbox und wird von dort
zugestellt — das ist die Stelle, an der Doppelversand verhindert wird. Jede Zeile trägt einen
Schlüssel, der aus dem Anlass gebildet wird; derselbe Anlass ergibt denselben Schlüssel und
damit keine zweite Zeile. Ein doppelter Cron-Lauf, ein Neustart mitten im Versand oder zwei
gleichzeitige Prozesse bleiben deshalb folgenlos.

Den Takt gibt `POST /api/cron`, geschützt durch `CRON_SECRET`. `GET` auf denselben Pfad ist der
**Trockenlauf**: er zeigt, was ein Lauf verschicken würde, ohne dass etwas rausgeht. Im
Compose-Verbund ruft ein eigener Dienst den Endpunkt alle fünf Minuten im internen Netz auf.

`NOTIFICATION_CHANNEL` schaltet den Weg um:

| Wert | Wirkung |
| --- | --- |
| `dev` | Nichts geht hinaus. Alles steht unter `/dev/outbox`, mit demselben Text, der sonst rausginge. |
| `email` | Übergangskanal über `SMTP_URL`; `MAIL_TEST_RECIPIENT` lenkt alles auf ein Postfach. |
| `whatsapp` | Meta Cloud API über `WHATSAPP_PHONE_NUMBER_ID` und `WHATSAPP_ACCESS_TOKEN`. |

Für den WhatsApp-Kanal müssen die Nachrichtentexte vorab bei Meta als Vorlagen freigegeben sein.
Welche das sind, mit welchem Wortlaut und in welcher Kategorie, steht in
[docs/whatsapp-vorlagen.md](docs/whatsapp-vorlagen.md) — dort auch, was der Code dafür noch
braucht.

Drei Regeln gelten für **jede** Nachricht zu einem Spiel:

- **Datum und Vorlauf stehen immer beide drin.** „Sa 29.08.2026, 10:30 Uhr" sagt, welches Spiel
  gemeint ist, „Anpfiff in 3 Tagen" sagt, wie eilig es ist. Das gilt auch für jede Zeile der
  Tagesübersicht an die Admins.
- **Kein Hinweis auf einen möglichen Nachfolger.** Kein „sonst besetzen wir den Platz neu", kein
  „sonst fragen wir den nächsten Ersatz". Wer liest, dass sich ohnehin jemand findet, sagt eher
  ab; was ohne Antwort passiert, ist Sache der Anwendung und nicht der Nachricht.
- **Wer antworten soll, bekommt einen eindeutigen Link.** Jede Bitte um eine Bestätigung, jede
  Nachrück-Anfrage und jede Verschiebung trägt ihre eigene Adresse
  `…/antwort/<Token>`. Im signierten Token stecken Vorgang, Spiel, Person und der Schlüssel der
  Nachricht; er gilt bis zum Anpfiff. Die Seite dahinter beantwortet genau diese eine Frage und
  sagt beim zweiten Öffnen, dass genau dieses Spiel schon bestätigt ist. Der Aufbau ist zugleich
  das, was ein **dynamischer URL-Knopf** bei Meta verlangt: genau eine Variable, und nur am Ende
  der Adresse.

Zwei Nachrichten schaltet der Adminbereich unter *Einstellungen*:

| Schalter | Wirkung |
| --- | --- |
| **Quittung nach dem Eintragen** | Vorlage 2. Aus heißt: keine Nachricht nach der eigenen Eintragung — der Bildschirm quittiert sie ohnehin. |
| **Offene Plätze ausschreiben an** | Vorlage 6. `alle Qualifizierten` (in Rotationsreihenfolge), `nur die Admins` (eigene Vorlage, sie besetzen den Platz von Hand) oder `aus` (die Lücke steht nur in Übersicht und Meldungen). |

Der Schalter *Automatische Nachfrage* steuert davon unabhängig nur die **Wiederholungen** der
Ausschreibung 14, 7, 3 und 1 Tag vor Anpfiff.

Jede Nachricht kostet den Verein Geld (Regel 33). Deshalb gilt: aussichtslose Fehler — eine
Nummer ohne WhatsApp, eine abgelehnte Vorlage — werden nicht wiederholt, vorübergehende mit
wachsendem Abstand bis zu fünfmal. Ein Lauf verschickt höchstens 200 Nachrichten, ein
Kalendertag höchstens 1000 Einheiten.

Zwei Seiten helfen bei der Entwicklung und sind im Produktionsbetrieb nicht erreichbar:
`/dev/ui` zeigt alle Bausteine nebeneinander für den Abgleich gegen das Design-System, und
`/dev/outbox` zeigt jede Nachricht, die die Anwendung verschicken würde — im Kanal `dev` geht
nichts hinaus, der Anmeldelink ist dort anklickbar.

## Aufbau

| Ordner | Inhalt |
| --- | --- |
| `src/domain/` | Die Fachregeln als reine Funktionen. Kennt weder Datenbank noch Oberfläche. |
| `src/db/` | Schema, Migrationen, Seed |
| `src/server/` | Sitzungen, Anmeldung, Rate-Limits, Datenzugriffe |
| `src/notifications/` | Versandkanäle und Nachrichtentexte |
| `src/components/` | Bausteine des Design-Systems und das Grundraster |
| `e2e/` | Browser-Tests gegen den Produktionsbuild |
| `src/styles/` | `modernist.css` unverändert aus dem Handoff, `app.css` darüber |
| `design/` | Der Handoff aus Claude Design: Mockup, Briefing-Historie, Design-System |

Die verbindlichen Fachregeln stehen in [PLAN.md](PLAN.md) Abschnitt 2 und sind im Code
sowie in den Testnamen mit ihrer Nummer belegt.

## Betrieb

Docker Compose startet App, Datenbank und den Cloudflare Tunnel. Nach außen ist kein Port
offen — der Zugriff läuft ausschließlich über den Tunnel.

```bash
docker compose up -d
```

Fünf Dienste laufen im Verbund:

| Dienst | Aufgabe |
| --- | --- |
| `db` | PostgreSQL, Daten auf einem benannten Volume |
| `app` | die Anwendung, nur im Compose-Netz erreichbar |
| `cron` | ruft alle fünf Minuten den Nachrichtenlauf auf — im internen Netz, nicht über den Tunnel, damit ein Ausfall bei Cloudflare die Erinnerungen nicht mitnimmt |
| `backup` | sichert die Datenbank täglich nach `./sicherungen/`, hält 14 Stände |
| `tunnel` | Cloudflare Tunnel; der einzige Weg von außen |

### Ist alles gesund?

```bash
docker compose ps                  # der Healthcheck der App steht in der Spalte STATUS
docker compose logs -f cron        # jeder Lauf, der etwas getan hat
docker compose logs backup | tail  # die letzte Sicherung
```

Der Healthcheck unter `/api/gesundheit` fragt die Datenbank mit an: ein Prozess, der läuft, aber
die Datenbank nicht erreicht, kann nichts ausliefern und gilt deshalb auch nicht als gesund.

### Eine Sicherung zurückspielen

```bash
gunzip -c sicherungen/schiriplan-2026-08-24.sql.gz \
  | docker compose exec -T db psql -U schiriplan -d schiriplan
```

Die Sicherungen enthalten Namen und Telefonnummern. Sie liegen in `.gitignore` und gehören
verschlüsselt aufbewahrt, wenn sie den Server verlassen.
