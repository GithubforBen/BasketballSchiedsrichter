<!-- specfold:start -->
@AGENTS.md

## Claude Code

- Plan a change: `claude --agent planner --permission-mode plan`. The planner asks with `AskUserQuestion` and presents its plan through plan approval; it writes the brief only after you approve.
- Slash commands come from `openspec init --tools claude`: `/opsx:explore`, `/opsx:propose`, `/opsx:apply`, `/opsx:archive`.
- Skills live in `.agents/skills/` and reach Claude Code as links in `.claude/skills/`; after adding or removing a skill, run `node scripts/specfold.mjs agents sync`.
- Ask with `AskUserQuestion`: up to 4 questions per call, one decision each, recommended option first.
<!-- specfold:end -->
