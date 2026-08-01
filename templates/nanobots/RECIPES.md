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
{{GATES_LIST}}

## recipe: feature (`enhancement`)

1. Read the work spec + acceptance criteria on the issue; if criteria are missing, stop
   and comment — that's a triage failure, not a license to improvise.
2. Follow the repo's conventions (agent instructions file) over your instincts.
3. Ship with coverage: tests for the new behavior land in the same PR.
4. Gates before pushing:
{{GATES_LIST}}

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

## recipe: escalation (`{{HUMAN_LABEL}}`)

1. Post one crisp comment: the decision needed, 2-3 options with your recommendation
   first, and what's blocked on it. Assign the maintainer.
2. Move to Blocked. Do not partially start the work.

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

## recipe: trusting a gate

A gate that exits `0` has not necessarily checked anything.

1. **A config-level error can make a typechecker exit before checking a single file** and
   still report clean. The same is true of a test runner that matched zero tests.
2. Be suspicious of a clean result you did not expect — especially one that got *faster*.
3. Prefer gates that report what they covered (file counts, test counts) over ones that only
   report success, and treat "0 tests ran" as a failure.
