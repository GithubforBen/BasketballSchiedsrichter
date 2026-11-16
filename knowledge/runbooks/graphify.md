---
type: Runbook
title: Set up and use graphify
description: How to set up graphify code-only with specfold graphify setup, query the graph, keep it fresh, and share it if a team wants to.
status: draft
stale_after: 2027-01-26T09:07:49+01:00
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-28T09:07:49+01:00 }
sources:
  - id: graphify-teams
    resource: https://docs.graphify.com/guides/team-workflows
    title: "graphify docs: team workflows"
---

# When to use

When agents spend many tool calls finding where something lives in the code. graphify parses the code locally into a graph that answers "where is it, what calls what" in one query. It is optional: nothing in Specfold requires it, and small repositories gain little. Checked with graphify 0.9.97.

# Steps

1. Install graphify once per machine: `uv tool install graphifyy` (or `pipx install graphifyy`).
2. Run `node scripts/specfold.mjs graphify setup` at the repository root. It installs graphify's skill into `.agents/skills/graphify/` and links it, writes `.graphifyignore`, adds graphify's guard to `.claude/settings.json` when the repository uses Claude Code, and builds the graph code-only (`GRAPHIFY_BACKEND=none`), so no file content leaves the machine. A second run changes nothing.
3. Commit `.agents/skills/graphify/`, the skill link, `.graphifyignore` and the settings. `graphify-out/` stays ignored: every clone builds its own graph, and Specfold's `post-checkout` and `post-merge` hooks refresh it with `graphify update .`.
4. Ask the graph before grepping: `graphify query "<question>"`, `graphify path "<A>" "<B>"`, `graphify explain "<name>"`. The lookup order in `AGENTS.md` puts the graph after knowledge and before specs.

**Sharing the graph.** A team that wants one shared graph can follow graphify's commit-with-code workflow: commit only `graphify-out/graph.json`, replace the `graphify-out/` line in `.gitignore` with `graphify-out/*` and `!graphify-out/graph.json`, and register graphify's merge driver, so a change to the graph on two branches merges instead of conflicting: add `graphify-out/graph.json merge=graphify linguist-generated=true -diff` to `.gitattributes`, and run `git config merge.graphify.driver "graphify merge-driver %O %A %B"` in each clone. Do not run `graphify hook install`: it installs graphify's own git hooks next to Specfold's, which already refresh the graph. Never commit `GRAPH_REPORT.md` or `cost.json`.

**Removing it.** Delete `.agents/skills/graphify/`, run `node scripts/specfold.mjs agents sync`, and remove the two `graphify hook-guard` entries from `.claude/settings.json`. The guard does nothing on a machine without graphify, so teammates who never install it get no errors.

# Verify

- `graphify-out/graph.json` exists and `graphify query "<a module name>"` returns nodes.
- `node scripts/specfold.mjs doctor` reports graphify's version (D6).
- `node scripts/specfold.mjs stats` lists the `graphify` skill; its description counts toward the total but has no per-skill budget.

# Related
