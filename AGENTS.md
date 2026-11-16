<!-- specfold:start -->
# Agent instructions

This repository keeps its knowledge in an OKF bundle and its behavior contracts in OpenSpec, wired together by Specfold.

## 1. Rather ask than assume

When the request, the knowledge or the specs leave a decision open, or something conflicts with what exists, ask the user before deciding. Use the tool's native question UI (in Claude Code: `AskUserQuestion`), one decision per question, recommended option first. Never treat a missing or timed-out answer as consent.

## 2. Map

| Path | What it is |
| --- | --- |
| `knowledge/` | OKF v0.2 bundle: why and what. Start at `knowledge/index.md` |
| `openspec/specs/` | behavior contracts, one folder per capability |
| `openspec/changes/` | changes in progress; `archive/` holds finished ones |
| `specfold.yaml` | Specfold settings; `source_globs` says where the code lives |
| `.agents/skills/` | the `sf-*` skills (omp reads them here; `specfold agents sync` links them into `.claude/skills/`) |
| `scripts/specfold.mjs` | the Specfold CLI; run it with `node scripts/specfold.mjs <command>` |

## 3. Core rule

Specs are the behavior contract, knowledge is the context, and nothing is written twice. Knowledge never contains SHALL/MUST sentences; a requirement goes into a spec.

## 4. Lookup order

1. `node scripts/specfold.mjs lookup <words>` (skill `sf-lookup`) for *why and what*. Read the 1-3 best concepts and mind the `stale`, `deprecated` and `unverified` flags.
2. The code graph, if one is installed (for example `graphify query`), for *where in the code*.
3. `openspec show <spec> --type spec --json --no-scenarios` for *behavior*.
4. Raw grep and file reads last.

## 5. Workflow

Every behavior change is an OpenSpec change using the `specfold` schema: brief, proposal, specs, design (only if needed), knowledge, tasks.

1. **Plan:** the planning interview (skill `sf-interview`) until the user approves; then the artifacts. Claude Code: `claude --agent planner --permission-mode plan`. Other tools, omp included: skill `sf-plan`.
2. **Apply:** by task groups with skill `sf-apply` (parallel implementer subagents in Claude Code and omp, one group at a time elsewhere), one commit per task with the trailer `Task: <change>#<n>.<m>`. Check progress with `node scripts/specfold.mjs status <change>` and `resume <change>`.
3. **Check:** `node scripts/specfold.mjs change check <change>` and `openspec validate --all --strict`.
4. **Archive:** `/opsx:archive` (or `openspec archive <change>`), then skill `sf-sync` (`node scripts/specfold.mjs sync <change>`) in the same PR.

Before an action set to `ask` under `permissions` in `specfold.yaml` (push, force-push, delete a remote branch, push tags, open, merge or close a PR), ask the user; never take one set to `deny`.

OpenSpec must be installed, on the PATH or in `node_modules/.bin`; `node scripts/specfold.mjs doctor` checks the version.

## 6. When OpenSpec is not needed

Changes with no behavior change (refactors, tooling, docs) set `skip_specs: true` in the change's `.openspec.yaml` and may use a short brief: Wish and Confirmation.

## 7. Knowledge rules

- One concept per file, kebab-case names, bundle-absolute links (`/decisions/x.md`). New knowledge: skill `sf-capture` (`node scripts/specfold.mjs new <Type> <path>`).
- Agents write `status: draft` and never write `verified` or any `human:` actor; only humans verify.
- `index.md` and `log.md` are generated: run `node scripts/specfold.mjs index` and `node scripts/specfold.mjs log add <message>`, never edit them by hand.
- Code comments stay short and point to knowledge with `see knowledge:` and the concept's bundle-absolute path (`/conventions/code-comments.md`).
- Check with `node scripts/specfold.mjs validate`; `node scripts/specfold.mjs audit` (skill `sf-audit`) reports slow decay.
<!-- specfold:end -->
