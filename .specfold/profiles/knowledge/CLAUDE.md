@AGENTS.md

## Claude Code

- Skills live in `.agents/skills/` and reach Claude Code as links in `.claude/skills/`; after adding or removing a skill, run `node scripts/specfold.mjs agents sync`.
- The `scout` subagent answers one question from the knowledge and the code without filling the main session.
- Ask with `AskUserQuestion`: up to 4 questions per call, one decision each, recommended option first.
