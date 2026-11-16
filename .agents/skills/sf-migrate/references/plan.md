# Migration plan template

Write `.specfold/migration/plan.md` with these sections. Keep it short: the user approves it in one sitting.

```markdown
# Migration plan: <repository name>

## Repository

- Default branch: <from migrate status>
- Stack: <detected, or corrected>
- Layout: <single package or monorepo>
- CI: <system, or none>
- Source globs: <globs install writes to specfold.yaml>
- Agent tools: agents, claude   <!-- or agents only -->
- Profile: full   <!-- or knowledge: no OpenSpec, see specfold.yaml -->

## Capability domains

<!-- 2-6 areas the product is made of, each one line. They become knowledge folders or capability cards later. -->
- <domain>: <one line>

## Mapping

| Source | Becomes | Target | Note |
| --- | --- | --- | --- |
| docs/adr/0001-x.md | Decision | knowledge/decisions/x.md | accepted |
| AGENTS.md | keep | managed block | team rules stay below the Specfold block |
| .cursor/rules/style.mdc | Convention | knowledge/conventions/style.md | |
| README.md | keep | | entry point for humans |
| openspec/specs/login/ | Capability | knowledge/capabilities/login.md | migration candidate |
| knowledge/architecture/adr-0011-secrets.md | Decision | knowledge/decisions/secret-management.md | existing bundle: from ADR, original removed |
| knowledge/architecture/overview.md | Component | knowledge/architecture/system-overview.md | existing bundle: Architecture decided per file |
| knowledge/apps/index.md | index | knowledge/apps/index.md | existing bundle: regenerated, intro text to a concept |
| .agents/skills/okf/ | remove | | existing bundle: replaced by sf-capture and specfold validate |

## Type map

<!-- Existing bundle only: one row per type the inventory found. -->
| Type | Concepts | Becomes | Note |
| --- | --- | --- | --- |
| ADR | 38 | Decision | status maps to `decision:` |
| Architecture | 3 | per file | see the mapping rows |

## Team rules

<!-- One row per rule in the team's AGENTS.md or CLAUDE.md outside the Specfold block. -->
| Rule | Fate | Target |
| --- | --- | --- |
| Start with the knowledge base | remove | the Specfold block says it |
| Run `just lint-ansible` before committing | Convention | knowledge/conventions/ansible-lint.md |
| Use pnpm, not npm | keep | below the Specfold block |

## After conversion

<!-- Existing bundle only; the conversion is done when every item is. -->
- Delete each original the mapping replaces, once its rewrite exists
- Rewrite references to every moved concept in tracked files
- Remove tooling marked `remove`: <list>
- Drop types and folders no longer in use from specfold.yaml: <list>

## Commitments

<!-- Every open Deferred Commitment, with the user's answer: stands behind it (a human adds committed_by) or withdraws it. -->
none

## Seed from code

- Cap: 30 concepts
- From: <source globs, or graphify-out/ when present>

## Gate

- This PR is the adoption PR: G4 is skipped, every other rule runs.
- From the next PR on, source changes need an OpenSpec change (G4), or with the knowledge profile a knowledge change (G19).

## Open questions

none
```

**Becomes** is one of: a concept type from `specfold.yaml` (`Decision`, `Convention`, `Term`, `Business Rule`, `Component`, `Interface`, `Data Flow`, `Runbook`, `Reference`, `Capability`, `Vision`, `Deferred Commitment`, `Backlog Item`, or a type the plan keeps from an existing bundle), `AGENTS.md section`, `index` (an existing bundle's `index.md` or `log.md`, regenerated), `keep` (stays as it is), `remove` (tooling Specfold replaces) or `ignore` (not knowledge, such as a changelog).

**Existing bundle.** The type map proposes the inventory's suggested type (ADR to Decision, Playbook to Runbook, Domain Concept to Term, App to Component; a type Specfold has stays); a type without a suggestion is decided per file in the mapping. Tooling that Specfold replaces (an OKF validator, an OKF skill, hook steps running them) is `remove`, anything else `keep`. Team rules the Specfold block already states are `remove`, rules about how this repository works become a `Convention`, and the rest `keep` below the block. Every inventory source gets exactly one row; group many files of one folder into one row only when they all get the same treatment.

After the user approves, append:

```markdown
## Approval

approved_by: human:<login the user stated>
approved_at: <ISO 8601 with offset, from `date`>
```
