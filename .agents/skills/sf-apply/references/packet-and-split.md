# Task packets and split proposals

## The packet

`node scripts/specfold.mjs tasks packet <change> <group>` prints one group's packet: its tasks with their `Done when:` lines, the files it owns, the groups it depends on, the text of each linked scenario, the brief's wish and decisions, the concepts the proposal links, and the rules (one commit per task with `Task: <change>#<n>.<m>`, only the owned files, split instead of grow). Pass it to the implementer unchanged.

## A split proposal

An implementer stops and ends with:

```
SPLIT PROPOSAL
task: 2.3
needs: src/todo.js, for a one-line export the import module calls
proposal: new group "Export hook" owning src/todo.js, depends [], task "export the item factory"; group 2 then depends on it
done so far: branch worktree-agent-a52181cc, commits for 2.1 and 2.2
```

## Handling it

1. Keep what is done: merge the implementer's branch if its finished tasks pass on their own, or set it aside to continue later.
2. Start `spec-writer` with the proposal and the change name. It reshapes `tasks.md`: the new or changed group, updated `depends`, finished tasks untouched, parallel groups still on disjoint files.
3. If the proposal changes what the change delivers (a new capability, a dropped task, files outside the brief's scope), ask the user before dispatching, one decision per question.
4. Run `node scripts/specfold.mjs tasks check <change>`; it must pass.
5. Dispatch the new group, then the waiting one, with fresh packets.
