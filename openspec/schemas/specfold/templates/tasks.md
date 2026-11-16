# Tasks

## 1. <!-- Task group name -->

```yaml
files: [<!-- globs this group owns -->]
depends: []
scenarios: [<!-- capability-path#scenario-title --> ]
agent: implementer
```

- [ ] 1.1 <!-- Task description -->
  - Done when: <!-- test, command or scenario id -->

## 2. Knowledge

```yaml
files: [knowledge/**]
depends: [1]
scenarios: []
agent: knowledge-curator
```

- [ ] 2.1 Write the concepts listed in knowledge.md
  - Done when: `specfold validate` exits 0

## Workflow follow-up

- Archive the change, then run `specfold sync <change>` and commit the result in the same PR.
