---
name: sf-migrate
description: Bring an existing repository into Specfold in one reviewable PR on its own branch. Inventory its docs, get a mapping plan approved, install the kit with specfold migrate, convert the docs into draft concepts and report.
---

# sf-migrate

Use this when a repository that already has code or docs should start using Specfold, usually because `BOOTSTRAP.md` sent you here. For an empty repository, copy the template files and run `node scripts/specfold.mjs init` instead.

**The CLI.** Until install, the repository has no `scripts/specfold.mjs`, so steps 1 to 4 run `node <kit>/scripts/specfold.mjs`. `<kit>` is the unpacked template folder that `BOOTSTRAP.md` gave you. If you have none, ask the user for its path. From step 5 on, run `node scripts/specfold.mjs`.

## Steps

0. **Resume.** Run `migrate status` and continue at the step it names. Never redo a step it lists as done.
1. **Preflight.** Run `migrate start`. It creates or resumes the branch `specfold/migration`, and refuses on any other branch or with uncommitted changes. If it refuses, tell the user why and stop; never stash, commit or switch branches on your own. Then run `doctor`: before install, only D1 (Node) and D3 (OpenSpec) must pass. If D3 fails, ask the user whether the repository wants specs at all: with the knowledge profile (`--profile knowledge` at install) OpenSpec is not needed; otherwise ask them to install it.
2. **Inventory.** Run `migrate inventory`. It lists every tracked knowledge source with its kind and a token estimate, plus the detected stack, layout, CI system and source globs. Sources of kind `okf-concept` and `okf-index` mean `knowledge/` already holds an OKF bundle: follow the **Existing bundle** parts of the plan and conversion references from here on.
3. **Plan (checkpoint).** Write `.specfold/migration/plan.md` from [references/plan.md](references/plan.md), with one mapping row per inventory source.
   - For an existing bundle, also fill the type map, tooling, AGENTS.md rules, "After conversion" and commitments sections; ask which open Deferred Commitments the user stands behind.
   - Show the user the plan and ask in the native question UI: "Approve as <login>", or edit (through "Other"). Ask the user to state their login; never take it from git config or an earlier answer.
   - On approval, append the `## Approval` section with the stated login and the time from `date`, run `migrate mark plan`, and commit `plan.md`.
   - On an edit, change the plan and ask again. If the answer is missing or the question times out, stop: that is not consent.
4. **Install.** Ask the user in the native question UI whether to turn on weekly upgrade PRs, which also need a `SPECFOLD_TOKEN` secret. Then run `migrate install --from <kit>` with the plan's values: `--profile` when the plan says `knowledge`, one `--source-glob` per glob, and `--stack`. Add `--upgrade-workflow` on a yes, `--tools agents` if the plan says the repository does not use Claude Code, and `--ref <sha>` if `BOOTSTRAP.md` named one. Pass on the secret's setup that install prints.
   - For each conflict it reports, show it to the user and ask what to do. Never overwrite or delete a file to get past a conflict.
   - Ask the user once how many subagents may run at the same time (recommended 3; more parallel subagents cost more tokens, and what is affordable depends on their plan), then run `node scripts/specfold.mjs parallel set <n>`. The limit is personal and stays out of git.
   - Run `node scripts/specfold.mjs doctor` again: everything must pass now, and D4 may only warn when a hook manager still needs `lefthook install` or similar.
   - Commit.
5. **Convert.** Work through the plan's mapping rows following [references/conversion.md](references/conversion.md). Each concept is created with `SPECFOLD_MODEL=<your model id> node scripts/specfold.mjs new <type> <path>` and gets `sources` pointing at the original file. Files outside `knowledge/` are never moved or deleted. An existing bundle's concepts are rewritten into Specfold's folders and their originals removed, as conversion.md's "Existing bundle" section says; until convert is marked, the hooks only warn about broken links and unchanged originals, so commit as you go. Run `migrate mark convert` only when every "After conversion" row is done and `node scripts/specfold.mjs validate` passes, then commit.
6. **Seed from code.** Add architecture and glossary concepts from the code, up to the plan's seed cap (default 30), as [references/conversion.md](references/conversion.md) describes. Run `migrate mark seed` and commit.
7. **No retroactive specs.** Write no `openspec/specs/` for existing behavior; specs grow with real changes.
8. **Validate and report.**
   - Run `node scripts/specfold.mjs log add --kind Migration "<summary with counts>"` first, so the root index lists the log, then `node scripts/specfold.mjs index`, `node scripts/specfold.mjs validate` and `openspec validate --all --strict`, and fix every error.
   - Run `node scripts/specfold.mjs stats` for the always-loaded token estimate. A budget it reports as exceeded goes into the report; shorten only what the migration itself wrote.
   - A spec or change that existed before the migration and already fails `openspec validate --strict` would block the gate's G3 on this PR. Never edit it on your own: show the failure and ask the user whether to fix it in this PR (in its own commit) or leave it and report it.
   - Write `.specfold/migration/report.md` from [references/report.md](references/report.md), then run `migrate mark report`. Commit.
9. **PR.** Ask the user before `git push` and before opening the PR. The PR body summarizes the report and links `plan.md` and `report.md`. The gate skips G4 for this PR (adoption PR), and G4 applies to every PR after it. Tell the user that the gate blocks merges only as a required check: once the PR is merged, `node scripts/specfold.mjs gate require` sets that up, with a `gh` login that has admin rights.

## Rules

- Everything happens on `specfold/migration`. Never push, merge or force-push without the user's approval. Undoing the migration is deleting the branch.
- Every concept you write is `status: draft` with `generated` set; never write `verified` or any `human:` actor except the approval the user stated.
- The plan is the contract. A source that turns out to need a different target goes back to the user as a plan edit; never decide it silently.
- Keep the bundle reviewable: no concept without a source or a code location, and no more seeded concepts than the cap.
