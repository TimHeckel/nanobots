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
