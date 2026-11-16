---
name: sf-audit
description: Find slow decay in project knowledge with specfold audit (stale, long unverified, links to deprecated concepts, orphans, specs without a capability card) and propose fixes as one change or PR.
---

# sf-audit

Use this on request, or when the scheduled audit opens an issue.

## Steps

1. Run `node scripts/specfold.mjs audit --json` and group the findings by rule.
2. Propose a fix per finding, and ask the user before writing:
   - **A1 stale:** re-check the concept against its `sources`. If it still holds, move `stale_after` forward and say what you checked; if not, update it or propose deprecating it.
   - **A2 long unverified:** list these for a human to review. Never verify anything yourself; humans run `specfold verify`.
   - **A3 link to a deprecated concept:** link the concept that replaced it, or remove the link.
   - **A4 orphan:** link it from the concept it belongs with, or propose deprecating it if nothing needs it.
   - **A5 spec without a card:** create the capability card with `sf-capture` (type `Capability`, `spec:` set to the spec path).
3. Make the agreed fixes as one change or PR, then run `node scripts/specfold.mjs audit` and `node scripts/specfold.mjs validate` again.

## Rules

- Audit findings are warnings; fixing them is never a reason to change behavior or specs.
- Deprecating is a decision: ask first, and record why in the concept.
