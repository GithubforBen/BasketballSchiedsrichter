## Wish

"Das hier sollte jeder Schiri für sich exportieren können." Every referee can export the club's referee fee receipt ("Quittung über Schiedsrichtergebühren", template 2015) as a PDF, pre-filled with the game and with the fees and expenses of both referees of the game.

## Decisions

| # | Question | Answer | Source |
| --- | --- | --- | --- |
| Q1 | What does the app fill in? | Game data (league label, home vs. away, date, venue), both referee names, travel costs, league fee, per diem (Tagegeld), other costs (Sonstiges) and totals. | user |
| Q2 | Who appears on the receipt? | Both referees of the game (slot 1 and 2). Either of the two can export the same receipt. | user |
| Q3 | Format? | PDF file generated on the server (`pdf-lib`), layout following the template. Header carries the club logo "SC Bergstrasse Basketball" supplied by the user. | user |
| Q4 | Scope of an export? | One receipt per game, plus a batch PDF with one page per game. | user |
| Q5 | Travel cost rules? | Each referee picks: drove alone (0.30 EUR/km), drove with a passenger (0.32 EUR/km) or rode along (0 EUR), and enters the kilometres. | user |
| Q6 | Where are kilometres entered? | Stored on the referee's own assignment, so both referees' values show on the shared receipt. | user |
| Q7 | Who may enter or change expense data? | The referee themselves and admins, at any time, also after the game. | user |
| Q8 | Are the per-km rates fixed? | Admin-editable in the settings, defaults 0.30 and 0.32 EUR/km. | user |
| Q9 | Game fee (Gebühren)? | Admin maintains one fee per league; the app fills it in. | user |
| Q10 | Per diem and other costs? | The referee enters them as amounts. | user |
| Q10a | Label for other costs? | "Other" gets an optional short text label (max. 40 characters) printed before the amount. | delegated |
| Q11 | Rate or fee changes after a game? | Frozen to the game day: the rate and fee valid at kickoff apply. | user |
| Q11a | How is freezing implemented? | As rate and fee history with a "valid from" timestamp. | delegated |
| Q12 | Batch PDF period? | Freely chosen from-to dates, default the last full calendar month; only assignments whose kickoff has passed. | user |
| Q13 | Where in the UI? | Expense entry and "Quittung (PDF)" on the own assignment; "Quittungen für Zeitraum" in the profile. | user |
| Q14 | Empty values? | Fields without data stay blank on the PDF so they can be filled by hand. Cancelled games and substitute slots get no receipt; a game with only one referee leaves the second column blank. | user |
| Q15 | Totals with empty values? | The totals add up everything; an empty value counts as 0. | user |
| Q16 | Place, date, signatures? | Left blank, filled by hand. | delegated |
| Q17 | Data export (Art. 15) and privacy page? | Not part of this change; recorded as a deferred commitment to settle before publishing. | user |
| Q18 | Extra verification? | The verifier checks the mobile view (expense entry and download) at 390 px width. | user |
| Q19 | Admin who edits expenses: where? | On the admin game edit view of that game. | delegated |

## Out of scope

- Admin export across all referees (e.g. for the treasurer): backlog item.
- Game number from the schedule import ("Spiel Klasse + Nr."): backlog item.
- Two games on one sheet: dropped.
- Including the new expense data in the personal data export and the privacy page: deferred commitment, trigger "before publishing".

## Open questions

## Confirmation

confirmed_by: human:GithubforBen
confirmed_at: 2026-11-22T13:35:00+01:00
