---
name: sf-upgrade
description: Upgrade this repository's Specfold kit to a newer release with specfold upgrade - check, show the plan, apply on its own branch, resolve conflicts, follow the upgrade notes.
---

# sf-upgrade

Use this when the user asks to upgrade Specfold, or when `node scripts/specfold.mjs upgrade --check` reports a newer release. The CLI does the file work; you explain the plan, resolve what it could not merge, and follow the release's manual steps.

## Steps

1. **Check.** Run `node scripts/specfold.mjs upgrade --check`. Exit 0 means up to date: say so and stop. Otherwise show the installed version, the newest one and the release notes.
2. **Plan.** Run `node scripts/specfold.mjs upgrade`. It prints the plan:
   - each kit file to add, replace, merge or remove, and each managed block and config merge;
   - the conflicts it expects;
   - the migrations and the upgrade notes.

   Summarize it, conflicts first, and ask the user whether to apply it.
3. **Apply.** Only on a yes, run `node scripts/specfold.mjs upgrade --yes`. It refuses a dirty working tree, so ask the user to commit or stash first. It commits on branch `specfold/upgrade-<version>` and writes `.specfold/upgrade-report.md`.
4. **Conflicts.** Exit 1 means files hold conflict markers or were left unchanged. For each conflict in the report:
   - read the file;
   - keep the team's intent and the new release's change;
   - ask the user when the two contradict.

   Never drop a team edit silently. Commit the resolutions on the same branch.
5. **Upgrade notes.** Do every manual step in the report's "Upgrade notes", in version order. Ask before any step that changes project knowledge or specs.
6. **Check the result.** Look at the follow-up commands in the report. If one failed, rerun it and fix what it reports. Finish with `node scripts/specfold.mjs validate` and `node scripts/specfold.mjs gate --local`.
7. **Hand over.** Show the branch and the report's summary. Pushing and opening the PR (`upgrade --yes --pr`, or `git push` and `gh pr create`) and merging are the user's call.

## Rules

- The upgrade never touches `knowledge/`, `openspec/specs/`, `openspec/changes/` or your settings beyond `kit_version`. Don't touch them while resolving conflicts either.
- Never edit `.specfold/manifest.json` by hand; the upgrade writes it.
- A release can't be fetched or fails its checksum: stop and tell the user. Never install kit files from anywhere else.
