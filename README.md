# Schiriplan

Schiedsrichter-Planung für die Basketball-Jugendabteilung der BG Nordstadt.

Zwei gleichwertige Schiedsrichter pro Spiel, zwei Ersatzplätze. Eintragen gilt sofort und
verbindlich — wer zuerst einträgt, hat den Platz. Nachrichten laufen über WhatsApp.

## Stand

Meilenstein 0 und 1 sind fertig: Fundament, Datenmodell und die vollständige Regel-Engine
mit Tests. Die Bildschirme entstehen ab Meilenstein 2 — siehe [PLAN.md](PLAN.md).

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
| `npm run build` | Produktionsbuild |

`/dev/ui` zeigt alle Bausteine nebeneinander — der Abgleich gegen das Design-System.
Die Seite ist im Produktionsbetrieb nicht erreichbar.

## Aufbau

| Ordner | Inhalt |
| --- | --- |
| `src/domain/` | Die Fachregeln als reine Funktionen. Kennt weder Datenbank noch Oberfläche. |
| `src/db/` | Schema, Migrationen, Seed |
| `src/components/` | Bausteine des Design-Systems und das Grundraster |
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
