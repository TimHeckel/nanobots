<!-- nanobots:repo-owned — this file belongs to your repo's loop; `nanobots update` never touches it. The loop itself amends it via distill passes. -->
# Triage Rubric (outer loop policy)

How the outer loop turns raw signals into prioritized, dispatchable work. This is a living
policy document — the outer loop updates it when a triage decision turns out wrong
(record the correction in LEARNINGS.md first, then amend the rubric).

## Intake → Triage checklist

For every item in **Inbox** (label `nanobots:inbox`):

1. **Dedupe.** Search open issues (`gh issue list --search`) for the same symptom or ask.
   Duplicate → comment with the canonical issue, label `duplicate`, close, remove from board.
2. **Classify.** Ensure exactly one of `bug` / `enhancement` / `chore`.
3. **Clarify or reject.** If the item is too vague to write acceptance criteria, comment
   with the specific questions, label `needs-info`, move to **Blocked**. If it conflicts
   with the repo's direction (see the agent instructions file), explain why and close as
   `wontfix`.
4. **Score** (see below) and set `Priority` + `Size` on the board.
5. **Write the work spec** as a comment on the issue (the worker's brief):
   - Acceptance criteria (observable behavior, not implementation)
   - Test expectations (every change ships with coverage)
   - Pointers: relevant files, docs, prior PRs, gotchas from LEARNINGS.md
6. **Decide the dependency shape.** Prefer work items that are **independently mergeable
   where that is natural** — it produces better specs and simpler review. But a dependent
   item (B needs the type/migration/helper A introduces) is **not a triage failure**; it is a
   supported shape now that GitHub stacks PRs natively. Choose one:
   - **Independent** — default. Split so each item stands alone.
   - **Sequenced** — B stays in Backlog until A merges. Simplest, costs throughput.
   - **Stacked** — only when `stacks.enabled` is on in `.nanobots/config.json`. B's PR targets
     A's branch; the outer loop owns the topology (see LOOP-PROMPT.md). Cap at
     `stacks.maxDepth`; deeper means re-split. Same-repository only — a fork-based
     contribution cannot be stacked.

   Record which shape you chose **and why** in the work spec, and note the outcome in
   LEARNINGS.md — whether stacking actually paid for itself here is exactly the kind of
   judgment the distill pass should sharpen over time.

7. **Move to Ready** (or **Backlog** if scored below the line).

## Scoring

`Priority = Impact × Confidence ÷ Effort`, expressed as buckets, not false-precision numbers.

**Impact**
- P0 — data loss, security, payments, production down, blocking the maintainer's active work
- P1 — feature unusable, wrong output shipped to users
- P2 — meaningful UX/quality improvement, perf, recurring friction
- P3 — polish, nice-to-have, speculative

**Size** (drives dispatch, not priority)
- S — single-file or config change, low blast radius
- M — multi-file, one subsystem, needs tests
- L — cross-cutting, schema change, or new service — needs a design comment approved by a
  human before dispatch
- XL — do not dispatch; break into child issues first

**Hard rules**
- P0 jumps the queue; ping the maintainer immediately (issue comment + assign) rather than
  silently working.
- Anything touching a hard-gate area gets `summon-human`, never auto-dispatch:
  - (none configured)
- Max WIP for workers: **2** items In Progress at once. Don't dispatch past that.

## Source weighting

Not all signals are equal. Current weights (revise via LEARNINGS):

1. Maintainer's direct asks — highest
2. Production errors / failing `main` CI
3. User-filed bugs (severity as reported, verify before trusting "critical")
4. Feature requests with clear problem statements
5. Loop-generated chores (hardening, test gaps, doc drift) — cap at ~30% of dispatched
   work so the loop doesn't disappear into self-referential cleanup
