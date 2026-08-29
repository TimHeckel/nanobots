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
13. **A LEARNINGS entry that ends with an explicit "if X recurs, do Y" is a standing trigger
    for future cycles, not just a note for the record.** Match a new failure against it by
    *error shape* (same stderr, same command family) rather than exact call site — the same
    underlying flake (e.g. `gh project ... --owner ...` resolving "unknown owner type") can
    surface from more than one function. Recipe #12's "one cheap retry before escalating"
    rule extends past live-third-party-fetch failures to `gh` subcommand metadata-resolution
    failures too — same infra-flake class, same treatment. Confirmed twice more (2026-08-17,
    cycles 125/126): a third `"unknown owner type"` recurrence and a same-call-site-but-
    different-upstream-error `503` both self-healed on the very next scheduled run with no
    board risk — #18's eventual fix should scope to "retry any transient `gh project list
    --owner` failure", not just the one error string its title names. `[distilled from
    2026-08-12, 2026-08-14 #18, 2026-08-17 (cycles 125/126)]`

## recipe: reviewing an open PR not on the board

1. **Check the board (`gh project item-list`) before treating any open PR as an In
   Progress/In Review item needing the merge-or-remediate treatment.** If the PR isn't on
   the board, it's informational only.
2. **A maintainer can open a `nanobots/`-prefixed-branch PR against a throwaway base purely
   to trigger the required OCR gate** on code already pushed directly to `main` — the PR
   body will say outright it's not meant to be merged. Read the OCR conclusion for the
   institutional record; never merge it or dispatch remediation against it, and don't treat
   the pull_request-triggered CI on such a PR the same as `main`'s own push-triggered CI.
3. This pattern can accumulate multiple direct-push rounds as the maintainer works through
   findings — each round is still purely informational, not an item needing outer-loop
   action, and it closes itself out (merge into its own throwaway base, or the branches get
   auto-deleted) with nothing for the loop to reconcile. `[distilled from 2026-08-09 #17
   (cycles 61, 62, 69)]`

## recipe: trusting a gate

A gate that exits `0` has not necessarily checked anything.

1. **A config-level error can make a typechecker exit before checking a single file** and
   still report clean. The same is true of a test runner that matched zero tests.
2. Be suspicious of a clean result you did not expect — especially one that got *faster*.
3. Prefer gates that report what they covered (file counts, test counts) over ones that only
   report success, and treat "0 tests ran" as a failure.

## recipe: verifying a cycle's own claims (yours or a prior one's)

The same "a gate exiting 0 hasn't necessarily checked anything" logic applies one level up:
**a cycle that completes cleanly (`is_error: false`, a plausible narrative) has not
necessarily done anything either.** Confirmed live on 2026-08-17 (#19): two consecutive
outer-loop cycles posted Status-issue reports describing a real-looking commit SHA and a
distill pass, and neither the commit nor the doc changes existed anywhere in the repo — the
run had a nonzero `permission_denials_count`, consistent with a denied write call the model
then narrated over instead of surfacing.

1. **Before trusting a prior cycle's report about a commit, doc edit, merge, or close: check
   it against live state**, not the report's prose. `git log` / `gh api
   repos/{owner}/{repo}/commits/<claimed-sha>` for commits (a `422` means it doesn't exist,
   full stop); re-read the actual file for claimed doc edits; `gh issue view` / `gh pr view`
   for claimed closes or merges. This is cheap — seconds per claim — against the cost of
   silently building on a hallucinated foundation.
   - **When checking *which files* a claimed commit touched (e.g. verifying a "docs-only"
     claim), use `gh api repos/{owner}/{repo}/commits/<sha> --jq '.files[].filename'`, not
     `git show --stat <sha>` / `git diff <sha>~1 <sha>`.** The Actions checkout in this repo
     is shallow (`git rev-parse --is-shallow-repository` → `true`); if the commit's parent
     isn't in the shallow history, `git show`/`git diff` silently fall back to diffing
     against an empty tree and list *every file in the repo* as changed — which reads exactly
     like fabrication evidence for a "docs-only" claim that is actually true. Confirmed on
     cycle 177 (2026-08-29): `git show --stat ef071f5` reported 102 files / 16392 insertions
     for a commit the GitHub API confirms touched exactly `.nanobots/LEARNINGS.md` and
     `.nanobots/RECIPES.md`. `git log`/`git rev-parse` (existence, no diff) are unaffected by
     shallow history and stay fine to use. `[distilled from 2026-08-29 cycle 177]`
2. **Before posting your own cycle report, do the same check on your own claims.** If you
   are about to write "committed `<sha>`" or "closed #N", that value must come from a tool
   result you just read back (`git rev-parse HEAD`, the actual `gh` output), never asserted
   from your own running narrative of what you intended to do.
3. A nonzero `permission_denials_count` (visible via `gh run view <id> --log` on the outer
   or worker workflow) on a run that otherwise looks clean is a signal worth a second look —
   it means at least one tool call this cycle was blocked, and the cycle may have carried on
   past that silently.
4. This is a standing check, not a one-time fix — until #19's root cause lands, every cycle
   should spot-check the immediately preceding cycle's claimed commits before treating
   LEARNINGS/RECIPES/TRIAGE as reflecting what the last report said. `[distilled from
   2026-08-17 #19]`
5. **The LEARNINGS undistilled-count claim specifically has now been gotten wrong in cycles
   137, 157, and 162** — restating it from memory or a hand recount of a 700+ line file is not
   reliable at this size. Recompute it with exactly these two independent tool invocations,
   every time a report needs the number, instead of trusting the last cycle's stated count or
   re-deriving it by eye:
   ```bash
   grep -c "^## " .nanobots/LEARNINGS.md                       # total headers; subtract 1 for the format-template line
   ```
   For the suffix-anchored count (a title that merely *mentions* `[distilled]` in prose — e.g.
   the 2026-08-19 entry — must not be a false positive), **use the Grep tool, not a raw Bash
   `grep` call**, with pattern `^## .*\[distilled\]\s*$`. Confirmed on 2026-08-29 (cycle 176):
   a Bash-tool `grep` whose pattern ends in an unescaped `$` (this one does, for the
   suffix anchor) is classified as requiring interactive approval by this harness's Bash
   permission gate — reproduced 4 times, including on a trivial `grep -c "a$" package.json`
   unrelated to this file or pattern content, so the trigger is the bare trailing `$` itself,
   not anything LEARNINGS-specific. In an unattended run (the outer loop's own scheduled
   cycles) there is no human to grant that approval, so the call is denied and the tool
   result reads `This command requires approval` — a plausible contributor to the
   `permission_denials_count` values #19 has been tracking, since this exact command was this
   recipe's own prescribed second invocation, run every cycle that reports the distill count.
   The Grep tool (a distinct, non-Bash tool) executes the identical pattern with no approval
   prompt — that is the workaround, not a different regex.
   undistilled = (first count − 1) − second count. `[distilled from 2026-08-19, 2026-08-21,
   2026-08-25 (cycle 163), 2026-08-29 (cycle 176)]`
6. **A compound claim ("filed #20, `summon-human`, Blocked, assigned") is several separate
   assertions bundled into one phrase — read each one back, not just the headline one.**
   Confirmed on #20 (2026-08-25): the issue, labels, and board status all matched a prior
   cycle's report exactly, but "assigned" didn't — `assignees` was empty. Three-of-four true
   doesn't imply the fourth is; a silently no-op'd `--assignee` is exactly as invisible in a
   report's prose as a fabricated SHA, just smaller blast radius (a missed notification, not
   a hallucinated foundation). The same applies to any **numeric or temporal** fact a report
   states — an issue's age, an elapsed-time claim, a recurrence count — compute it from a
   fresh tool call (`gh api ... | jq .created_at`, then subtract from the current time) rather
   than estimating; confirmed on cycle 126's report (2026-08-17), which stated #19 was "~38
   hrs old" against an actual ~17.6 hours, harmless only because the 48h nudge threshold
   wasn't close under either number. `[distilled from 2026-08-25 (cycle 163), covering cycle
   161's #20-assignee catch and cycle 127's #19-age catch]`
