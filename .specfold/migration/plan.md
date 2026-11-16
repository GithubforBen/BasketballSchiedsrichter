# Migration plan: BasketballSchiedsrichter (Schiriplan)

## Repository

- Default branch: main. This migration branches from `dev` (commit 0109ff9) and its PR targets `dev`, because `main` is what production pulls.
- Stack: Node.js, TypeScript (Next.js App Router, Drizzle/PostgreSQL)
- Layout: single package
- CI: GitHub Actions (`.github/workflows/ci.yml`)
- Source globs: `src/**`
- Agent tools: agents, claude
- Profile: full
- Language: concepts are written in German, like the repository's docs and UI. Code identifiers stay English.

## Capability domains

- Besetzung: Plätze eintragen/austragen, Ersatz, Nachrück-Kaskade, Verschiebung, Lizenzen
- Fristen und Bestätigung: Austrage- und Ersatzfristen, Pflichtbestätigung, Erinnerungen, Eskalation an Admins
- Konten und Anmeldung: Passwort-Login, Magic-Link (abgeschaltet), Notzugang, Telefonnummern
- Nachrichten: WhatsApp-Vorlagen, Outbox, Rotation, Admin-Meldungen und Tagesübersicht
- Verwaltung: Spiele, CSV-Import/-Export, Ligen, Statistik
- Datenschutz und Betrieb: Sichtbarkeit, Löschkonzept, Sicherungen, Heimserver-Betrieb

## Mapping

| Source | Becomes | Target | Note |
| --- | --- | --- | --- |
| README.md | keep | | entry point for humans |
| design/_ds/modernist-…/readme.md | keep | | design-system docs, read by the design tooling; one `Reference` concept points at it |
| docs/datenschutzerklaerung.md | keep | | legal text for the public page; one `Reference` concept points at it |
| docs/verarbeitete-daten.md | Data Flow | knowledge/architecture/verarbeitete-daten.md | which table holds which personal data, and who receives it |
| docs/whatsapp-vorlagen.md | Runbook + Reference | knowledge/runbooks/whatsapp-vorlagen-anlegen.md, knowledge/reference/whatsapp-vorlagen.md | how to set up templates at Meta; the list of the 12 templates and when each is sent |
| PLAN.md §1 Entscheidungen | Decision | knowledge/decisions/ (one per row: Framework, Styling, Datenbank, Hosting, Nachrichtenkanal, Login, Mandanten, Sprache, Öffentliche Ansicht, Tests) | not in the inventory, proposed. Rows that changed later (Hosting: VPS → home server; Login: passwordless → password) are recorded as their current state, with the original as the reason |
| PLAN.md §2 Fachlogik (Regeln 1–53) | Business Rule | knowledge/domain/ (one concept per sub-heading: Besetzung, Fristen, Pflichtbestätigung, Ausfall und Nachrücken, Verschiebung, Rotation, Erinnerungen, Statistik, Sichtbarkeit, Nachrichten an Schiris, Anmeldung mit Passwort, Telefonnummern, Nachrichten allgemein, Lizenzen, Statusfarben) | not in the inventory, proposed. About 15 concepts that summarize and keep the rule numbers; PLAN.md stays the full text |
| PLAN.md §3 Screens, §4 Meilensteine | keep | | history of the build; stays in PLAN.md |
| TODO.md | Backlog Item | knowledge/backlog/ (one per open item: Cloudflare-Tunnel Port 7844, fehlende WhatsApp-Vorlagen, Zeitgeber ohne Sitzung, PUBLIC_BASE_URL) | not in the inventory, proposed. Done items (3b, 3c) are skipped |

## Team rules

No AGENTS.md or CLAUDE.md is tracked in the repository, so there are no team rules to map.

## Commitments

none

## Seed from code

- Cap: 30 concepts (Business Rules and Decisions from PLAN.md come on top, since they are converted, not seeded)
- From: `src/**` — Components for `src/domain`, `src/server`, `src/notifications`, `src/db`, `src/app`, `src/cli`; Interfaces for the API routes and CLI commands; Terms for Spiel, Platz, Ersatz, Nachrücken, Pflichtbestätigung, Lizenz, Liga, Outbox

## Gate

- This PR is the adoption PR: G4 is skipped, every other rule runs.
- From the next PR on, source changes need an OpenSpec change (G4).

## Open questions

none yet. Rule for the conversion: where a doc says one thing and the code does another, the user is asked, always with the option "skip". A skipped conflict is not decided: the concept keeps the doc's statement, is flagged in its body as unchecked against the code, and the question is listed under "Offene Widersprüche" in the report so it can be answered later.

## Approval

approved_by: human:GithubforBen
approved_at: 2026-11-16T12:06:05+01:00
