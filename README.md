# Schiriplan

Schiedsrichter-Planung für die Basketball-Jugendabteilung der BG Nordstadt.

Zwei gleichwertige Schiedsrichter pro Spiel, zwei Ersatzplätze. Eintragen gilt sofort und
verbindlich — wer zuerst einträgt, hat den Platz. Nachrichten laufen über WhatsApp.

## Stand

Meilenstein 0 bis 5 sind fertig: Fundament, Datenmodell, die vollständige Regel-Engine, die
öffentliche Spieltagsansicht, die Anmeldung ohne Passwort, der Schiedsrichter-Bereich, der
Adminbereich und der Nachrichtenversand — WhatsApp Cloud API, E-Mail als Übergangskanal, der
Zeitplan für Erinnerungen, Pflichtbestätigung, Nachrück-Fristen und Ausschreibungen, dazu eine
Outbox mit Wiederholung und Kostenzähler.

Was noch fehlt: Barrierefreiheit, Datenschutz und die Abnahme — Meilenstein 6, siehe
[PLAN.md](PLAN.md).

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
npm run seed:admin -- --name "Nele Baumann" --initials NB --phone "+4915722067"
```

## Befehle

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsserver |
| `npm run check` | Typen, Lint und Tests in einem Rutsch |
| `npm test` | Regel-Engine; mit `TEST_DATABASE_URL` zusätzlich die Datenbank-Zusicherungen |
| `npm run db:generate` | Migration aus dem Schema erzeugen |
| `npm run test:e2e` | E2E-Tests im Browser, Desktop und Handy (braucht eine gefüllte `DATABASE_URL`) |
| `npm run build` | Produktionsbuild |

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

Die 33 verbindlichen Fachregeln stehen in [PLAN.md](PLAN.md) Abschnitt 2 und sind im Code
sowie in den Testnamen mit ihrer Nummer belegt.

## Betrieb

Docker Compose startet App, Datenbank und den Cloudflare Tunnel. Nach außen ist kein Port
offen — der Zugriff läuft ausschließlich über den Tunnel.

```bash
docker compose up -d
```

Neben App, Datenbank und Tunnel läuft ein vierter Dienst: der Zeitgeber, der den Cron-Endpunkt
im internen Netz aufruft. Er geht bewusst nicht über den Tunnel — ein Ausfall bei Cloudflare
soll die Erinnerungen nicht mitnehmen.
