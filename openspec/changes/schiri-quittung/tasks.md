# Tasks

## 1. Data model and dependency

```yaml
files: [src/db/schema.ts, drizzle/**, package.json, package-lock.json]
depends: []
scenarios: []
agent: implementer
```

- [x] 1.1 Add `pdf-lib` as a runtime dependency
  - Done when: `npm ls pdf-lib` lists it and `npm run typecheck` exits 0
- [x] 1.2 Add `assignment_expenses`, `km_rates` and `league_fees` to `src/db/schema.ts` per design D1/D2 (cents as integers, composite FK to `assignments(game_id, referee_id)` with cascade) and generate migration `0015_schiri_quittung.sql`
  - Done when: `npm run db:generate` reports no further changes and `npm run typecheck` exits 0

## 2. Receipt domain logic

```yaml
files: [src/domain/receipt.ts, src/domain/receipt.test.ts, src/domain/receipt-period.ts, src/domain/receipt-period.test.ts]
depends: []
scenarios: [schiri-quittung#driver-with-passenger, schiri-quittung#rode-along, schiri-quittung#overall-total, schiri-quittung#only-one-referee, schiri-quittung#no-kilometres-entered, schiri-quittung#default-period, schiri-quittung#invalid-period]
agent: implementer
```

- [x] 2.1 Write `receipt.test.ts` for travel, per-referee totals (missing = 0), overall total, blank columns and German euro formatting, then implement `buildReceiptView` in `receipt.ts` (design D3)
  - Done when: `npx vitest run src/domain/receipt.test.ts` passes
- [x] 2.2 Write `receipt-period.test.ts` for the default period (last full month in Europe/Berlin, also in January) and range validation, then implement `receipt-period.ts`
  - Done when: `npx vitest run src/domain/receipt-period.test.ts` passes

## 3. Server: expenses, rates, fees, PDF

```yaml
files: [src/server/expenses.ts, src/server/receipt-rates.ts, src/server/queries/receipts.ts, src/server/receipt-pdf.ts, src/server/receipt-pdf.test.ts, src/server/receipt-logo.ts, src/server/receipts.integration.test.ts]
depends: [1, 2]
scenarios: [schiri-quittung#referee-saves-travel-data, schiri-quittung#referee-edits-after-the-game, schiri-quittung#substitute-slot-has-no-expense-form, schiri-quittung#invalid-input-is-rejected, schiri-quittung#partner-expenses-are-read-only, schiri-quittung#admin-corrects-kilometres, schiri-quittung#default-rates, schiri-quittung#rate-change-does-not-alter-past-games, schiri-quittung#fee-change-after-the-game, schiri-quittung#first-fee-of-a-league-applies-to-earlier-games, schiri-quittung#league-without-fee]
agent: implementer
```

- [x] 3.1 Implement `saveExpenses` in `src/server/expenses.ts` with the permission and validation rules of design D6, with integration tests for own save, edit after kickoff, substitute rejected, invalid input, partner rejected, admin allowed, and cascade on leaving the game
  - Done when: `npx vitest run src/server/receipts.integration.test.ts` passes the expense cases
- [x] 3.2 Implement `src/server/receipt-rates.ts`: save km rates and league fees as history (append only on change, first league fee at `-infinity`) and resolve both as of a kickoff, with integration tests for defaults, later changes and a league without fee
  - Done when: `npx vitest run src/server/receipts.integration.test.ts` passes the rate and fee cases
- [x] 3.3 Implement `src/server/queries/receipts.ts`: load the receipt view of one game for a user holding slot 0/1 (null otherwise, or when cancelled) and the list for a user and period (past kickoffs only, by kickoff)
  - Done when: integration tests in `src/server/receipts.integration.test.ts` for single and batch selection pass
- [x] 3.4 Create `src/server/receipt-logo.ts` (base64 of `design/quittung-logo.png`) and `src/server/receipt-pdf.ts` rendering one A4 page per view with `pdf-lib` and Helvetica, with a fallback for characters outside WinAnsi; unit test page count, the `%PDF` header and a team name containing `ł`
  - Done when: `npx vitest run src/server/receipt-pdf.test.ts` passes

## 4. Download routes

