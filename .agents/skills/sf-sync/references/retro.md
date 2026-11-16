# Retro

The retro is two questions after every archive. The answers improve the next interview, because `sf-interview` reads them from the interview checklist.

## Ask

One call to the native question UI (in Claude Code: `AskUserQuestion`), with two questions:

1. **Asked too late** (header "Too late"): "Which question should the interview for <change> have asked earlier?"
2. **Guessed** (header "Guessed"): "Where did the agent guess instead of asking?"

Each question offers "Nothing this time" and "Skip retro"; the user writes the real answer in their own words through "Other". Without a question UI, ask both in plain text and wait.

A round that comes back empty, timed out or with "Skip retro" counts as skipped.

## Record

1. **Checklist.** For every answer with content, add one line `- <question, in the user's words> (from <change>)` to `knowledge/conventions/interview-checklist.md`, under `## <Topic>` inside `# Convention`. Pick the topic the answer is about (Data, Auth, UI, Migrations, Testing, or a new one) and reuse an existing heading when one fits. If the file does not exist yet, create it first:
   `SPECFOLD_MODEL=<your model id> node scripts/specfold.mjs new Convention conventions/interview-checklist.md --title "Interview checklist" --description "Questions the planning interview should ask, grouped by topic, collected from retros."`
   Then write `# Why` (the retro collects them) and link it from `# Related` to the conventions you know.
2. **Ideas.** An answer that is really a new idea becomes a backlog item: `node scripts/specfold.mjs backlog add "<title>" --origin retro`.
3. **Log.** `node scripts/specfold.mjs log add --kind Retro "<change>: <n> answers"`, or `"<change>: retro skipped"`.
4. Run `node scripts/specfold.mjs index` and `node scripts/specfold.mjs validate`.
