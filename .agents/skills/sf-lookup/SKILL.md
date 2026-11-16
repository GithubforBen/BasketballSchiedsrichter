---
name: sf-lookup
description: Look up project knowledge before exploring, proposing or answering "why does X exist" or "what is Y" questions. Searches knowledge/ with specfold lookup, reads the 1-3 best concepts and reports their trust level.
---

# sf-lookup

Use this before `/opsx:explore` or `/opsx:propose`, before changing code you don't know, and whenever someone asks why something is the way it is or what a term means.

## Steps

1. Run `node scripts/specfold.mjs lookup <words>` with 1-4 words from the question. Add `--type <Type>` to narrow it down (for example `--type Decision`).
2. Read the 1-3 best hits in full; stop when the question is answered. Follow links in their `# Related` sections only when needed.
3. For behavior, read the spec instead: `openspec show <spec> --type spec --json --no-scenarios`.
4. Answer with the concept paths you used and their flags:
   - `deprecated`: superseded; say what replaced it if the concept says so.
   - `stale`: past its review date; treat it as possibly outdated.
   - `drift`: a file it describes changed after it was last written or verified; check it against that file (`node scripts/specfold.mjs drift <path>` names the commits).
   - `unverified`: written by an agent and not yet confirmed by a human.

After the hits, lookup lists the vision and the open commitments under "vision and open commitments:". That block is context for planning, not an answer. Mention a commitment the work could affect. A vision without `verified` is still a draft.

## Rules

- Knowledge says why and what; specs say how the system must behave. When they disagree, the spec wins, and you report the conflict instead of picking a side.
- A rejected decision (`decision: rejected`) that covers the idea must be named, together with its reason.
- No hit means the knowledge does not exist yet. Say so; don't guess. The `sf-capture` skill records it once it is known.
- Read raw files and grep only after lookup, the code graph (if installed) and specs have not answered the question.
