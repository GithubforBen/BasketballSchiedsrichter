---
name: sf-plan
description: Plan a change end to end in tools without a planner agent. Run the sf-interview skill until the brief is confirmed, decide the change boundaries, write the OpenSpec artifacts, and show the task breakdown for approval.
---

# sf-plan

The planner role for tools that cannot load `.claude/agents/planner.md`. Claude Code users start `claude --agent planner --permission-mode plan` instead. The steps are the same.

## Steps

1. Run the `sf-interview` skill until the user has approved the plan and `brief.md` is written. The user states their login for `confirmed_by` when approving; never take it from earlier files.
2. Decide the change boundaries: one change per capability where possible; split when parts can ship independently. Ask if unsure.
3. For each change, write the artifacts in order with `openspec instructions <artifact> --change <name>`: proposal, specs, design (only if needed), knowledge, tasks. Follow each instruction and the `rules` in `openspec/config.yaml`.
4. Check: `node scripts/specfold.mjs change check <name>` and `openspec validate <name> --strict` must report no errors.
5. Show the execution plan for approval:
   - the task groups;
   - which files each group owns;
   - the dependency order;
   - which groups could run in parallel.

   Wait for an explicit approval. Changes requested here go back into `tasks.md`, and you ask again.

## Rules

- Write only under `openspec/changes/` while planning. Code changes start with apply.
- Never guess past an open decision: ask, record the answer in `brief.md`, then continue.
