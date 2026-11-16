---
name: sf-apply
description: Implement a planned change as orchestrator - one implementer per task group with its task packet, parallel worktrees up to your limit, merges, split proposals, verification.
---

# sf-apply

Use this in the main session once a change is planned: its brief is confirmed and `tasks.md` passes its checks. You are the orchestrator. Subagents do the work; you dispatch, merge and decide with the user. In tools without subagents, work the same groups yourself, one after another, with the same packets and rules.

## Before you start

1. Run `node scripts/specfold.mjs tasks check <change>`, `node scripts/specfold.mjs status <change>` and `node scripts/specfold.mjs parallel show`. Fix errors in `tasks.md` through `spec-writer` first.
2. Work on the change's branch, never on the default branch. With several changes at once (pattern 1 below), each change has its own session and branch.

## The loop

3. **Dispatch.** Take every open group whose `depends` are all merged. For each, run `node scripts/specfold.mjs tasks packet <change> <n>` and start an `implementer` subagent in the background with the packet as its prompt, verbatim. Never run more implementers at once than the limit from `parallel show`; at a limit of 1, run one group at a time. Never give an implementer two groups or the whole change.
4. **Collect.** Each implementer ends with `DONE` (the branch its worktree was created on, commits, tests) or `SPLIT PROPOSAL`. Read only that final message; never pull its files into your context.
5. **Merge.** For each `DONE`, merge its branch into the change branch with `git merge --no-ff <branch>`, then run `node scripts/specfold.mjs index` and commit regenerated indexes if they changed. A conflict in `knowledge/**/index.md` is solved by regenerating; `log.md` merges by union. Any other conflict: stop and ask the user how to resolve it. When the round's branches are merged, run `node scripts/specfold.mjs wt clean --base <change branch>` to remove their worktrees. While worktrees exist under `.claude/worktrees/`, Claude Code also lists their copies of the skills; that is harmless and ends with the clean.
6. **Split proposals.** Follow [references/packet-and-split.md](references/packet-and-split.md): hand the proposal to `spec-writer`, ask the user when it changes the change's scope, rerun `tasks check`, then dispatch the new or reshaped group. Never let an implementer widen its own scope, and never widen it for them silently.
7. Repeat from step 3 until every group is merged.

## Finish

8. **Verify.** Start a `verifier` on the change branch. On `FINDINGS`, send each finding back as a new packet to the group that owns the files, as in steps 3 to 5; never fix findings yourself in the main session.
9. **Archive and sync.** Archive the change (`/opsx:archive` or `openspec archive <change>`), then start `knowledge-curator` to run sf-sync. sf-sync's retro asks the user, which a subagent cannot: run the retro yourself once the curator has reported. Pushing and opening the PR are yours, after the user agrees.

## Patterns

- **One change, parallel groups** (this skill): groups own disjoint files, so their worktrees merge cleanly.
- **Several changes at once:** `node scripts/specfold.mjs wt plan` shows which active changes may run together; start one session per change with `claude --worktree <change>` (or `node scripts/specfold.mjs wt new <change>` in other tools), each running this skill.
- **Large mechanical changes** (renames, migrations across many files): Claude Code's `/batch`, wrapped in one change with `skip_specs: true` when no behavior changes.

Agent teams stay off: they do not isolate teammates in worktrees.

## In omp

omp runs the same loop with its `task` tool. `specfold agents sync` generates the roles in `.omp/agents/` and the task settings in `.omp/config.yml` once `tools` in `specfold.yaml` lists `omp`.

- **Dispatch:** one task item per group, with `agent: implementer`, `isolated: true` and the packet verbatim as its task. Put at most the `parallel show` limit into one batch; Specfold does not set omp's own concurrency limit.
- **Merge:** omp commits each isolated task's work to `omp/task/<agent id>` and leaves it unapplied. Merge the branch omp reports in the task result with `git merge --no-ff`, not the branch the implementer names from inside its workspace, then delete it with `git branch -d`. There are no worktrees to clean.
- **Verify and sync:** `verifier` and `knowledge-curator` run without `isolated`.

## Rules

- Only the main session spawns subagents; the template's settings enforce it.
- Subagents return summaries, never raw file contents.
- Subagents start in the background. One that works on the change branch itself, like the knowledge curator, owns it until it reports: don't commit, merge or switch branches meanwhile.
- Trust git, not a hand-off: when a final message is neither of the expected forms, check the branch before resuming the subagent.
- Pass packets verbatim; the packet, not your paraphrase, is the contract.
