---
type: Convention
title: Code comments point to knowledge
description: "Comments stay short; rationale, rules and history live in knowledge/, and the comment points there with see knowledge: /<path>.md."
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-26T14:36:07+01:00 }
---

# Convention

Code comments stay short. Rationale, business rules, history, trade-offs and "why not X" live in this knowledge bundle, and the comment only points there.

| Fine in code | Goes to knowledge; the comment only references it |
| --- | --- |
| one line on a non-obvious mechanism ("retry because the API is eventually consistent") | why a design was chosen, rejected alternatives |
| a TODO with an issue or change id | business rules, legal or compliance reasons |
| public API doc comments the language tooling expects | history ("used to be X until 2025"), incidents |

**Reference syntax:** one pointer per comment, in any comment style of the language. The path is bundle-absolute, like the links between concepts, and an optional short label may follow after ` - `. When one comment covers several concepts, list the paths separated by commas before the label.

```ts
// see knowledge: /decisions/guest-orders-without-accounts.md - why guests get no account
const token = issueGuestToken(order);

// see knowledge: /decisions/guest-orders-without-accounts.md, /domain/guest.md - guests
```

`specfold index` scans the files in `source_globs` for these references and lists, for each concept, the code locations that point to it. Agents can therefore go from knowledge to code and back. Code graph tools such as graphify also pick up such citations.

General code style, naming and patterns are not part of this convention. When a team writes them down, they go into `conventions/` the same way, and linters stay the enforcement for anything a tool can check.

# Why

Rationale written into comments drifts away from the code, gets duplicated, and is invisible to anyone who doesn't open that file. A concept has an owner, a trust status and links, and it shows up in `specfold lookup`. A one-line reference keeps the code readable and the reasoning in one place.
