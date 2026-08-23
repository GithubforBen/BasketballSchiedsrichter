# Schiriplan

Schiedsrichter-Planung für die Basketball-Jugendabteilung der BG Nordstadt.

Zwei gleichwertige Schiedsrichter pro Spiel, zwei Ersatzplätze. Eintragen gilt sofort und
verbindlich — wer zuerst einträgt, hat den Platz. Nachrichten laufen über WhatsApp.

## Stand

Meilenstein 0 bis 2 sind fertig: Fundament, Datenmodell, die vollständige Regel-Engine, die
öffentliche Spieltagsansicht und die Anmeldung ohne Passwort. Der Schiedsrichter- und der
Adminbereich entstehen ab Meilenstein 3 — siehe [PLAN.md](PLAN.md).

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
| `npm run test:e2e` | E2E-Tests im Browser, Desktop und Handy |
| `npm run build` | Produktionsbuild |

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
