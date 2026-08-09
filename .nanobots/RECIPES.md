<!-- nanobots:repo-owned — this file belongs to your repo's loop; `nanobots update` never touches it. The loop itself amends it via distill passes. -->
# Recipes (per-task-type playbooks)

A recipe packages what the loop has learned about executing one *kind* of work item:
the steps, the gates, and the known traps. The dispatch step picks the recipe by issue
type and pastes it into the worker's brief. When a LEARNINGS entry generalizes, fold it
into the recipe here.

---

## recipe: bug-fix (`bug`)

1. **Reproduce first.** Write the failing test before touching product code. If
   unreproducible, report back to the issue with what was tried — do not "fix" blind.
2. Root-cause, don't symptom-patch. State the root cause in the PR description.
3. Fix + keep the repro test as the regression test.
4. Gates before pushing:
   - `npm run test`

## recipe: feature (`enhancement`)

1. Read the work spec + acceptance criteria on the issue; if criteria are missing, stop
   and comment — that's a triage failure, not a license to improvise.
2. Follow the repo's conventions (agent instructions file) over your instincts.
3. Ship with coverage: tests for the new behavior land in the same PR.
4. Gates before pushing:
   - `npm run test`

## recipe: chore / hardening (`chore`)

1. Confirm the chore is still real (code moves fast; the issue may be stale).
2. Smallest clean change wins.
3. Behavior-preserving refactors need the existing tests green before AND after; if the
   area is untested, add characterization tests first.

## recipe: triage-only (outer loop, no code)

1. Follow TRIAGE.md exactly.
2. Never write acceptance criteria you couldn't verify mechanically or by observing the
   running app.
3. When rejecting/deferring, always say why on the issue — the issue thread is the UI for
   humans in this system.

## recipe: escalation (`summon-human`)

1. Post one crisp comment: the decision needed, 2-3 options with your recommendation
   first, and what's blocked on it. Assign the maintainer.
2. Move to Blocked. Do not partially start the work.
3. Confirmed working as intended for hard-gate edits (#5, 2026-08-01): the maintainer adopted
   the recommended option verbatim and closed same day. Keep this shape as the default rather
   than second-guessing it. `[distilled from 2026-08-01 #5]`

## recipe: posting a plan comment (versioned-start approval)

`daytona-worker.mjs` finds a plan by a literal regex against comment bodies — "the hash
appears somewhere in the comment" is not the acceptance criterion, "the exact
`<!-- nanobots:plan issue=N hash=... -->` marker is the comment's final line" is. Before
trusting that a plan exists (yours or a prior cycle's), grep the actual comment body for the
literal marker regex; don't infer it from prose that merely mentions the hash.
`[distilled from 2026-08-01 #2]`

## recipe: touching the GitHub API (loop or worker code)

Footguns that each shipped as a real bug in a production loop of this shape. Apply them
whenever loop or worker code talks to the GitHub API — most cost one line to get right and
are expensive to find later.

1. **Identify a PR by head ref _and_ head repository.** A fork's PR can carry the identical
   branch name as a deterministic automation branch. Matching on the ref alone lets automation
   comment on, close, update, or merge a stranger's work.
2. **Never trust a PR number that was reported to you.** If a worker says "I opened PR #412"
   and nothing verifies it, you will act on whatever PR that number names. Read it back and
   confirm its head belongs to this run.
3. **An empty list response is truthy.** `GET /git/refs/heads/<branch>` can answer `200 []`.
   `if (result)` reads that as "the ref exists". Check
   `Array.isArray(x) ? x.length > 0 : Boolean(x)`.
4. **`422` is not "already absent".** GitHub also returns it for protected refs and abuse
   protection. Verify absence before recording a deletion as done.
5. **If you add ref cleanup, capture abandoned refs in the same step that drops them.** When a
   run is requeued or cancelled and its branch/PR references are cleared, nothing remembers
   what was left open — and nothing can clean up what nothing remembers.
6. **Never queue cleanup for a ref that will be reused.** If a retry reuses the same
   deterministic branch name, queuing that branch for deletion can delete the *replacement*
   run's live branch.
7. **Distinguish a config gap from a transient failure.** "Not configured" should fail loudly
   and stay failed; a transient API error must retry, or one brief GitHub outage permanently
   strands every task it touched.
8. **When fixing a bug in an engine file this repo dogfoods on itself, diff the installed
   copy (`.nanobots/*`) against its template source (`templates/nanobots/*`) — they must stay
   byte-for-byte identical.** A fix applied to only one copy looks done (this repo's board and
   CI go green) but ships nothing to future `npx nanobots-sh init` installs, or vice versa.
   `ci.yml`'s drift check catches this on the next push, but checking by hand during review
   catches it immediately. `[distilled from 2026-08-02 #7, #8]`
9. **A board item stuck in a status the code should have moved it out of is a symptom, not
   just a stale-claim case.** Verify the code path, field IDs, and query in isolation before
   trusting either "the board is right" or your own guess at what status it should be —
   reconcile the board by hand and file a chore to find the root cause rather than silently
   re-deriving the status with no paper trail. `[distilled from 2026-08-02 #2/PR #9]`
10. **A board item stuck `In Progress` with a dead sandbox and no completion comment is a
    symptom, not the bug.** Read the actual Actions run logs, and cross-check how many PRs
    exist and who authored them — a cheap, high-signal sanity check for "is the core pipeline
    working at all" that's easy to skip when triaging item-by-item. `[distilled from
    2026-08-02 #7]`
11. **Every review-outcomes pass, diff board status against live issue/PR state for *every*
    non-Done item — not only ones that already look stuck.** Nothing moves a board item when
    a merge, a maintainer direct-commit, or a maintainer-driven close happens outside the
    loop's own dispatch path (board changes can't fire repo workflows; the loop only polls on
    its cadence). This has recurred on five separate occasions (`#5`/2026-08-01,
    `#2`/PR #9/2026-08-02, `#6`+`#10`/2026-08-02, `#11`/PR #12/2026-08-02, `#16`/2026-08-09) —
    each time the issue or PR was already resolved on GitHub and only the board field was
    stale. Treat this as the default first check on every non-Done item, not a special case
    you reach for only when something already looks wrong. `[distilled from 2026-08-02
    #2/PR #9, #6/#10, #11/PR #12; 2026-08-09 #16]`
12. **A scheduled dispatcher cron failing is worth one cheap manual retry before treating it
    as the same severity as red `main` CI.** A `workflow_dispatch` re-run of the same workflow
    is a safe, evidence-gathering probe — but only when nothing has an active `/nanobots
    start` approval that a manual dispatch could race into a duplicate real claim. If the
    manual retry comes back clean, log it as a transient infra blip (e.g. GitHub-hosted-runner
    capacity) rather than escalating; if the *same* job keeps flaking across multiple cycles,
    that crosses into "file a chore to make it resilient" per TRIAGE.md, not another silent
    retry. `[distilled from 2026-08-06]`

## recipe: trusting a gate

A gate that exits `0` has not necessarily checked anything.

1. **A config-level error can make a typechecker exit before checking a single file** and
   still report clean. The same is true of a test runner that matched zero tests.
2. Be suspicious of a clean result you did not expect — especially one that got *faster*.
3. Prefer gates that report what they covered (file counts, test counts) over ones that only
   report success, and treat "0 tests ran" as a failure.