```yaml
files: [src/app/api/export/quittung/**, src/app/api/export/quittungen/**, src/routes.ts]
depends: [3]
scenarios: [schiri-quittung#either-referee-gets-the-same-receipt, schiri-quittung#other-users-are-refused, schiri-quittung#cancelled-game, schiri-quittung#future-and-substitute-games-excluded, schiri-quittung#nothing-in-the-period]
agent: implementer
```

- [x] 4.1 Add `GET /api/export/quittung?spiel=<id>` (404 for non-holders and cancelled games) and the route helper in `src/routes.ts`
  - Done when: `npm run typecheck` exits 0 and the route returns `application/pdf` for a slot holder in a local run
- [x] 4.2 Add `GET /api/export/quittungen?von=&bis=` with a redirect to `/profil` carrying a `fehler` message for an invalid or empty period, and the route helper
  - Done when: `npm run typecheck` exits 0 and an empty period redirects with a message in a local run

## 5. Referee UI: calendar and profile

```yaml
files: [src/app/kalender/**, src/components/calendar/ExpenseForm.tsx, src/app/profil/page.tsx, src/app/profil/actions.ts]
depends: [3, 4]
scenarios: [schiri-quittung#referee-saves-travel-data, schiri-quittung#default-period]
agent: implementer
```

- [x] 5.1 Create `ExpenseForm.tsx` (travel mode, km, per diem, other amount and label; single column, full-width inputs, numeric input modes) and the `kalender` server action that saves the session user's own expenses
  - Done when: `npm run typecheck` and `npm run lint` exit 0
- [x] 5.2 Show "Fahrt & Kosten" (collapsible) and "Quittung (PDF)" on own referee-slot games in `kalender`, on the mobile card and in the wide table
  - Done when: `npm run typecheck` exits 0 and the form appears only on slot 1/2 games in a local run
- [x] 5.3 Add the "Quittungen für Zeitraum" panel to `profil`, with the period preset to the last full month and error display from the `fehler` parameter
  - Done when: `npm run typecheck` exits 0 and the panel shows the preset dates in a local run

## 6. Admin UI: rates, fees, corrections

```yaml
files: [src/app/einstellungen/**, src/app/bearbeiten/**]
depends: [3, 5]
scenarios: [schiri-quittung#admin-corrects-kilometres]
agent: implementer
```

- [x] 6.1 Add the "Fahrtkosten" panel (two rates in EUR/km) and a fee field per league to `einstellungen`, saving through `receipt-rates.ts`
  - Done when: `npm run typecheck` exits 0 and a saved rate shows again after reload in a local run
- [ ] 6.2 Add an expense form (reusing `ExpenseForm`) per occupied referee slot to `bearbeiten`, saving through `saveExpenses` as admin
  - Done when: `npm run typecheck` exits 0 and `npm run lint` exits 0

## 7. End-to-end and mobile verification

```yaml
files: [e2e/quittung.spec.ts]
depends: [4, 5, 6]
scenarios: [schiri-quittung#referee-saves-travel-data, schiri-quittung#either-referee-gets-the-same-receipt, schiri-quittung#nothing-in-the-period]
agent: implementer
```

- [ ] 7.1 E2E on desktop: a referee enters travel data, downloads the receipt (PDF response, file name), and the batch form with an empty period shows the message
  - Done when: `npx playwright test e2e/quittung.spec.ts` passes
- [ ] 7.2 E2E on mobile at 390 x 844: the expense form is usable without horizontal scrolling, saving works and the receipt download starts; the profile batch panel fits the viewport
  - Done when: `npx playwright test e2e/quittung.spec.ts` passes the mobile cases and the verifier confirms the mobile view

## 8. Knowledge

```yaml
files: [knowledge/**]
depends: [1, 2, 3, 4, 5, 6, 7]
scenarios: []
agent: knowledge-curator
```

- [ ] 8.1 Write the concepts listed in knowledge.md
  - Done when: `node scripts/specfold.mjs validate` exits 0

## Workflow follow-up

- Archive the change, then run `node scripts/specfold.mjs sync schiri-quittung` and commit the result in the same PR.
- Before publishing to production, settle the open commitment `commitments/quittungsdaten-auskunft-datenschutz.md` (Art. 15 export and privacy page).
