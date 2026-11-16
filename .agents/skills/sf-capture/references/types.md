# Concept types

| Type | Folder | Holds | Body headings |
| --- | --- | --- | --- |
| Term | `domain/` | what a word means here, and what it must not be confused with | Meaning, Not to be confused with, Related |
| Business Rule | `domain/` | a rule of the business and why it exists | Rule, Why, Related |
| Component | `architecture/` | what a part of the system is responsible for | Responsibility, Interfaces, Related |
| Data Flow | `architecture/` | how data moves between components | Flow, Related |
| Interface | `architecture/` | a contract summary and its consumers (the contract itself is a spec) | Contract summary, Consumers, Related |
| Decision | `decisions/` | a choice, why, and the rejected alternatives (`decision: accepted` or `rejected`) | Decision, Why, Rejected alternatives, Related |
| Capability | `capabilities/` | why a capability exists; links its spec (written by `specfold sync`) | Why, Related |
| Convention | `conventions/` | how code, tests or knowledge are written here | Convention, Why, Related |
| Runbook | `runbooks/` | how to do a recurring operational task | When to use, Steps, Verify, Related |
| Reference | `references/` | a summary of an external document, with `stale_after` | Summary, Related |
| Vision | `vision/` | where the project is heading | Goals, Non-goals, Principles |
| Deferred Commitment | `commitments/` | a promise made for later and what triggers it | Commitment, Trigger, Related |
| Backlog Item | `backlog/` | an idea needed later, not now | Idea, Related |

`specfold.yaml` lists the types a repository allows; `specfold new` refuses others.

## Keys `specfold new` writes

- `sources: []` for every type, to be filled with the files or documents the concept rests on.
- `decision: accepted` for a Decision only; change it to `rejected` for a rejected proposal.
- `stale_after` (90 days after `generated.at`) for a Runbook and an Interface only; a Reference gets it when you add it.

## Choosing

- Would the behavior be testable? Then it belongs in a spec, and knowledge only explains why.
- Is it a choice someone could make differently? Decision.
- Is it vocabulary? Term. A constraint from the business? Business Rule.
- Will it go stale when an external system changes? Reference with `stale_after`.
