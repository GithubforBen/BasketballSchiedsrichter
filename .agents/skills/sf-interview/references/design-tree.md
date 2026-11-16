# Design tree

Work the decisions top-down; each answer can open or close branches below it.

1. **Outcome and scope:** what should be true afterwards, for whom, and what is explicitly not part of it. Should this be one change or several?
2. **Behavior:** the main flow as the user or caller sees it, inputs and outputs, and errors.
3. **Edge cases:** empty, duplicate, concurrent, very large, invalid, missing permissions, partial failure.
4. **Constraints:** existing decisions and specs it must respect, compatibility, data that already exists.
5. **Non-functional needs:** performance, security, privacy, accessibility, cost; ask only where they could change the design.

## Good questions

- One decision each, answerable by picking an option.
- Grounded: the options come from what you found in knowledge, specs and code.
- Recommended option first, with a reason the user can check in a few seconds.
- Options are mutually exclusive; "Other" is always available, so don't add one.

## Avoid

- Asking what knowledge, specs or code already answer.
- Bundling two decisions in one question.
- Questions whose answer would not change the specs, the design or the task breakdown.
- Asking about implementation details that belong in `design.md` and can be decided later.

## Example round

> **Due date format** (header "Format"): How is a due date given and stored?
> 1. YYYY-MM-DD string (Recommended): a calendar date without time zone, easy to validate and compare.
> 2. Date object: supports times, but brings time zones into the change.
