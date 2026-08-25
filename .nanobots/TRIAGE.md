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
- Anything touching a hard-gate area gets `summon-human`, never auto-dispatch. Per
  `.nanobots/config.json` `hardGates`, currently:
  - the CLI itself (`src/**`) — changes every future install
  - the templates (`templates/**`) — changes what every repo renders
  - packaging and release (`package.json`) — the npm publish surface
  - CI and loop workflows (`.github/**`)
- Max WIP for workers: match `.nanobots/config.json` `wipCap` (currently **1**). Don't
  dispatch past that — this file is a prose mirror of the config value, not a separate
  source of truth; if they ever disagree, config.json wins and this line is stale.
- A scheduled dispatcher cron (`nanobots-worker.yml`, `nanobots-outer.yml`) failing on
  **every** run is exactly as urgent as red `main` CI, even though LOOP-PROMPT.md's Sync
  step is worded around `main` — a cron that always crashes before reaching the code an
  open escalation is about means that escalation can't even be exercised yet. `[distilled
  from 2026-08-02 #8]`
- **This applies to `nanobots-outer.yml` itself, and checking it is not optional.** An
  instant pre-tool-use failure (the model's first turn errors before any tool call or board
  read) leaves no comment, no board change, and no LEARNINGS entry — nothing for a later
  cycle to notice by, because the run dies before reaching the code that would post any of
  those. "No new report since last cycle" is therefore *not* evidence the loop has been idle
  and calm; it is equally consistent with the outer loop itself being down. Confirmed on #20
  (2026-08-25): 28 consecutive scheduled `nanobots-outer.yml` runs failed silently over ~3.3
  days while `main` CI stayed green throughout, so a Sync step that only checks `main` CI
  would have missed it entirely. Pull `gh run list --workflow=nanobots-outer.yml --limit 5`
  every cycle as part of Sync, alongside `main` CI — not only when something already looks
  wrong. `[distilled from 2026-08-25 #20]`

## Flake-judgment refinements

Sharpen the transient-flake exception's four conditions with two things that don't change
the rule itself but change how you read the evidence gathered while applying it:

- **A bundled push (multiple commits, one CI run) means "the prior push was green" is not
  evidence every individual commit in the *next* push was exercised** — GitHub only checks
  the push's head SHA, not each commit separately. Before assuming a red job is a fresh
  regression in the newest commit, check whether the commits under suspicion ever triggered
  their own run. `[distilled from 2026-08-05 #16]`
- **A live-LLM e2e job flaking with a *different* specific failure/assertion each time (not
  the identical failure repeating) across diffs that don't plausibly touch it is itself
  stronger flake evidence than an identical repeat would be** — a deterministic bug
  reproduces identically; nondeterministic model behavior degrades differently each time.
  Don't require the failure shape to match a prior occurrence verbatim before treating a
  recurrence as the same known flake. `[distilled from 2026-08-08 #16]`
- **The exception's four conditions are independent checks, not a single "does this smell
  like the known flaky job" gut call.** A live third-party endpoint can fail in more than one
  shape: transport-level (`fetch failed`, timeout, connection reset, 5xx — qualifies for
  condition 2 as written) vs. behavioral/assertion-level (the model ran fine but its output
  didn't satisfy an assertion — does **not** qualify, even on the exact same job that has
  flaked network-shaped before, and even when the other three conditions and the underlying
  cause both point at nondeterminism). Confirmed on #21 (2026-08-25): `onboarding-agent`
  failed a `set_variable`-count assertion with no network-error text anywhere in the log; 3 of
  4 conditions favored a skip but condition 2's literal wording didn't, so the P0 was filed
  rather than extending the known-flake treatment to a new failure shape unilaterally. If this
  behavioral-flake shape recurs, that is evidence for formally broadening condition 2 — propose
  the edit rather than reading it in silently. `[distilled from 2026-08-25 #21]`

## Merge policy (self-hosting/dogfood repos)

`mergePolicy.protectedBranches` containing the default branch (`main`) plus
`mergePolicy.autoMergeNonProduction: false` is a **blanket defer-to-human** switch, not a
narrow one scoped to PRs that edit branch-protection config. Since virtually every real PR
targets `main`, that combination means LOOP-PROMPT.md step 4's "anything touching
`mergePolicy.protectedBranches` → request human review, move to Verify" applies to *every*
PR while this repo dogfoods itself — a bad merge here ships a broken install to every future
`npx nanobots-sh init`. Check `autoMergeNonProduction` and the actual base ref before
assuming a clean S/M item auto-merges; `docs/e2e-harness.md` states this repo's own intent
plainly ("every PR waits for you"). `[distilled from 2026-08-02 #2/PR #9]`

## Source weighting

Not all signals are equal. Current weights (revise via LEARNINGS):

1. Maintainer's direct asks — highest
2. Production errors / failing `main` CI
3. User-filed bugs (severity as reported, verify before trusting "critical")
4. Feature requests with clear problem statements
5. Loop-generated chores (hardening, test gaps, doc drift) — cap at ~30% of dispatched
   work so the loop doesn't disappear into self-referential cleanup
