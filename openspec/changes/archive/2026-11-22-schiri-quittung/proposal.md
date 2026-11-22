# Proposal

## Why

After every game the two referees fill in the club's paper receipt "Quittung über Schiedsrichtergebühren" (template 2015) by hand: game, names, kilometres, fee, per diem, totals. The app already knows the game and both referees, so it can produce the receipt; what it lacks are the money values. Bringing them into the app saves the handwriting and keeps rates and fees consistent across referees.

## What Changes

- Referees record their own expenses per assignment on a referee slot: travel mode (drove alone, drove with passenger, rode along), kilometres, per diem, other costs with an optional label. Admins can record and correct them for anyone.
- Admins maintain the two per-km rates (defaults 0.30 and 0.32 EUR/km) and one game fee per league. Both keep a history with a "valid from" timestamp; a receipt always uses the values valid at kickoff.
- A referee on slot 1 or 2 of a non-cancelled game can download that game's receipt as a PDF in the template's layout, with the club logo, both referees, computed amounts and totals.
- A referee can download a batch PDF of their past assignments in a chosen period (default: last full month), one page per game.
- New dependency: `pdf-lib` for server-side PDF generation.

## Capabilities

### New Capabilities

- `schiri-quittung`: referee expense entry, admin-maintained rates and league fees, and the per-game and batch receipt PDFs.

### Modified Capabilities

## Impact

- Database: new tables for assignment expenses, km-rate history and league-fee history; one Drizzle migration (`drizzle/0015_*`).
- UI: expense form and "Quittung (PDF)" on own games in `kalender`; "Quittungen für Zeitraum" in `profil`; rates and league fees in `einstellungen`; expense correction in `bearbeiten`.
- API: two new download route handlers under `src/app/api/export/`.
- Assets: club logo (PNG) embedded in the PDF.
- Privacy: new personal data (travel, amounts) is not yet in the Art. 15 data export or the privacy page; a deferred commitment covers that before publishing.
