# Design

## Context

See proposal.md (Why) and specs/schiri-quittung/spec.md (behavior). Relevant current state:

- `assignments` has primary key `(game_id, slot_index)` and a unique index `(game_id, referee_id)`. A promotion from substitute to referee updates `slot_index` in place, so the pair `(game_id, referee_id)` is stable while a person stays on a game. Deleting a game or a referee cascades to assignments.
- Own games, upcoming and past, are listed in `src/app/kalender/page.tsx` (cards on mobile, table from 768 px). The profile (`src/app/profil`) already offers the Art. 15 download as a route handler. Leagues and club settings are edited in `src/app/einstellungen`, single games in `src/app/bearbeiten`.
- File downloads are route handlers under `src/app/api/export/` with `requireUser` and `Cache-Control: no-store`, because a server action cannot return a file.
- No PDF tooling exists; the app has no money values so far.

## Goals / Non-Goals

**Goals:**

- Money stored as integer cents, never floats.
- Rates and fees resolvable "as of kickoff" with a single query per receipt.
- Receipt generation as a pure function from a view model, so the amounts are unit-tested without a PDF and the PDF is tested without a database.

**Non-Goals:**

- Pixel-exact copy of the 2015 Excel export; the layout follows its structure (header, two referee columns plus overall total, handwriting lines).
- Editing the PDF in the browser or storing generated PDFs.

## Decisions

### D1 Expenses in their own table, keyed to the assignment

`assignment_expenses(game_id, referee_id, travel_mode, km, per_diem_cents, other_cents, other_label, updated_at, updated_by)`, primary key `(game_id, referee_id)`, composite foreign key to `assignments(game_id, referee_id)` with `ON DELETE CASCADE`. All value columns nullable (blank = unknown).

- Cascade removes the expenses when someone leaves the game, which keeps data minimal and matches the deletion concept.
- Promotion keeps the row, because `(game_id, referee_id)` does not change.
- Alternative: columns on `assignments`. Rejected: the hot table for first-come-first-served stays narrow, and expense writes do not touch the row the slot rules lock.

### D2 Rate and fee history as append-only tables

- `km_rates(valid_from timestamptz PK, solo_cents int, shared_cents int)`: rates in cents per km (30 and 32). No row means the defaults from code apply.
- `league_fees(league_id, valid_from, fee_cents int NULL)`, primary key `(league_id, valid_from)`; `NULL` means "cleared". The first row of a league is stored with `valid_from = '-infinity'` so it applies to earlier games (spec: first fee applies to earlier games).
- Lookup: the row with the greatest `valid_from <= kickoff`.
- Alternative: snapshot rate and fee onto the expense row when saved. Rejected: the fee belongs to the game, not to an expense entry, and a referee who never enters kilometres would get no fee frozen.

### D3 Pure domain module for amounts

`src/domain/receipt.ts` builds a `ReceiptView` from game data, up to two `{ name, expenses }` columns, the resolved rate pair and fee. It computes travel (`km * rate`, "rode along" = 0), per-referee totals (missing = 0) and the overall total, and formats euros as German text (`8,00`). A column with no referee has all fields `null`. `src/domain/receipt-period.ts` computes the default period (last full month in the club time zone) and validates a range.

### D4 PDF with `pdf-lib`, standard Helvetica, embedded PNG logo

`src/server/receipt-pdf.ts` renders one A4 page per `ReceiptView` with `pdf-lib`. Helvetica (WinAnsi) covers ä, ö, ü, ß and the euro sign, so no font embedding is needed. The logo is the PNG supplied by the user, kept as a base64 constant in `src/server/receipt-logo.ts`. That avoids file reads at runtime, which are fragile under the Next.js standalone output in the Docker image.

- Alternative: a print view in the browser. Rejected by the user (Q3): saving a print view as PDF on a phone is clumsy.
- Alternative: filling the original PDF. Rejected: the template is an Excel conversion without form fields, and its logo is misplaced.

### D5 Two route handlers

- `GET /api/export/quittung?spiel=<id>`: the receipt of one game. It answers 404 unless the session user holds slot 0 or 1 and the game is not cancelled.
- `GET /api/export/quittungen?von=YYYY-MM-DD&bis=YYYY-MM-DD`: the batch PDF. An invalid or empty result redirects back to `/profil` with a `fehler` message instead of returning an empty PDF.

Both use `requireUser`, `Content-Type: application/pdf`, `Content-Disposition: attachment` and `Cache-Control: no-store`. File names are `quittung-<yyyy-mm-dd>-<home>-<away>.pdf` and `quittungen-<von>-<bis>.pdf`, ASCII-slugged.

### D6 Saving expenses via server actions with one permission check

`src/server/expenses.ts` exports `saveExpenses(actor, gameId, refereeId, input)`. It allows the save if `actor.id === refereeId` or `actor.role === 'admin'`, and requires an assignment on slot 0 or 1 of a non-cancelled game. It validates the values (km 0..2000 integer, amounts 0..999.99 EUR, label up to 40 characters) and upserts. The `kalender` action passes the session user as both actor and referee. The `bearbeiten` action, for admins, passes the chosen referee.

### D7 UI placement

- `kalender`: each own game on a referee slot gets a collapsible "Fahrt & Kosten" form (`<details>`, no client JS needed) and a "Quittung (PDF)" link, on both the mobile card and the wide table row. The form is a single column with full-width inputs and `inputmode="numeric"`/`"decimal"`, so it works at 390 px.
- `profil`: a "Quittungen für Zeitraum" panel with two date inputs, preset per D3, submitting a GET form to the batch route.
- `einstellungen`: a "Fahrtkosten" panel for the two rates and a fee input per league in the league list. Saving appends history rows only when a value actually changes.
- `bearbeiten`: an expense form per occupied referee slot.

## Risks / Trade-offs

- [Composite FK to a unique index] Drizzle needs `foreignKey({ columns, foreignColumns })` against `assignments_one_slot_per_referee`. → The migration is checked with an integration test that deletes an assignment and expects the expense row gone.
- [Helvetica lacks some characters] Team names with characters outside WinAnsi (e.g. Polish ł) would throw. → `receipt-pdf.ts` maps unsupported characters to a close ASCII fallback before drawing; a unit test covers it.
- [Admin changes a rate twice within one game day] Only the value valid at the exact kickoff time counts. → This is intended and covered by the spec scenario.
- [Batch PDF size] A season has roughly 30 games per referee; each page is about 10 KB plus the shared logo object, which is embedded once per document. → Acceptable.
- [Privacy] The new personal data is not yet in the Art. 15 export or the privacy page. → Deferred commitment, trigger before publishing.

## Migration Plan

One Drizzle migration `0015_schiri_quittung.sql` creates the three tables; existing rows are not touched. Rollback drops the three tables; no other table changes.

## Commitments

- [Quittungsdaten in Auskunft und Datenschutz](/commitments/quittungsdaten-auskunft-datenschutz.md): kept (this change only records it; it is settled before publishing)
