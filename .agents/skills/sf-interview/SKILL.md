---
name: sf-interview
description: Run the planning interview at the start of every change. Ground in knowledge and specs, ask every open decision with the tool's native question UI, then write brief.md only after the user approves. Rather ask than assume.
---

# sf-interview

Use this at the start of every change, inside `/opsx:explore` or before `/opsx:propose`, and whenever the `brief` artifact is next. No spec is written until you can restate the user's wish and the user confirms it.

## Steps

1. **Ground first.** Use `sf-lookup` and `openspec list --specs` / `openspec show` to learn what exists. Never ask what you can verify yourself, and name any rejected decision that touches the idea. Keep the vision and the open commitments lookup shows in mind; a change must not quietly break a promise.
2. **Build the design tree:** outcome and scope first, then behavior, edge cases, constraints and non-functional needs. Each decision opens the ones that depend on it. Details: [references/design-tree.md](references/design-tree.md). If `knowledge/conventions/interview-checklist.md` exists, add the questions from its `## <Topic>` sections that touch this change as extra branches. They are what earlier retros said came too late.
3. **Ask in rounds** through the tool's native question UI (in Claude Code: `AskUserQuestion`, up to 4 questions per call, 2-4 options each, header at most 12 characters):
   - one decision per question;
   - the recommended option first, marked "(Recommended)", with a one-line reason;
   - the user can always answer in their own words.

   Without such a UI, ask in plain text: one decision per line, each with your recommendation.
4. **Never treat a missing answer as consent.** If an answer comes back empty or timed out, stop and ask again later. Don't decide on your own.
5. **Record, don't infer.** Keep every answer. "Whatever you think" becomes a delegated decision with your choice spelled out.
6. **Offer what is out of scope.** For everything the user put out of scope, ask one question each: keep it as a backlog item, record it as a deferred commitment ("not now, but we must before X"), or drop it. Write nothing yet.
7. **Close with a plan for approval.** When no open branch would change a requirement, present:
   - the wish in the user's words;
   - every decision with its source;
   - what is out of scope, and which of it becomes a backlog item or commitment;
   - the proposed change boundaries.

   In Claude Code use plan approval (`ExitPlanMode`); elsewhere show it as text and wait for an explicit "approve". Corrections start another round.
8. **Write `brief.md` only after approval,** from the schema template (`openspec instructions brief --change <name>`). Fill `Confirmation` with `human:<login>` and the approval time in ISO 8601 with offset, and only because they approved. Ask the user to state their login as part of approving; never take it from earlier briefs or the git config.

Then run `node scripts/specfold.mjs change check <change>`. Only the brief rules matter at this point.

After approval, also write what step 6 decided: `node scripts/specfold.mjs backlog add "<title>" --origin interview` for each backlog item, and `node scripts/specfold.mjs new "Deferred Commitment" commitments/<name>.md` for each commitment, with its `trigger`. Leave `committed_by` out; the person who commits adds it, and the gate checks it.

## Knowledge profile

When `specfold.yaml` sets `profile: knowledge`, there are no specs, changes or `brief.md`. Ground with `sf-lookup` only, then run steps 2-7 the same way; present the plan in step 7 as text or through plan approval. After approval, record each decision that will outlast the task as a concept with `sf-capture` (a Decision, Business Rule or Convention, `status: draft`), and write the step 6 backlog items and commitments as above. Answers that only matter for this task stay in the conversation.

## Rules

- Questions are never a numbered list for the user to answer in prose when a native question UI exists.
- An open question may stay in the brief only with an owner and a reason it does not block the spec: `- <question> (owner: <actor>) <why>`.
- During implementation the same rule holds: on ambiguity, stop the task, ask, and record the answer in `brief.md` (and in the delta spec if behavior changes).
- Changes with `skip_specs: true` may use a short brief: Wish and Confirmation.
