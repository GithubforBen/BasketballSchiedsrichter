---
name: sf-capture
description: Record new project knowledge (a decision, term, business rule, convention, component or runbook) or a rejected proposal as an OKF concept in knowledge/, with specfold new and validate.
---

# sf-capture

Use this when the conversation produces knowledge worth keeping: a decision and its reasons, a domain term, a business rule, a convention, how a component works. Also use it when a proposal is rejected, so agents find the reason later.

## Steps

1. Check that the concept does not exist yet: `node scripts/specfold.mjs lookup <words>`. Update an existing concept instead of creating a near-duplicate.
2. Create it: `node scripts/specfold.mjs new <Type> <folder>/<kebab-name>.md --title "<Title>" --description "<one line, at most 160 characters>"`. Set `SPECFOLD_MODEL` to your model id so `generated.by` names you.
3. Write the body under the template's headings. Keep it short (at most about 300 lines), link related concepts bundle-absolute (`/decisions/x.md`), and list where the knowledge came from in `sources`.
4. Run `node scripts/specfold.mjs index`, then `node scripts/specfold.mjs log add --kind <Kind> "<what changed>"`.
5. Run `node scripts/specfold.mjs validate` and fix every error.

Types, folders and what goes where: [references/types.md](references/types.md).

## Rejected proposals

When the user rejects a proposal or change, write a `Decision` with `decision: rejected`: what was proposed, why it was rejected, and what would make it worth reconsidering. Ask the user before deleting the change folder; the decision keeps the reason.

## Long comments in code

When code holds a long rationale comment (why a design was chosen, a business rule, history), offer to move it into a concept and leave a one-line reference behind: `// see knowledge: /decisions/<name>.md`. Never move comments without asking. See `/conventions/code-comments.md`.

## Rules

- Write `status: draft`. Never write `verified` or any `human:` actor; only humans verify.
- No SHALL/MUST sentences: requirements belong in OpenSpec specs, knowledge describes context.
- Never edit `index.md` or `log.md` by hand.
