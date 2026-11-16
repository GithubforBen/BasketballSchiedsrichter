# Agent instructions

This repository keeps its knowledge in an OKF bundle, wired up by Specfold's knowledge profile.

## 1. Rather ask than assume

When the request or the knowledge leave a decision open, or something conflicts with what exists, ask the user before deciding. Use the tool's native question UI (in Claude Code: `AskUserQuestion`), one decision per question, recommended option first. Never treat a missing or timed-out answer as consent.

## 2. Map

| Path | What it is |
| --- | --- |
| `knowledge/` | OKF v0.2 bundle: why and what. Start at `knowledge/index.md` |
| `specfold.yaml` | Specfold settings; `source_globs` says where the code lives |
| `.agents/skills/` | the `sf-*` skills (omp reads them here; `specfold agents sync` links them into `.claude/skills/`) |
| `scripts/specfold.mjs` | the Specfold CLI; run it with `node scripts/specfold.mjs <command>` |

## 3. Core rule

The code says what the system does; the knowledge bundle says why it is that way. Consult it before any task, and keep it describing the system as it is.

## 4. Lookup order

1. `node scripts/specfold.mjs lookup <words>` (skill `sf-lookup`) for *why and what*. Read the 1-3 best concepts and mind the `stale`, `deprecated` and `unverified` flags.
2. The code graph, if one is installed (for example `graphify query`), for *where in the code*.
3. Raw grep and file reads last.

## 5. Workflow

1. **Before:** look up the concepts covering the area you touch. Do not re-derive or contradict a recorded decision; if one conflicts with the request, say so first. Ask open decisions with skill `sf-interview`.
2. **With every code change:** update the affected concepts in the same pull request, or write new ones with skill `sf-capture`, and add a log entry. A change that leaves the bundle describing a system that no longer exists is unfinished.
3. **Check:** `node scripts/specfold.mjs validate`; the gate blocks code changes without a knowledge change (rule G19) unless the pull request has the escape label and a `No-knowledge reason:` line.

Before an action set to `ask` under `permissions` in `specfold.yaml` (push, force-push, delete a remote branch, push tags, open, merge or close a PR), ask the user; never take one set to `deny`.

To add behavior specs later, set `profile: full` in `specfold.yaml` and run `node scripts/specfold.mjs upgrade --yes`.

## 6. Knowledge rules

- One concept per file, kebab-case names, bundle-absolute links (`/decisions/x.md`). New knowledge: skill `sf-capture` (`node scripts/specfold.mjs new <Type> <path>`).
- Agents write `status: draft` and never write `verified` or any `human:` actor; only humans verify.
- `index.md` and `log.md` are generated: run `node scripts/specfold.mjs index` and `node scripts/specfold.mjs log add <message>`, never edit them by hand.
- Code comments stay short and point to knowledge with `see knowledge:` and the concept's bundle-absolute path (`/conventions/code-comments.md`).
- Check with `node scripts/specfold.mjs validate`; `node scripts/specfold.mjs audit` (skill `sf-audit`) reports slow decay.
