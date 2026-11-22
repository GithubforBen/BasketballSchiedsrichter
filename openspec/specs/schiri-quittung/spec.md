# schiri-quittung Specification

## Purpose
Lets each referee record the expenses of a game they officiated and export the club's referee fee receipt as a PDF, pre-filled with the game, both referees, admin-maintained rates and fees, and the totals.

## Requirements

### Requirement: Referee records own expenses per assignment

The system SHALL let a referee who holds slot 1 or 2 of a non-cancelled game record, for that assignment, a travel mode (drove alone, drove with passenger, rode along), whole kilometres, a per diem amount, an other-costs amount and an optional other-costs label of at most 40 characters. Every value is optional and can be changed at any time, before and after kickoff.

#### Scenario: Referee saves travel data

- **WHEN** a referee on slot 1 of an upcoming game saves "drove alone" with 42 km
- **THEN** the system stores the values for that assignment and shows them again when the referee reopens the form

#### Scenario: Referee edits after the game

- **WHEN** a referee changes the kilometres of an assignment whose kickoff has passed
- **THEN** the system stores the new value

#### Scenario: Substitute slot has no expense form

- **WHEN** a referee holds only a substitute slot of a game
- **THEN** the system offers no expense form and rejects an expense save for that game

#### Scenario: Invalid input is rejected

- **WHEN** a referee submits negative kilometres, a negative amount, or a label longer than 40 characters
- **THEN** the system rejects the save with a message and keeps the previous values

### Requirement: Referee cannot edit another referee's expenses

The system SHALL reject expense changes by a non-admin user for any assignment that is not their own.

#### Scenario: Partner expenses are read-only

- **WHEN** a referee submits an expense save naming the assignment of the other referee of the same game
- **THEN** the system rejects it and the other referee's values stay unchanged

### Requirement: Admin records and corrects expenses for any referee

The system SHALL let an admin record and change the expenses of any assignment on slot 1 or 2 of a game, with the same values and validation as the referee.

#### Scenario: Admin corrects kilometres

- **WHEN** an admin changes the kilometres of another referee's assignment on the game edit view
- **THEN** the system stores the new value and the next receipt for that game shows it

### Requirement: Admin maintains per-km rates with history

The system SHALL let an admin set the rate per km for "drove alone" and for "drove with passenger". A change takes effect from the moment it is saved; earlier values remain stored. Without any saved value the rates are 0.30 EUR/km and 0.32 EUR/km.

#### Scenario: Default rates

- **WHEN** no admin has ever saved a rate and a receipt is generated
- **THEN** the system uses 0.30 EUR/km for "drove alone" and 0.32 EUR/km for "drove with passenger"

#### Scenario: Rate change does not alter past games

- **WHEN** an admin raises the "drove alone" rate to 0.35 EUR/km after a game's kickoff
- **THEN** the receipt for that game still uses the rate that was valid at its kickoff

### Requirement: Admin maintains a game fee per league with history

The system SHALL let an admin set or clear the game fee of each league. A change takes effect from the moment it is saved; earlier values remain stored. The first fee ever set for a league applies to all earlier games too. A receipt uses the fee of the game's league valid at kickoff.

#### Scenario: Fee change after the game

- **WHEN** an admin changes the U16 fee from 20 EUR to 25 EUR after a U16 game's kickoff
- **THEN** the receipt for that game shows 20 EUR as fee for each referee

#### Scenario: First fee of a league applies to earlier games

- **WHEN** an admin sets a fee for a league that never had one
- **THEN** that fee also applies to games of the league whose kickoff lies before the save

#### Scenario: League without fee

- **WHEN** a game's league has no fee valid at kickoff
- **THEN** the fee line of the receipt stays blank

### Requirement: Amounts are computed from the frozen values

The system SHALL compute each referee's travel costs as kilometres times the rate of the chosen travel mode valid at kickoff, with "rode along" yielding 0 EUR, and round to whole cents. Each referee's total SHALL be the sum of travel costs, fee, per diem and other costs, where a missing value counts as 0. The overall total SHALL be the sum of both referees' totals.

#### Scenario: Driver with passenger

- **WHEN** a referee chose "drove with passenger" with 25 km, the rate at kickoff was 0.32 EUR/km, the fee was 20 EUR, and per diem and other costs are empty
- **THEN** the receipt shows travel 8.00 EUR and total 28.00 EUR for that referee

#### Scenario: Rode along

- **WHEN** a referee chose "rode along"
- **THEN** the receipt shows travel 0.00 EUR for that referee, without kilometres

#### Scenario: Overall total

- **WHEN** referee 1's total is 28.00 EUR and referee 2's total is 26.00 EUR
- **THEN** the overall total column shows 54.00 EUR

### Requirement: Receipt PDF for one game

The system SHALL let a user holding slot 1 or 2 of a non-cancelled game download a one-page PDF receipt for that game in the layout of the club template, at any time. It SHALL show the club logo, the league label, home and away team, date and venue, and per referee slot the referee's name, kilometres, travel costs, fee, per diem, other costs and total, plus the overall total.

#### Scenario: Either referee gets the same receipt

- **WHEN** referee 1 and referee 2 of the same game each download the receipt
- **THEN** both PDFs show the same names and amounts for both columns

#### Scenario: Other users are refused

- **WHEN** a user who holds no referee slot of a game requests its receipt
- **THEN** the system answers with "not found" and no PDF

#### Scenario: Cancelled game

- **WHEN** a referee requests the receipt of a cancelled game
- **THEN** the system answers with "not found" and no PDF

### Requirement: Missing values stay blank for handwriting

The system SHALL leave a field of the receipt blank when its value is unknown: a referee slot without a referee, kilometres or travel mode not entered, no fee for the league, per diem or other costs not entered. Place, date of receipt and signatures SHALL always stay blank.

#### Scenario: Only one referee

- **WHEN** a game has a referee on slot 1 and none on slot 2
- **THEN** the second referee column is blank, including its total

#### Scenario: No kilometres entered

- **WHEN** a referee has entered nothing for an assignment
- **THEN** that referee's km and travel lines are blank and the total includes only the fee

### Requirement: Batch receipt PDF for a period

The system SHALL let a referee download one PDF with one receipt page per own assignment on slot 1 or 2 of a non-cancelled game whose kickoff lies in a chosen date range (inclusive, club time zone) and has already passed, ordered by kickoff. The form SHALL preselect the last full calendar month.

#### Scenario: Default period

- **WHEN** a referee opens the batch form on 22 November 2026
- **THEN** the period is preset to 1 October 2026 to 31 October 2026

#### Scenario: Future and substitute games excluded

- **WHEN** the chosen period contains an own game whose kickoff is still ahead and one game where the referee was only substitute
- **THEN** neither game appears in the batch PDF

#### Scenario: Nothing in the period

- **WHEN** the chosen period contains no matching assignment
- **THEN** the system shows a message instead of a download and produces no empty PDF

#### Scenario: Invalid period

- **WHEN** the start date lies after the end date
- **THEN** the system shows a message and produces no PDF
