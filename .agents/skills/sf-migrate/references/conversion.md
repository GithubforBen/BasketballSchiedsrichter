# Conversion rules

Every concept is created with `SPECFOLD_MODEL=<your model id> node scripts/specfold.mjs new <type> <path> --title "<title>" --description "<one line, max 160 characters>"`, then given a body and `sources`. Paths in `sources` are relative to the concept file, so a concept in `knowledge/decisions/` points at `../../docs/adr/0001-x.md`.

```yaml
sources:
  - id: adr-0001
    resource: ../../docs/adr/0001-use-postgres.md
```

Summarize; do not copy. A concept says what was decided or agreed and why, in a few lines, and its source keeps the full text.

## By source kind

- **ADR → `Decision`.** The title is the decision, and `# Decision` and `# Why` summarize the ADR's Decision and Context. Map the ADR status to `decision:`:
  - accepted → `accepted`;
  - rejected → `rejected`;
  - superseded or deprecated → `superseded`, plus `status: deprecated`, with a link to the successor's concept in `# Related`;
  - proposed, or no status: not a decision yet. Ask the user at the plan checkpoint whether it is accepted, or whether it stays `keep`.

  The successor names a superseded decision in its text instead of linking it, because a link to a deprecated concept is an audit finding (A3); the superseded concept then shows up as unlinked (A4), which the report lists for review.
- **Agent rule file → `Convention`** (`.cursor/rules/*.mdc`, `.github/copilot-instructions.md`, `.windsurfrules`, a team's `AGENTS.md` rules). One concept per topic, not per file. The rule file stays where it is: other tools still read it.
- **Existing `## graphify` section** in `AGENTS.md` or `CLAUDE.md`: list it in the plan. After install, merge its advice into the lookup order inside the Specfold block, and remove the duplicate section only if the plan row says so.
- **`docs/` page** → the type its plan row names: architecture pages become `Component` or `Data Flow`, setup and operations pages `Runbook`, glossaries `Term`, product rules `Business Rule`.
- **README and CONTRIBUTING** usually stay (`keep`). Contribution rules that agents must follow become a `Convention`.
- **Another spec tool** (`openspec/specs/`, `.specify/`, `.kiro/specs/`): one `Capability` card per spec or feature folder, with `resource` pointing at it. No bulk conversion: list each one in the report as a migration candidate. An existing `openspec/` stays as it is; install only made `specfold` the default schema for new changes.

## Existing bundle

When the inventory lists `okf-concept` sources, `knowledge/` already holds a bundle. Work through the mapping rows:

- **One new concept per original**, created with `specfold new` in the folder of its target type (`decisions/`, `runbooks/`, `domain/`, `architecture/` ...), with the type from the type map. Keep the full rationale: rewrite the frontmatter and headings for the target type, but do not shorten the body. An ADR's status maps to `decision:` as above.
- **`sources` point at the original at the migration's base commit.** With a GitHub `origin` (`git remote get-url origin`), use `https://github.com/<owner>/<repo>/blob/<base>/<path>`, where `<base>` is the base commit `migrate status` shows; otherwise use the original path and name the base commit in the report.
- **Remove the original** once its rewrite exists (`git rm`). The hooks only warn about broken links and unchanged originals until `migrate mark convert`, so commit as you go.
- **Rewrite links and references.** For every moved concept, `git grep -n "<old path>"` (and the bundle-absolute form `/<old path without knowledge/>`) and replace each hit, inside and outside the bundle: concept links, `see knowledge:` comments, AGENTS.md, READMEs, scripts. List every file you touched in the report.
- **Indexes.** Run `node scripts/specfold.mjs index`; it replaces every hand-written `index.md`. Before that, move intro text that holds knowledge into a concept (for example an architecture overview), and a one-line folder summary into that folder's `description` in `specfold.yaml`. The report says where each piece went. `log.md` keeps its entries; add the migration entry with `log add`.
- **Team rules.** Apply the plan's team-rules rows: delete the `remove` rules from the team's text, write each `Convention` with `specfold new`, and leave the `keep` rules below the Specfold block.
- **Tooling.** Remove what the plan marks `remove` (an OKF skill folder, a validator script, a hook manager step running it), and nothing else.
- **Settings.** Drop types and folders from `specfold.yaml` that no concept uses any more.

The conversion is done when every "After conversion" item is, `git grep` finds no old path, and `node scripts/specfold.mjs validate` passes. Then run `migrate mark convert`.

## Seed from code

Up to the cap in the plan (default 30), across all three kinds:

- **`Component`**: one per top-level module or package in `source_globs`, with `resource` pointing at its folder. With `graphify-out/GRAPH_REPORT.md` present, use its communities instead of guessing.
- **`Interface`**: public APIs, CLIs or events that other code or other systems use.
- **`Term`**: domain names that appear across modules (entities, states), one line each.

Prefer fewer, accurate concepts over many thin ones. Stop at the cap even if more would fit, and name what was left out in the report.

## Code comments

Long rationale comments in code (several lines explaining why) belong in knowledge, but the migration never moves them. List each with `path:line` in the report, so a later change can capture it with `sf-capture` and leave a `see knowledge:` pointer.
