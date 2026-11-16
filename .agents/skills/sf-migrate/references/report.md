# Migration report template

Write `.specfold/migration/report.md` after validation passes.

```markdown
# Migration report: <repository name>

## Result

- Branch: specfold/migration (from <default branch> at <base commit>)
- Kit: <kit_version> from <ref, or the template folder>
- Concepts written: <n> (<n> Decision, <n> Convention, ...), all draft
- Seeded from code: <n> of the cap <cap>
- Checks: specfold validate, specfold index --check and openspec validate --strict pass
- Always loaded: <n> tokens (estimate from specfold stats); budgets exceeded: <none, or each with its tokens and limit>

## Needs human verification

<!-- Every concept written, one line each; a human runs `specfold verify <path>` after reading it. -->
- knowledge/decisions/x.md (from docs/adr/0001-x.md)

## Install conflicts

none   <!-- or each conflict and what the user decided -->

## Migration candidates

<!-- Specs of other tools that stay as they are for now. -->
none

## Rationale comments in code

none   <!-- or path:line, one per comment -->

## Existing bundle

none   <!-- or: originals rewritten and removed (<n>), each original -> its new path; where index intro text went; tooling removed; types and folders dropped -->

## References rewritten

none   <!-- or each file outside the bundle whose references to moved concepts were rewritten -->

## Deviations

none   <!-- or every place the migration did something the plan did not say, and why the user agreed -->

## Left out

<!-- Sources marked ignore or keep, and seed candidates beyond the cap. -->

## Open questions

none
```
