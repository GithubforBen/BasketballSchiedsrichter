# Migration report: BasketballSchiedsrichter (Schiriplan)

## Result

- Branch: specfold/migration (from `dev` at 0109ff9 — not from the default branch `main`, by the user's choice: `main` is what production pulls, so the PR targets `dev`)
- Kit: 0.7.0 from release tag v0.7.0 (template tarball, SHA-256 checked)
- Concepts written: 55 (12 Decision, 17 Business Rule, 9 Term, 7 Component, 4 Interface, 1 Data Flow, 1 Runbook, 3 Reference, 1 Backlog Item), all draft
- Seeded from code: 20 of the cap 30 (7 Component, 4 Interface, 9 Term)
- Checks: specfold validate, specfold index --check and openspec validate --strict pass (no specs or changes exist yet)
- Always loaded: 2366 tokens (estimate from specfold stats); budgets exceeded: none

## Needs human verification

- knowledge/architecture/antwortlinks.md (from src/notifications/action-links.ts, src/server/answers.ts)
- knowledge/architecture/betriebsverbund.md (from docker-compose.yml)
- knowledge/architecture/cli.md (from src/cli/notzugang.ts)
- knowledge/architecture/cron-endpunkt.md (from src/app/api/cron/route.ts)
- knowledge/architecture/csv-import-export.md (from src/domain/csv.ts, src/domain/csv-export.ts)
- knowledge/architecture/datenbank.md (from src/db/schema.ts)
- knowledge/architecture/kalenderdatei.md (from src/domain/ics.ts)
- knowledge/architecture/nachrichtenversand.md (from src/notifications/templates.ts, src/notifications/channel.ts)
- knowledge/architecture/oberflaeche.md (from src/routes.ts)
- knowledge/architecture/regel-engine.md (from src/domain/index.ts)
- knowledge/architecture/server.md (from src/server/guard.ts)
- knowledge/architecture/verarbeitete-daten.md (from docs/verarbeitete-daten.md, src/db/schema.ts)
- knowledge/backlog/whatsapp-vorlagen-bei-meta-pruefen.md (from TODO.md, src/notifications/templates.ts)
- knowledge/decisions/anmeldung-mit-passwort.md (from PLAN.md, PLAN.md, src/server/auth/login.ts)
- knowledge/decisions/datenbank-postgres-drizzle.md (from PLAN.md, src/db/schema.ts)
- knowledge/decisions/deutsch-ohne-i18n.md (from PLAN.md)
- knowledge/decisions/ein-verein-ohne-mandanten.md (from PLAN.md, src/config/club.ts)
- knowledge/decisions/erster-admin-per-befehl.md (from PLAN.md, README.md, src/db/seed-admin.ts)
- knowledge/decisions/framework-nextjs.md (from PLAN.md, package.json)
- knowledge/decisions/hosting-heimserver-cloudflare-tunnel.md (from PLAN.md, docker-compose.yml)
- knowledge/decisions/ligen-vorbelegt.md (from PLAN.md, src/config/club.ts)
- knowledge/decisions/oeffentliche-ansicht-ohne-login.md (from PLAN.md, src/domain/visibility.ts)
- knowledge/decisions/styling-plain-css-modernist.md (from PLAN.md, design/_ds/modernist-11ee9c05-7e12-42a8-8930-b005628d2360/readme.md)
- knowledge/decisions/teststrategie.md (from PLAN.md, vitest.config.ts, playwright.config.ts)
- knowledge/decisions/whatsapp-mit-email-kanal.md (from PLAN.md, src/notifications/channel.ts)
- knowledge/domain/ausfall-und-nachruecken.md (from PLAN.md, src/domain/escalation.ts)
- knowledge/domain/ausschreibung.md (from PLAN.md, src/db/schema.ts)
- knowledge/domain/besetzung.md (from PLAN.md, src/domain/rules.ts)
- knowledge/domain/ersatz.md (from PLAN.md, src/domain/slots.ts)
- knowledge/domain/fristen.md (from PLAN.md, src/domain/rules.ts)
- knowledge/domain/kuerzel.md (from src/domain/visibility.ts)
- knowledge/domain/lizenzen.md (from PLAN.md, src/domain/license.ts)
- knowledge/domain/nachrichten-sparsamkeit.md (from PLAN.md, src/domain/notifications.ts)
- knowledge/domain/nachrichten-wortlaut.md (from PLAN.md, src/notifications/templates.ts, src/notifications/action-links.ts)
- knowledge/domain/nachruecken.md (from src/domain/escalation.ts)
- knowledge/domain/notzugang.md (from PLAN.md, src/cli/notzugang.ts)
- knowledge/domain/outbox.md (from src/server/outbox.ts)
- knowledge/domain/passwort-anmeldung.md (from PLAN.md, src/domain/password.ts)
- knowledge/domain/persoenliche-erinnerungen.md (from PLAN.md, src/domain/reminders.ts)
- knowledge/domain/pflichtbestaetigung-begriff.md (from src/domain/confirmation.ts)
- knowledge/domain/pflichtbestaetigung.md (from PLAN.md, src/domain/confirmation.ts)
- knowledge/domain/platz.md (from src/domain/slots.ts)
- knowledge/domain/qualifikation-und-lizenz.md (from src/domain/rules.ts, src/domain/license.ts)
- knowledge/domain/rotation-und-admin-meldungen.md (from PLAN.md, src/domain/rotation.ts, src/domain/alerts.ts)
- knowledge/domain/sichtbarkeit.md (from PLAN.md, src/domain/visibility.ts)
- knowledge/domain/statistik.md (from PLAN.md, src/domain/stats.ts)
- knowledge/domain/statusfarben.md (from PLAN.md, src/domain/status.ts)
- knowledge/domain/tagesbilanz-admins.md (from PLAN.md, src/server/tagesuebersicht.ts)
- knowledge/domain/telefonnummern.md (from PLAN.md, src/domain/phone.ts)
- knowledge/domain/verschiebung.md (from PLAN.md, src/domain/relocation.ts)
- knowledge/domain/vorlauf.md (from src/domain/time.ts)
- knowledge/references/datenschutzerklaerung.md (from docs/datenschutzerklaerung.md)
- knowledge/references/modernist-design-system.md (from design/_ds/modernist-11ee9c05-7e12-42a8-8930-b005628d2360/readme.md)
- knowledge/references/whatsapp-vorlagen.md (from docs/whatsapp-vorlagen.md, src/notifications/templates.ts)
- knowledge/runbooks/whatsapp-vorlagen-anlegen.md (from docs/whatsapp-vorlagen.md, TODO.md)

## Install conflicts

none

## Migration candidates

none

## Rationale comments in code

Doc comments of ten or more lines in `src/` (tests excluded). Most explain *why* a rule or mechanism is built the way it is; a later change can move them into knowledge with `sf-capture` and leave a `see knowledge:` pointer. The migration moved none of them.

- src/app/anmelden/link/route.ts:8
- src/app/anmelden/link/route.ts:8
- src/app/antwort/[token]/page.tsx:15
- src/app/antwort/[token]/page.tsx:127
- src/app/api/cron/route.ts:6
- src/app/api/export/kalender/route.ts:9
- src/app/api/export/spielplan/route.ts:7
- src/app/api/gesundheit/route.ts:5
- src/app/bearbeiten/actions.ts:47
- src/app/error.tsx:5
- src/app/global-error.tsx:5
- src/app/impressum/page.tsx:11
- src/app/kalender/page.tsx:20
- src/app/meldungen/page.tsx:15
- src/app/nachrichten/page.tsx:12
- src/app/page.tsx:17
- src/app/page.tsx:62
- src/app/schiris/actions.ts:105
- src/cli/namen-zusammenfuehren.ts:1
- src/cli/notzugang.ts:10
- src/cli/vorlagen-anlegen.ts:1
- src/cli/vorlagen-reparieren.ts:1
- src/components/admin/CsvImport.tsx:8
- src/components/admin/RefereeCsvImport.tsx:15
- src/components/auth/PasswordField.tsx:6
- src/components/calendar/CalendarExport.tsx:7
- src/components/calendar/OwnGameActions.tsx:7
- src/components/games/GameEntry.tsx:10
- src/components/shell/Shell.tsx:7
- src/config/legal.ts:1
- src/db/index.ts:95
- src/db/schema.ts:81
- src/db/schema.ts:185
- src/db/schema.ts:333
- src/db/seed-data.ts:4
- src/db/seed.ts:47
- src/domain/csv-export.ts:6
- src/domain/csv.ts:200
- src/domain/ics.ts:6
- src/domain/league.ts:39
- src/domain/license.ts:3
- src/domain/name.ts:1
- src/domain/name.ts:81
- src/domain/notifications.ts:137
- src/domain/notifications.ts:161
- src/domain/password.ts:15
- src/domain/password.ts:80
- src/domain/phone.ts:16
- src/domain/phone.ts:102
- src/domain/referee-csv.ts:7
- src/domain/referee-csv.ts:110
- src/domain/referee-csv.ts:298
- src/domain/rules.ts:214
- src/domain/rules.ts:244
- src/domain/scheduler.ts:20
- src/domain/scheduler.ts:336
- src/domain/scheduler.ts:389
- src/domain/scheduler.ts:453
- src/domain/scheduler.ts:495
- src/domain/scheduler.ts:536
- src/domain/stats.ts:12
- src/domain/types.ts:139
- src/notifications/action-links.ts:6
- src/notifications/action-links.ts:103
- src/notifications/channel.ts:130
- src/notifications/channel.ts:191
- src/notifications/templates.ts:10
- src/server/admin/games.ts:341
- src/server/admin/games.ts:407
- src/server/admin/games.ts:600
- src/server/admin/games.ts:647
- src/server/admin/referees.ts:306
- src/server/admin/referees.ts:428
- src/server/answers.ts:20
- src/server/assignments.ts:276
- src/server/assignments.ts:499
- src/server/assignments.ts:659
- src/server/aufbewahrung.ts:6
- src/server/auskunft.ts:10
- src/server/auskunft.ts:38
- src/server/auth/hash.ts:5
- src/server/auth/hash.ts:63
- src/server/auth/login.ts:20
- src/server/auth/password-login.ts:24
- src/server/auth/password-login.ts:148
- src/server/auth/recovery.ts:16
- src/server/client-ip.ts:3
- src/server/env.ts:17
- src/server/guard.ts:4
- src/server/http.ts:4
- src/server/log.ts:3
- src/server/outbox.ts:16
- src/server/outbox.ts:54
- src/server/queries/admin-view.ts:33
- src/server/queries/games.ts:52
- src/server/queries/leagues.ts:4
- src/server/queries/protokoll.ts:7
- src/server/rate-limit.ts:1
- src/server/scheduler.ts:136
- src/server/viewer.ts:8

## Existing bundle

none

## References rewritten

none

## Deviations

- **Base branch:** `migrate start` only starts from the default branch `main`. The user chose to branch `specfold/migration` from `dev` instead and to open the PR into `dev`.
- **Uncommitted file:** `installClaudflared.sh` was committed on `dev` (0109ff9) with the user's approval, so the tree was clean for `migrate start`.
- **Folder name:** the plan says `knowledge/reference/`; the kit's folder is `knowledge/references/`, which is used.
- **TODO.md:** the plan proposed four backlog items. After asking the user, three were dropped as done (Cloudflare tunnel works on the home server, the `cron` service in `docker-compose.yml` replaces the session-bound timer, `PUBLIC_BASE_URL` is solved); one remains, see Open questions.
- **Doc vs code conflicts**, decided by the user in favour of the code (the plan's rule: ask, always with "skip"):
  - Licenses: `PLAN.md` rules 51–53 know E and D; the code also has C, the highest. `domain/lizenzen.md` describes E, D, C.
  - Statistics: `PLAN.md` rule 27 and the screen list have a per-game correction ("Spiele nachpflegen"); the code removed it, and the lineup at kickoff counts. `domain/statistik.md` describes the code.
  - Default leagues: `PLAN.md` §1 names U14/U16/U18/Erwachsene/Senioren; the code presets U10–U18 and Senioren. `decisions/ligen-vorbelegt.md` describes the code.
- **Decisions written as current state** (as the plan said): Hosting (home server instead of VPS), Login (password instead of passwordless).

## Left out

- `README.md`, `design/_ds/…/readme.md`, `docs/datenschutzerklaerung.md`: keep (the latter two also got a `Reference` concept pointing at them)
- `PLAN.md` §3 Screens and §4 Meilensteine: keep, build history
- Done items in `TODO.md` (3b, 3c and the three answered as done)
- Seed candidates beyond what was written: pages under `src/app/` one by one, `src/server/auth/` as its own component, `/api/export` and `/api/gesundheit` as interfaces, the terms Liga, Spieltag, Notruf, Quittung

## Open questions

Skipped by the user during the migration, to be answered later:

- **WhatsApp templates at Meta** (`backlog/whatsapp-vorlagen-bei-meta-pruefen.md`): `TODO.md` (as of 2026-09-07) says `schiriplan_termin_geaendert` and `schiriplan_erinnerung` were missing at Meta. The code still sends both (game moved, personal reminders). Are they approved now? Check with `src/cli/vorlagen-test.ts`.

Stale text outside the bundle was brought up to date in this PR at the user's request: `PLAN.md` (Hosting, Login, leagues, rule 27, rules 51–52, screens), `TODO.md` (done items removed, the open template question restated) and two factual "VPS" comments in `docker-compose.yml`. Conditional "on a VPS …" advice in `README.md`, `einrichten.sh` and `docker-compose.yml` stays, and so do the milestone notes in `PLAN.md` §4, which are history.
