<!-- nanobots:repo-owned — this file belongs to your repo's loop; `nanobots update` never touches it. -->
# Loop Learnings (append-only)

The outer loop's memory. After every completed or failed work item, append an entry.
Newest first. Every ~10 entries, run a **distill pass**: promote durable lessons into
TRIAGE.md, RECIPES.md, or the repo's agent instructions file, then mark the source
entries `[distilled]`. Never delete entries — this file is the audit trail of what the
loop learned and why.

Entry format:

```
## YYYY-MM-DD — <issue #> <short title>
- **Outcome:** merged / reverted / abandoned / escalated
- **What worked / what didn't:** 1-3 bullets
- **Lesson:** the reusable rule, stated so a future triage or build session can apply it
- **Applies to:** triage | build | review | verify | prompt
```

---

## 2026-09-01 — #19: denial-count check found a new low (1) on cycle 187's run, report still clean (cycle 188)
- **Outcome:** n/a (not a dispatched item; posted cycle 187's denial count to #19, no status
  change — board and all four blocked issues still `summon-human`/Blocked awaiting the
  maintainer)
- **What worked / what didn't:** re-verified cycle 187's report (`b333173`) against live
  state first, per the standing recipe — `gh api .../commits/b333173 --jq
  '.files[].filename'` confirms exactly `.nanobots/LEARNINGS.md` (single file), matching the
  docs-only claim; board unchanged (8/12 Done, 4 Blocked); #18/#19/#20/#21 last-comment
  authors/bodies all still the loop's own prior posts (or, for #20, still zero comments —
  the original P0 filing lives in the issue body, not a comment), no maintainer replies. No
  fabrication. Pulled cycle 187's own run (`33438151080`) denial count same cycle via
  `gh run view <id> --log | grep permission_denials_count`: `permission_denials_count: 1` —
  a new low, below cycle 184/186's prior low of 2. Full sequence: 168-170: 3-5, 171: 8,
  172: 8, 173: 5, 174: 7, 175: 10, 176: 12, 177: 5, 178: 2, 179: 4, 180: 3, 181: 14, 182: 6,
  183: 6, 184: 2, 185: 3, 186: 2, 187: **1**. Recomputed the undistilled count per
  RECIPES.md's two-command formula: 53 total headers (52 entries) minus 47
  `[distilled]`-suffixed = 5 undistilled — well under the ~10 threshold, no distill pass
  this cycle. No open PRs, no `nanobots:inbox` items, `main` CI green on the current head,
  both scheduled crons (`nanobots-outer.yml`, `nanobots-worker.yml`) healthy over their
  last 5 runs, nothing to triage or dispatch (WIP 0/1).
- **Lesson:** the count keeps drifting to new lows and highs across cycles with no
  correlation to report accuracy, exactly as RECIPES.md's point 3 already concludes — one
  more confirming data point (this time at the low end of the observed 1-14 range), no new
  finding.
- **Applies to:** triage | verify

## 2026-08-31 — #19: denial-count check continued cleanly this cycle — cycle 186's run posted at 2 (cycle 187)
- **Outcome:** n/a (not a dispatched item; posted cycle 186's denial count to #19, no status
  change — board and all four blocked issues still `summon-human`/Blocked awaiting the
  maintainer)
- **What worked / what didn't:** re-verified cycle 186's report (`82afd34`) against live
  state first, per the standing recipe — `gh api .../commits/82afd34 --jq
  '.files[].filename'` confirms exactly `.nanobots/LEARNINGS.md` (single file), matching the
  docs-only claim; board unchanged (8/12 Done, 4 Blocked); #18/#19/#20/#21 last-comment
  authors/bodies all still the loop's own prior posts (or, for #20, still zero comments —
  the original P0 filing lives in the issue body, not a comment), no maintainer replies.
  No fabrication. Pulled cycle 186's own run (`33399142300`) denial count same cycle via
  `gh run view <id> --log | grep permission_denials_count` (the Actions API's run object has
  no such field; the count only appears in the action's own log output):
  `permission_denials_count: 2` — tied with cycle 184's low. Full sequence: 168-170: 3-5,
  171: 8, 172: 8, 173: 5, 174: 7, 175: 10, 176: 12, 177: 5, 178: 2, 179: 4, 180: 3, 181: 14,
  182: 6, 183: 6, 184: 2, 185: 3, 186: **2**. Recomputed the undistilled count per
  RECIPES.md's two-command formula: 52 total headers (51 entries) minus 47
  `[distilled]`-suffixed = 4 undistilled — well under the ~10 threshold, no distill pass
  this cycle. No open PRs, no `nanobots:inbox` items, `main` CI green on the current head,
  both scheduled crons (`nanobots-outer.yml`, `nanobots-worker.yml`) healthy over their
  last 5 runs, nothing to triage or dispatch (WIP 0/1).
- **Lesson:** the count keeps oscillating in the same low-single-digit-to-teens band with no
  correlation to report accuracy, exactly as RECIPES.md's point 3 already concludes — no new
  finding this cycle beyond one more confirming data point. Worth noting for future cycles
  pulling this metric: it is not present in `gh api .../actions/runs/<id>` output at all
  (tried `--jq '{status,conclusion,permission_denials_count}'`, got `null`); it only shows up
  inside `gh run view <id> --log`'s captured step output, so that's the one command that
  actually works, not a JSON field to query directly.
- **Applies to:** triage | verify

## 2026-08-31 — #19: denial-count check continued cleanly this cycle — cycle 185's run posted at 3 (cycle 186)
- **Outcome:** n/a (not a dispatched item; posted cycle 185's denial count to #19, no status
  change — board and all four blocked issues still `summon-human`/Blocked awaiting the
  maintainer)
- **What worked / what didn't:** re-verified cycle 185's report (`a529c9c`) against live
  state first, per the standing recipe — `gh api .../commits/a529c9c --jq
  '.files[].filename'` confirms exactly `.nanobots/LEARNINGS.md` (single file), matching the
  docs-only claim; board unchanged (8/12 Done, 4 Blocked); #18/#19/#20/#21 last-comment
  bodies all still the loop's own prior posts (read the actual comment text, not just the
  author name, since the loop posts under the same human-owned `PROJECTS_PAT` identity a
  real maintainer reply would use), no maintainer replies. No fabrication. Pulled cycle
  185's own run (`33361017069`) denial count same cycle: `permission_denials_count: 3` —
  back in the low-single-digit band after cycle 184's low of 2. Full sequence: 168-170:
  3-5, 171: 8, 172: 8, 173: 5, 174: 7, 175: 10, 176: 12, 177: 5, 178: 2, 179: 4, 180: 3,
  181: 14, 182: 6, 183: 6, 184: 2, 185: **3**. Recomputed the undistilled count per
  RECIPES.md's two-command formula: 51 total headers (50 entries) minus 47
  `[distilled]`-suffixed = 3 undistilled — well under the ~10 threshold, no distill pass
  this cycle. No open PRs, no `nanobots:inbox` items, `main` CI green on the current head,
  both scheduled crons (`nanobots-outer.yml`, `nanobots-worker.yml`) healthy over their
  last 5 runs, nothing to triage or dispatch (WIP 0/1).
- **Lesson:** the sequence keeps confirming the recipe's own conclusion (RECIPES.md
  "verifying a cycle's own claims" point 3): the count bounces between 2 and 14 with no
  correlation to report accuracy. Also reaffirms recipe point 6's compound-claim caution —
  checking "no maintainer replies" requires reading each blocked issue's actual last
  comment body, not just noting the author name matches the loop's own posting identity
  (`TimHeckel`, since `PROJECTS_PAT` is human-owned) — a real reply would carry that same
  author name and only be distinguishable by content.
- **Applies to:** triage | verify

## 2026-08-31 — #19: denial-count check continued cleanly this cycle — cycle 184's run posted at 2 (cycle 185)
- **Outcome:** n/a (not a dispatched item; posted cycle 184's denial count to #19, no status
  change — board and all four blocked issues still `summon-human`/Blocked awaiting the
  maintainer)
- **What worked / what didn't:** re-verified cycle 184's report (`50696f0`) against live
  state first, per the standing recipe — `gh api .../commits/50696f0 --jq
  '.files[].filename'` confirms exactly `.nanobots/LEARNINGS.md` (single file), matching the
  docs-only claim; board unchanged (8/12 Done, 4 Blocked); #18/#19/#20/#21 last-comment
  authors/bodies all still the loop's own posts (via the human-owned `PROJECTS_PAT`), no
  maintainer replies. No fabrication. Pulled cycle 184's own run (`33341944632`) denial count
  same cycle: `permission_denials_count: 2` — a new low, back to cycle 178's level and well
  off cycle 181's peak of 14. Full sequence: 168-170: 3-5, 171: 8, 172: 8, 173: 5, 174: 7,
  175: 10, 176: 12, 177: 5, 178: 2, 179: 4, 180: 3, 181: 14, 182: 6, 183: 6, 184: **2**.
  Recomputed the undistilled count per RECIPES.md's two-command formula: 50 total headers
  (49 entries) minus 47 `[distilled]`-suffixed = 2 undistilled — well under the ~10
  threshold, no distill pass this cycle. No open PRs, no `nanobots:inbox` items, `main` CI
  green on the current head, both scheduled crons (`nanobots-outer.yml`,
  `nanobots-worker.yml`) healthy over their last 5 runs, nothing to triage or dispatch
  (WIP 0/1).
- **Lesson:** the sequence keeps confirming the recipe's own conclusion (RECIPES.md
  "verifying a cycle's own claims" point 3): magnitude swings from 2 to 14 across
  consecutive cycles with zero correlation to report accuracy. Two same-value cycles (182,
  183 both 6) briefly looked like it might be settling; this cycle's drop to 2 breaks that
  read — still just noise in a wide band, not a trend.
- **Applies to:** triage | verify

## 2026-08-30 — #19: denial-count check continued cleanly this cycle — cycle 183's run posted at 6 (cycle 184)
- **Outcome:** n/a (not a dispatched item; posted cycle 183's denial count to #19, no status
  change — board and all four blocked issues still `summon-human`/Blocked awaiting the
  maintainer)
- **What worked / what didn't:** re-verified cycle 183's report (`9d6df7d`) against live
  state first, per the standing recipe — `gh api .../commits/9d6df7d --jq
  '.files[].filename'` confirms exactly `.nanobots/LEARNINGS.md`, `.nanobots/RECIPES.md`,
  `.nanobots/TRIAGE.md` (three files), matching the docs-only distill-pass claim; board
  unchanged (8/12 Done, 4 Blocked); #18/#19/#20/#21 last-comment authors/bodies all still
  the loop's own posts, no maintainer replies. No fabrication. Pulled cycle 183's own run
  (`33335452192`) denial count same cycle: `permission_denials_count: 6` — identical to
  cycle 182, still inside the noisy low-single-digit band. Full sequence: 168-170: 3-5,
  171: 8, 172: 8, 173: 5, 174: 7, 175: 10, 176: 12, 177: 5, 178: 2, 179: 4, 180: 3, 181: 14,
  182: 6, 183: **6**. Recomputed the undistilled count per RECIPES.md's two-command
  formula: 49 total headers (48 entries) minus 47 `[distilled]`-suffixed = 1 undistilled —
  well under the ~10 threshold, no distill pass this cycle. No open PRs, no
  `nanobots:inbox` items, `main` CI green on the current head, both scheduled crons
  (`nanobots-outer.yml`, `nanobots-worker.yml`) healthy over their last 5 runs, nothing to
  triage or dispatch (WIP 0/1).
- **Lesson:** two consecutive identical readings (182 and 183 both 6) after a single spike
  to 14 (181) is the first repeat value the sequence has produced — still not enough data
  to call it a new steady baseline over the prior "noise in a low single-digit band," but
  worth flagging if a third cycle also lands at exactly 6 rather than drifting.
- **Applies to:** triage | verify

## 2026-08-30 — distill pass: 10 undistilled #19/#21 tracking entries folded into RECIPES.md and TRIAGE.md; #19's denial count dropped back to 6 (cycle 183)
- **Outcome:** n/a (not a dispatched item; docs-only distill pass plus a data point posted
  to #19, no status change — board and all four blocked issues still `summon-human`/Blocked
  awaiting the maintainer)
- **What worked / what didn't:** re-verified cycle 182's report (`026c965`) against live
  state first, per the standing recipe — `gh api .../commits/026c965 --jq
  '.files[].filename'` confirms exactly `.nanobots/LEARNINGS.md` (single file), matching the
  docs-only claim; board unchanged (8/12 Done, 4 Blocked); #18/#19/#20/#21 last-comment
  authors and bodies all still the loop's own posts, no maintainer replies. No fabrication.
  Pulled cycle 182's own run (`33323143212`) denial count same cycle: `permission_denials_count: 6`
  — back down from cycle 181's peak of 14, inside the noisy band this metric has shown all
  along. Recomputed the undistilled count per RECIPES.md's two-command formula: 48 total
  headers (47 entries) minus 37 `[distilled]`-suffixed = 10 undistilled, at the ~10
  threshold, so ran a distill pass instead of deferring it. All 10 were the accumulated
  #19 denial-count tracking series (cycles 171-182) plus the #21 flake-recurrence entry
  (cycle 172); folded two durable findings out of them: (1) RECIPES.md's "verifying a
  cycle's own claims" point 3 now states that after ~15 cycles the denial count's magnitude
  has never once correlated with an inaccurate report, and that citing the metric alongside
  a run ID requires re-pulling it from that exact run (not reusing an adjacent cycle's
  cached number, per cycle 175's off-by-one slip); (2) TRIAGE.md's flake-judgment section
  gained a new bullet generalizing the intake "duplicate → comment on canonical issue" rule
  to recurring Sync-time CI-red events already tracked by an open, maintainer-pending P0 —
  add evidence, don't file a sibling P0 (per cycle 172's #21 handling). Marked all 10 source
  entries `[distilled]`. Full denial sequence: 168-170: 3-5, 171: 8, 172: 8, 173: 5, 174: 7,
  175: 10, 176: 12, 177: 5, 178: 2, 179: 4, 180: 3, 181: 14, 182: **6**. No open PRs, no
  `nanobots:inbox` items, `main` CI green on the current head, nothing to triage or dispatch
  (WIP 0/1).
- **Lesson:** the ~10-entry distill threshold is worth checking with the exact formula every
  cycle, not estimated — this cycle crossed it silently (cycle 182 itself computed 9 the
  cycle before, one entry under) and would have kept accumulating past the trigger if the
  count weren't recomputed fresh each time rather than trusted from the prior cycle's stated
  number. A long run of near-identical tracking entries (same issue, same recipe, same
  "no fabrication" verdict) is exactly the shape a distill pass should compress — the durable
  content across 10 entries reduced to two rule refinements, not ten.
- **Applies to:** triage | review

## 2026-08-30 — #19: denial-count check found a new peak (14) on cycle 181's run, report still clean (cycle 182) [distilled]
- **Outcome:** n/a (not a dispatched item; posted cycle 181's denial count to #19, no status
  change — board and all four blocked issues still `summon-human`/Blocked awaiting the
  maintainer)
- **What worked / what didn't:** re-verified cycle 181's report (`d7ad08f`) against live
  state first, per the standing recipe — `gh api .../commits/d7ad08f --jq
  '.files[].filename'` confirms exactly `.nanobots/LEARNINGS.md` (single file), matching the
  docs-only claim; board unchanged (8/12 Done, 4 Blocked); #18/#19/#20/#21 comment counts and
  last-comment bodies all still the loop's own posts, no maintainer replies. No fabrication.
  Pulled cycle 181's own run (`33310087529`) denial count same cycle: `permission_denials_count: 14`
  — a new peak, above the previous high of 12 (cycle 176). No per-call denial detail is
  available in the run log beyond the summary count. No open PRs, no `nanobots:inbox` items,
  `main` CI green on the current head, nothing to triage or dispatch (WIP 0/1). Full
  sequence: 168-170: 3-5, 171: 8, 172: 8, 173: 5, 174: 7, 175: 10, 176: 12, 177: 5, 178: 2,
  179: 4, 180: 3, 181: **14**.
- **Lesson:** a new peak on its own is not yet actionable — cycle 181's report checked out
  clean despite the higher count, consistent with 175/176's spikes, so denial count still
  hasn't correlated with report accuracy. But 14 is now clearly outside the "noise around a
  low single-digit baseline" framing prior cycles used (168-180 ranged 2-12, mean well under
  14) — if a value this high or higher recurs, that's grounds to stop calling this "noise"
  and treat it as a trend worth its own investigation (e.g. what specifically got denied),
  not just another data point appended to the sequence. Distill count recomputed via
  RECIPES.md's two-command formula: 47 total headers (46 entries after subtracting the
  format-template line) minus 37 `[distilled]`-suffixed = 9 undistilled — still under the
  ~10 threshold, no distill pass this cycle.
- **Applies to:** triage | verify

## 2026-08-30 — #19: denial-count check continued cleanly this cycle — cycle 180's run posted at 3 (cycle 181) [distilled]
- **Outcome:** n/a (not a dispatched item; posted cycle 180's denial count to #19, no status
  change — board and all four blocked issues still `summon-human`/Blocked awaiting the
  maintainer)
- **What worked / what didn't:** re-verified cycle 180's report (`146022e`) against live
  state first, per the standing recipe — `gh api .../commits/146022e --jq
  '.files[].filename'` confirms exactly `.nanobots/LEARNINGS.md` (single file), matching the
  docs-only claim; board unchanged (8/12 Done, 4 Blocked); #18/#19/#20/#21 comment counts and
  last-comment bodies all still the loop's own posts (data points / recurrence reports, not
  a maintainer reply), no maintainer activity. No fabrication. Identified cycle 180's own run
  (`33294604003` — matched by timing against the `146022e` push) and pulled its denial count
  same cycle rather than deferring it — `permission_denials_count: 3`. Also checked the
  latest `nanobots-worker.yml` run (`33307261089`) log for any recurrence of #18's `gh
  project --owner` "unknown owner type" failure per RECIPES.md #13 — clean, no errors,
  nothing claimable (board has no Ready items). No open PRs, no `nanobots:inbox` items,
  `main` CI green on the current head, nothing to triage or dispatch (WIP 0/1). Full
  sequence: 168-170: 3-5, 171: 8, 172: 8, 173: 5, 174: 7, 175: 10, 176: 12, 177: 5, 178: 2,
  179: 4, 180: **3**.
- **Lesson:** the sequence continues to read as noise around a low single-digit baseline
  with two outlier spikes (171-172, 175-176) rather than a trend in either direction — ten
  data points past the last spike now, still no basis for a distinct finding beyond what #19
  already states. Distill count recomputed via RECIPES.md's two-command formula: 46 total
  headers (45 entries after subtracting the format template) minus 37 `[distilled]`-suffixed
  = 8 undistilled — still under the ~10 threshold, no distill pass this cycle.
- **Applies to:** triage | verify

## 2026-08-30 — #19: denial-count check continued cleanly this cycle — cycle 179's run posted at 4 (cycle 180) [distilled]
- **Outcome:** n/a (not a dispatched item; posted cycle 179's denial count to #19, no status
  change — board and all four blocked issues still `summon-human`/Blocked awaiting the
  maintainer)
- **What worked / what didn't:** re-verified cycle 179's report (`aca6a25`) against live
  state first, per the standing recipe — `gh api .../commits/aca6a25 --jq
  '.files[].filename'` confirms exactly `.nanobots/LEARNINGS.md` (single file), matching the
  docs-only claim; board unchanged (8/12 Done, 4 Blocked); #18/#19/#20/#21 comment counts and
  last-comment authors all still the loop's own (`TimHeckel`, the human PAT identity), no
  maintainer replies. No fabrication. Pulled cycle 179's own run (`33280706558`) denial count
  same cycle rather than deferring it — `permission_denials_count: 4`, posted to #19. Full
  sequence: 168-170: 3-5, 171: 8, 172: 8, 173: 5, 174: 7, 175: 10, 176: 12, 177: 5, 178: 2,
  179: **4**. Also spot-checked the latest `nanobots-worker.yml` run (`33283858484`) log for
  any recurrence of #18's `gh project --owner` "unknown owner type" failure per RECIPES.md
  #13 — clean, no errors, nothing claimable (board has no Ready items). No open PRs, no
  `nanobots:inbox` items, nothing to triage or dispatch (WIP 0/1).
- **Lesson:** the sequence (168-170: 3-5, 171: 8, 172: 8, 173: 5, 174: 7, 175: 10, 176: 12,
  177: 5, 178: 2, 179: 4) continues to read as noise around a low single-digit baseline with
  two outlier spikes rather than a trend in either direction — worth continuing to track but
  not yet worth a distinct finding of its own beyond what #19 already states.
- **Applies to:** triage | verify

## 2026-08-29 — #19: denial-count check continued cleanly this cycle — cycle 178's run posted at 2 (cycle 179) [distilled]
- **Outcome:** n/a (not a dispatched item; posted cycle 178's denial count to #19, no status
  change — board and all four blocked issues still `summon-human`/Blocked awaiting the
  maintainer)
- **What worked / what didn't:** re-verified cycle 178's report (`4833e1c`) against live
  state first, per the standing recipe — `gh api .../commits/4833e1c --jq
  '.files[].filename'` confirms exactly `.nanobots/LEARNINGS.md` (single file), matching the
  docs-only claim; board unchanged (8/12 Done, 4 Blocked); #18/#19/#20/#21 comment counts and
  last-comment authors all still the loop's own (`TimHeckel`, the human PAT identity), no
  maintainer replies. No fabrication. Unlike cycles 175-177, this cycle's own-claims check
  included pulling cycle 178's run (`33274729062`) denial count immediately rather than
  deferring it — `permission_denials_count: 2`, posted to #19 same cycle. Full sequence:
  168-170: 3-5, 171: 8, 172: 8, 173: 5, 174: 7, 175: 10, 176: 12, 177: 5, 178: **2**. No open
  PRs, no `nanobots:inbox` items, nothing to triage or dispatch (WIP 0/1).
- **Lesson:** the two-step pattern cycle 178 named (re-verify the prior report, *then*
  separately pull and post this cycle's own run's denial count) only closes the loop if each
  cycle checks it did both, not just the fabrication half — this cycle confirms the fix from
  cycle 178's lesson holds when actually followed once.
- **Applies to:** triage | verify

## 2026-08-29 — #19: three cycles in a row skipped the denial-count check; backfilled it and found a new peak (10, 12) before it dropped back to 5 (cycle 178) [distilled]
- **Outcome:** n/a (not a dispatched item; posted the backfilled data to #19, no status
  change — still `summon-human`/Blocked awaiting the maintainer)
- **What worked / what didn't:** re-verified cycle 177's report (`e15f920`) against live
  state first, per the standing recipe — `gh api .../commits/e15f920 --jq
  '.files[].filename'` confirms exactly `.nanobots/LEARNINGS.md` + `.nanobots/RECIPES.md`,
  matching the docs-only claim; board unchanged (8/12 Done, 4 Blocked); #18/#19/#20/#21
  comment counts and last-comment authors all still the loop's own (`TimHeckel`, the human
  PAT identity), no maintainer replies. No fabrication. But cycles 175, 176, and 177 each
  checked the *prior* cycle's report for fabrication (per the recipe) without also pulling
  *their own* run's `permission_denials_count` and posting it to #19 — three data points the
  standing check was supposed to produce never got recorded. Backfilled all three directly
  from `gh run view <id> --log`: cycle 175's run (`33227218809`) = **10**, cycle 176's run
  (`33246926378`) = **12**, cycle 177's run (`33263724484`) = **5**. Full sequence is now
  168-170: 3-5, 171: 8, 172: 8, 173: 5, 174: 7, 175: 10, 176: 12, 177: 5 — 175 and 176 are the
  two highest values recorded yet, not just noise within the previously-described 3-8 band.
- **Lesson:** "re-verify the prior cycle's claims" and "record this cycle's own denial count"
  are two separate steps the recipe bundles into one paragraph of narrative but not into a
  single mechanical action — it's easy to do the first (which has an explicit "no
  fabrication" pass/fail) and silently drop the second (which has no pass/fail, just a number
  to post). When continuing a standing numeric-tracking check across cycles, verify the
  *previous* cycle's number was actually posted before assuming the sequence is complete —
  don't just confirm the previous report wasn't fabricated and move on.
- **Applies to:** review

## 2026-08-29 — shallow-clone `git show --stat` falsely flags a docs-only commit as touching the whole repo (cycle 177) [distilled]
- **Outcome:** n/a (not a dispatched item; caught during this cycle's own-claims check on
  cycle 176's report, folded the fix directly into RECIPES.md, no board/issue action)
- **What worked / what didn't:** Verifying cycle 176's claimed commit `ef071f5` (reported as
  "docs-only, `.nanobots/LEARNINGS.md` + `.nanobots/RECIPES.md`") started with
  `git show --stat ef071f5`, which reported **102 files changed, 16392 insertions** — the
  entire repo, which looked exactly like the "hallucinated foundation" failure #19 tracks.
  Before escalating, checked `git rev-parse --is-shallow-repository` → `true`: this Actions
  checkout only has the one commit locally, so `git show`/`git diff` against a missing parent
  silently diff against an empty tree instead of erroring. `gh api
  repos/TimHeckel/nanobots/commits/ef071f5 --jq '.files[].filename'` returned exactly the two
  files claimed. No fabrication — the verification method was the bug, not the report.
- **Lesson:** in a shallow checkout, `git show --stat` / `git diff <sha>~1 <sha>` are not
  reliable ways to check *which files* a commit touched — they degrade silently (no error,
  no warning) to "every file in the repo" when the parent commit isn't present. Use
  `gh api repos/{owner}/{repo}/commits/<sha> --jq '.files[].filename'` for that check instead;
  `git log`/`git rev-parse` (existence-only checks) aren't affected. This is exactly the kind
  of thing the "verifying a cycle's own claims" recipe exists to catch, applied one level
  deeper: the verification tooling itself can produce a false positive for fabrication.
  Folded directly into RECIPES.md's "verifying a cycle's own claims" recipe (point 1) since
  it's immediately actionable and the next cycle to run this exact check would hit the same
  false signal.
- **Applies to:** verify | review

## 2026-08-29 — #19: found a reproducible trigger — a Bash-tool `grep` pattern ending in a bare `$` requires approval and is silently denied in headless runs (cycle 176) [distilled]
- **Outcome:** n/a (not a dispatched item; posted the finding to #19, folded the fix into
  RECIPES.md directly, no status change on #19 itself — still `summon-human`/Blocked, the
  harness-level "why" is still the maintainer's call)
- **What worked / what didn't:** re-verified cycle 175's report (`33227218809`, committed
  `62a4a90`) against live state first, per the standing recipe — commit touched only
  `.nanobots/LEARNINGS.md` (confirmed via the GitHub API), CI green, board unchanged (8/12
  Done, 4 Blocked), #18-#21 comment counts and last-comment authors all matched, no
  maintainer replies. No fabrication. Then, while recomputing the distill count via
  RECIPES.md's own two-command formula, the second command
  (`grep -c "^## .*\[distilled\]\s*$" .nanobots/LEARNINGS.md`, via the Bash tool) came back
  `This command requires approval` instead of a number — with no human present in this
  scheduled run to grant it. Isolated the trigger empirically rather than assuming it was
  this file or this pattern specifically: `grep -c "distilled"` and `grep -c "\[distilled\]"`
  (no trailing `$`) both ran fine; `grep -c "distilled\]\s*$"`, `grep -c "distilled$"` (single-
  *and* double-quoted), and `grep -c "a$" package.json` (unrelated file and pattern) all
  required approval; `echo "a$"` ran fine. That isolates the trigger to a bare trailing `$`
  specifically inside a Bash-tool `grep` invocation — not this file, not this recipe's
  pattern, and not "any `$` anywhere in any Bash command." The dedicated Grep tool ran the
  identical `^## .*\[distilled\]\s*$` pattern with no prompt at all, so the workaround is
  "use the Grep tool for anchored patterns," not "avoid regex anchors."
- **Lesson:** this is the first reproducible, causal mechanism this investigation has found,
  as opposed to a log-only symptom — and it directly implicates RECIPES.md's own prior advice:
  the recipe told every cycle to run that exact `$`-anchored Bash `grep` every time a report
  needed the distill count, so any cycle that followed the recipe literally would hit at least
  one denial per run, not intermittently. This doesn't necessarily explain the full
  `permission_denials_count` history (no attempt yet to enumerate every command shape that
  triggers approval), but it is a concrete, fixable piece of it. Fixed by editing RECIPES.md's
  entry 5 to route the suffix-anchored count through the Grep tool instead of Bash — the
  general rule worth generalizing beyond just this one recipe: **when a Bash command
  unexpectedly reports "requires approval" in a headless/unattended context, that is a permanent
  denial, not a transient one** (no retry will fix it — the same shape will be denied again),
  so route the same operation through a dedicated tool (Grep/Read/Glob/Edit) instead of
  retrying the Bash form, and prefer those tools over raw Bash for pattern-matching or file
  operations they already cover, specifically to avoid this class of silent failure.
- **Applies to:** review | prompt | build

## 2026-08-29 — #19's permission-denial count bounced to 7, breaking the "returned to baseline" read; now looks like noise across a wider range (cycle 175) [distilled]
- **Outcome:** n/a (not a dispatched item; commented on #19 with the new data point, no
  status change — still `summon-human`/Blocked awaiting the maintainer)
- **What worked / what didn't:** re-verified cycle 174's report (`33184801935`, committed
  `e5ba391`) against live state per the "verifying a cycle's own claims" recipe: the commit
  (checked via GitHub API rather than local `git log`, since this Actions runner's checkout
  is shallow — a local diff would have shown the full tree as "added" and looked alarming
  for no reason) touched only `.nanobots/LEARNINGS.md` (+24/-0) as claimed, CI (`test` +
  `onboarding-agent`) is green on that head, and both the LEARNINGS entry and the #19
  comment cycle 174 claimed to have posted exist verbatim. No fabrication. But cycle 174's
  own run (`33184801935`) carries `permission_denials_count: 7` — not the 5 it reported,
  which was actually cycle *173*'s number, restated one cycle late (a same-shape slip to the
  "compound claim" recipe: the report was accurate about cycle 173, just not about the run
  whose number it was narrating alongside). The five-cycle sequence is now 170→3, 171→8,
  172→8, 173→5, 174→7 — no longer a clean "spiked then returned to baseline" story, more a
  noisy 3-8 band with no visible trend either direction. Board and open-PR state otherwise
  unchanged from cycle 174 (8/12 Done, #18-#21 still `summon-human`/Blocked, all prior
  issue-thread activity confirmed to be the loop's own comments posted under the human PAT's
  identity, not actual maintainer replies — checked comment bodies, not just author logins,
  since both look identical on GitHub). LEARNINGS undistilled count recomputed fresh: 40
  headers − 1 template = 39 entries, 35 `[distilled]` → 4 undistilled, still under the ~10
  threshold, no distill pass this cycle.
- **Lesson:** when citing a per-run metric (like `permission_denials_count`) alongside a run
  ID, re-pull the metric from that exact run ID rather than reusing the number computed for
  an adjacent cycle's run — the two are easy to conflate one cycle after the fact, and the
  resulting off-by-one reads as a real trend change (a "return to baseline") when the
  baseline itself was never actually re-measured for the cycle the report named. Also: on
  a shallow-checkout runner, a local `git show --stat HEAD` diff is misleading (every file in
  the tree shows as newly added, since there's no local parent commit) — pull the commit's
  actual file list from the GitHub API instead of trusting a local diff when the working
  copy might be shallow.
- **Applies to:** review

## 2026-08-28 — #19's permission-denial count dropped back to 5 the cycle right after the 8/8 spike; reads as noise, not a sustained climb (cycle 174) [distilled]
- **Outcome:** n/a (not a dispatched item; commented on #19 with the new data point, no
  status change — still `summon-human`/Blocked awaiting the maintainer)
- **What worked / what didn't:** re-verified cycle 173's report (`33129642481`, committed
  `edee5a2`) against live state per the "verifying a cycle's own claims" recipe: HEAD
  matches, `ci.yml` on `edee5a2` is green, the LEARNINGS entry it claims to have appended
  exists verbatim, the #19 comment it claims to have posted exists verbatim, board
  unchanged (8/12 Done, #18/#19/#20/#21 still `summon-human`/Blocked, no maintainer replies
  on any of them). No fabrication. Continuing the standing denial-signature check: cycle
  173's own run (`33129642481`) shows `permission_denials_count: 5` — back inside the 3-5
  baseline cycles 168-170 carried, not a continuation of the 8/8 cycles 171-172 showed.
  Recomputed the undistilled LEARNINGS count fresh per the two-command formula rather than
  trusting a prior report's number: 39 headers − 1 template line = 38 entries, 35 marked
  `[distilled]`, so 3 undistilled — well under the ~10 distill-pass threshold, no distill
  pass this cycle.
- **Lesson:** a two-cycle run at double the baseline followed immediately by a return to
  baseline is more consistent with count noise than a sustained climb — worth recording on
  #19 as evidence *against* "it's getting worse" now that both directions have a data point,
  rather than only ever reporting new highs. The standing per-cycle check (recipe:
  "verifying a cycle's own claims") keeps earning its cost either way: it takes seconds and
  has now produced five straight clean verifications in a row with zero fabrication since
  #19 was filed.
- **Applies to:** review

## 2026-08-28 — #19's permission-denial signature jumped from a 3-5 baseline to 8 on two straight cycles, still no fabrication found (cycle 173) [distilled]
- **Outcome:** n/a (not a dispatched item; commented on #19 with the new evidence, no
  status change — still `summon-human`/Blocked awaiting the maintainer)
- **What worked / what didn't:** re-verified cycle 172's report (`33080905927`, committed
  `5dc03cb`) against live state per the "verifying a cycle's own claims" recipe: HEAD
  matches, `ci.yml` on `5dc03cb` is green, the claimed LEARNINGS entry exists verbatim,
  board unchanged (8/12 Done, #18/#19/#20/#21 still `summon-human`/Blocked), and comment
  counts (2/2/0/1) matched exactly. No fabrication. But `gh run view 33080905927 --log`
  showed `permission_denials_count: 8` — and the cycle before it (`33028002994`, cycle 171)
  also showed 8, versus the 3-5 range cycles 168-170 carried (2026-08-26 comment on #19).
  Two consecutive cycles at roughly double the prior baseline, still with zero visible
  false claims in either report.
- **Lesson:** the denial-signature check (recipe: "verifying a cycle's own claims") is a
  standing per-cycle check, not a one-time investigation — this is the second time in a row
  it surfaced a number worth recording even though neither cycle actually fabricated
  anything. A rising count on an otherwise-accurate report is still worth flagging on #19:
  it's the same unexplained denied call #19 already owns, and a magnitude change (not just
  "nonzero") is new information about whether it's getting worse.
- **Applies to:** review

## 2026-08-27 — #21's onboarding-agent assertion-flake recurred with a different assertion pair, clean on rerun again (cycle 172) [distilled]
- **Outcome:** n/a (not a dispatched item; commented on #21 with the new evidence, no new
  issue filed — still `summon-human`/Blocked awaiting the maintainer's policy decision)
- **What worked / what didn't:** Sync found `main` CI red on the current head `2b50cde`
  (cycle 171's own docs-only LEARNINGS commit), run `33028165491` — only `onboarding-agent`
  failed, `test` passed. `tests/init-agent.e2e.mjs` reported `FAILED 2 of 29: agent set
  DAYTONA_API_KEY, agent verified Daytona BEFORE storing the key` — a different assertion
  pair than #21's original (`agent set the OCR endpoint variables`), no network-error text
  anywhere in the log. Checked the four flake-exception conditions individually rather than
  pattern-matching on "it's the known flaky job": (1) one job red, live third-party
  endpoint — yes; (2) network-shaped — **no**, an assertion failure on model tool-call
  sequence again; (3) diff doesn't plausibly touch the path — yes, `git diff --stat 05915b2
  2b50cde` is `.nanobots/LEARNINGS.md` only; (4) `gh run rerun --failed` on the same commit
  — came back clean (both jobs green, no code change). Condition 2 still fails on its
  literal wording, so per LOOP-PROMPT.md filed no exemption unilaterally — but rather than
  opening a second duplicate P0 for the same already-open policy question, commented on #21
  with the new evidence and explicitly declined to file a new issue, matching the treatment
  this loop already gives recurring `gh --owner` flakes tracked by #18 (comment on the
  existing tracker, not a fresh P0, once a maintainer decision is already pending).
- **Lesson:** a second occurrence of the same *behavioral*-flake shape (different specific
  assertion, same test file, same non-network cause, same clean-rerun outcome) is exactly
  the recurrence #21's own entry said would be "evidence for formally broadening condition
  2" — and it arrived within ~2 days. This also generalizes the "duplicate → comment on
  canonical issue" triage rule past fresh inbox items to recurring CI-red events during
  Sync: when an already-open, maintainer-pending P0 already tracks the exact question a new
  red-CI event raises, add evidence to that issue rather than filing a sibling P0 that would
  just fragment the same decision across two threads.
- **Applies to:** triage | review

## 2026-08-26 — #19's permission-denial signature recurred on cycles 168-170 with no fabrication this time (cycle 170's own report re-verified live) (cycle 171) [distilled]
- **Outcome:** n/a (not a dispatched item; added a comment to #19 with the new data, no
  status change — still `summon-human`/Blocked awaiting the maintainer's decision)
- **What worked / what didn't:** Sync's own-claims check (per the "verifying a cycle's own
  claims" recipe) found cycle 170's outer-loop run (`33008396632`) completed `is_error:
  false` with `permission_denials_count: 3` — the same signature #19 documents on its two
  fabricating runs. Did not stop at noticing the number: independently re-verified cycle
  170's actual report against live state (HEAD SHA `05915b2`, board 8/12 Done, #18-#21
  comment counts and `updatedAt` all unchanged) and every claim held up. Checked the two
  runs before it too (`32989093076`, `32973212501`) — denials 4 and 5, also both verified
  clean. So three consecutive cycles carried the denial signature with zero fabrication.
- **Lesson:** the denial signature is evidence worth checking every time (per #19's
  standing rule), but it is not itself proof of fabrication — on an idle cycle with nothing
  to triage, dispatch, or merge, there's little for a silently-swallowed denial to
  fabricate a consequential claim about. This narrows rather than closes #19: the
  underlying denied tool call is still unexplained and still occurring most/every cycle,
  it just hasn't produced a visible false claim on a quiet cycle. Recorded as a data point
  on #19 rather than a new issue, since #19 already owns this exact investigation.
- **Applies to:** triage | review

## 2026-08-25 — cycle 162's distill-count claim ("8/33") was off by one on both axes (9/34 actual); still harmless, fourth recurrence of the same class of miscount (cycle 163) [distilled]
- **Outcome:** n/a (not a dispatched item; a Sync-time verification catch per the "verifying a
  cycle's own claims" recipe, no new issue filed)
- **What worked / what didn't:** re-verified cycle 162's report before trusting it. `88481a8`
  matches `git rev-parse HEAD`; `ci.yml` on that SHA (`test` + `onboarding-agent` jobs) both
  came back green; #21 exists exactly as reported (`bug`+`summon-human`, Blocked, P0/S,
  assigned `TimHeckel` — checked the assignee explicitly per cycle 161's catch, not just labels
  and status); #18/#19/#20 each still have only the loop's own past escalation-recipe comments
  (all authored as `TimHeckel` because the dispatch PAT belongs to that human account) — no
  actual maintainer reply to act on. But the report's housekeeping line — "Undistilled count
  8/33" — didn't match a fresh recount: `grep -c "^## "` gives 35 headers (34 real entries,
  excluding the format-template line), and a suffix-anchored `grep -c "^## .*\[distilled\]\s*$"`
  (so the 2026-08-19 entry's prose *mention* of the string doesn't count as a false positive)
  gives 25 truly-marked entries — 9 undistilled, not 8/33. Still under the ~10 distill-pass
  threshold either way, so this stayed harmless exactly like the 2026-08-19 and 2026-08-21
  instances of the same bug.
- **Lesson:** this is the fourth cycle (137, 157, 162, and this catch of 162) to touch this
  exact number and get it at least partly wrong, despite cycle 157 already writing down the fix
  ("recompute it with two independent tool invocations each time a report needs it") — prose
  guidance alone hasn't stopped the recurrence, so this cycle also hardened RECIPES.md's
  "verifying a cycle's own claims" recipe with the literal two-command formula instead of
  restating the instruction in prose again. If this recurs a fifth time after that, the formula
  itself (not just the instruction to use one) needs review.
- **Applies to:** review | prompt

## 2026-08-25 — #21 filed: `main` CI red on `e8e9cc2` was an onboarding-agent e2e assertion failure, not a network-shaped one — filed per the flake exception's literal wording despite 3 of 4 conditions favoring a skip (cycle 162) [distilled]
- **Outcome:** escalated (filed #21, `bug` + `summon-human`, Blocked, P0/S; assigned the
  maintainer)
- **What worked / what didn't:** Sync found `ci.yml` run `32869486069` red on the current
  head `e8e9cc2` — only `onboarding-agent` failed, `test` passed. The failure was
  `tests/init-agent.e2e.mjs`'s `agent set the OCR endpoint variables` assertion (the live
  DeepSeek-driven onboarding agent's 52-tool-call transcript didn't include both expected
  `set_variable` calls), with no `fetch failed`/timeout/5xx text anywhere in the log — a
  genuinely different failure shape from every prior onboarding-agent flake on record
  (#5/#6/2026-08-01, #16/2026-08-05, #16/2026-08-08), which were all literal `fetch failed`.
  Checked the transient-flake exception's four conditions individually rather than
  pattern-matching on "it's the usual flaky job": (1) exactly one job red, live third-party
  endpoint — yes; (2) network-shaped — **no**, this is an assertion failure on model output,
  not a transport-level error; (3) diff doesn't touch the path — yes, `e8e9cc2` only touched
  `.nanobots/LEARNINGS.md`; (4) `gh run rerun --failed` on the same commit — came back clean
  (both jobs green, no code change). Per LOOP-PROMPT.md's literal wording ("if any condition
  fails ... a non-network failure ... file the P0 immediately ... with no further
  judgement"), filed #21 rather than silently extending the known-flake treatment to a new
  failure shape — same posture as #6's 2026-08-01 precedent (a timeout-shaped-but-not-
  literally-third-party failure filed without rationalizing an exemption). Included a
  recommendation in #21 to formally extend the exception's condition 2 to cover this exact
  shape (assertion failure on a known live-LLM e2e test + clean immediate rerun), rather
  than applying that judgment unilaterally.
- **Lesson:** the transient-flake exception's four conditions are independent checks, not a
  single "does this smell like the known flaky job" gut call — a live third-party endpoint
  can fail in more than one shape (transport-level vs. behavioral/assertion-level), and only
  the literal wording's specific signatures (`fetch failed`, timeout, connection reset, 5xx)
  qualify for condition 2 as currently written, even when the other three conditions and the
  underlying cause (model nondeterminism) point the same direction. Do not stretch "it's the
  usual live-LLM job" into "therefore any failure on this job is exempt" — file the P0 and
  let a human decide whether to broaden the policy, per LOOP-PROMPT.md's own "propose an
  edit, don't silently deviate" instruction.
- **Applies to:** triage | prompt

## 2026-08-25 — cycle 160's report claimed "#20 ... assigned" but the issue had zero assignees; fixed in place (cycle 161) [distilled]
- **Outcome:** n/a (not a dispatched item; a Sync-time verification catch per recipe #14, no
  new issue filed)
- **What worked / what didn't:** per recipe #14, re-verified cycle 160's claims before
  trusting them: `d9f62e4` matches `git rev-parse HEAD`, `ci.yml` run `32852572633` on that
  SHA resolved green, and #20 exists on the board as `Blocked`/`summon-human`/P0/S exactly as
  reported. But the report's own words — "filed **#20** (P0/S, `summon-human`, assigned)" —
  did not match live state: `gh api repos/.../issues/20` returned `"assignees": []`. Cross-
  checked against #18, #19, and #6 (all correctly `["TimHeckel"]`) to confirm this wasn't a
  general pattern or a misread of the API shape — it was specific to #20. Fixed with
  `gh issue edit 20 --add-assignee TimHeckel`, confirmed via a fresh API read afterward
  rather than trusting the edit command's own exit code.
- **Lesson:** recipe #14's "before posting your own cycle report... that value must come from
  a tool result you just read back" applies to every clause of a compound claim, not just the
  headline one (commit SHA, merge, close) — "filed, Blocked, summon-human, **assigned**" is
  four separate assertions bundled into one phrase, and three being true doesn't imply the
  fourth is. A `gh issue create --assignee` call (or a separate `gh issue edit --add-assignee`)
  that silently no-ops or gets dropped is exactly as invisible in the report's prose as a
  fabricated commit SHA would be — the only difference is the blast radius is smaller (a
  missed notification, not a hallucinated foundation). Cheap fix: when a report states an
  action with multiple named side effects, read back *each* one, not just the one most likely
  to have failed.
- **Applies to:** review | prompt

## 2026-08-25 — #20 filed: `nanobots-outer.yml` failed on every scheduled run for ~3.3 days (28 consecutive runs, 2026-08-22 01:50Z → 2026-08-25 09:51Z), self-resolved by this cycle (cycle 160) [distilled]
- **Outcome:** escalated (filed #20, `summon-human`, Blocked, P0/S; assigned maintainer)
- **What worked / what didn't:** Sync checked more than just `main` CI (which was green,
  unchanged at `2d9f656`) — per TRIAGE.md's own hard rule, a scheduled dispatcher failing on
  every run is exactly as urgent as red `main` CI, so also pulled `gh run list
  --workflow=nanobots-outer.yml` before assuming "no report since cycle 159" meant nothing
  happened. It meant the opposite: 28 straight `schedule`-triggered runs failed, from
  `2026-08-22T01:50:06Z` through `2026-08-25T09:51:14Z`, three days with zero outer-loop
  activity, and this cycle's own run is the first to succeed since. Every failed run's log
  had the identical shape: Claude Code Action's `system/init` fires normally (session starts,
  model resolves), then a `result` message arrives in ~341ms with `is_error: true, num_turns:
  1, total_cost_usd: 0, permission_denials_count: 0` — the first model turn erroring near-
  instantly, before any tool use or blocked permission. `show_full_output` isn't set on this
  workflow, so the actual error text is invisible in the log; only "Claude result reported
  subtype success with is_error:true" surfaces. Confirmed this isn't a code regression:
  zero commits landed in the repo between the last success (`2d9f656`) and now, so the
  workflow file and prompt are byte-identical across the whole failure window — whatever
  broke is provider/credential-side. `nanobots-worker.yml`'s scheduled runs stayed green
  throughout, and the board had nothing claimable, so no work was silently lost — the entire
  cost was ~3.3 days of dead triage/review/learn cadence, invisible on the Status issue
  because the failure happened before the run ever got far enough to post anything.
- **Lesson:** recipe #12's "same job keeps flaking repeatedly → file a chore" threshold has
  an upper bound this sharp a case blows past — this isn't a couple of retries, it's the
  *entire* outer loop going dark for 3+ days with nothing on GitHub reflecting it except raw
  Actions run history, because an instant pre-tool-use failure leaves no comment, no board
  change, no LEARNINGS entry to notice by. **Checking "did the last scheduled run of the
  outer-loop workflow itself succeed" belongs in Sync's standard checklist, not just "is
  `main` CI green" — a stopped clock reads as calm from inside the loop's own history.**
  Also: an action step that hides its own model-turn error text (`show_full_output` unset)
  makes an instant `is_error` with `num_turns: 1` nearly un-root-causeable from the workflow
  log alone; that's worth fixing (enable it temporarily, or always, given no secrets flow
  through the outer loop's stdout) the next time this recurs, not treated as an unavoidable
  black box every time.
- **Applies to:** triage | build | review

## 2026-08-21 — cycle 156's hand-recount of LEARNINGS was itself off by one on both axes (29/24 stated vs. 30/25 actual); still harmless (cycle 157) [distilled]
- **Outcome:** n/a (not a dispatched item; a Sync-time verification catch, no new issue filed)
- **What worked / what didn't:** per recipe #14, re-verified cycle 156's Status-issue report
  before trusting it. Its `main`-unchanged claim (`98e73aa`), CI run (`32214233729`, green),
  board snapshot (8/10 Done, #18+#19 Blocked), and comment counts (2 on #18, 1 on #19) all
  matched live state. But cycle 156's own fix for the exact bug this file's 2026-08-19 entry
  describes — hand-recounting LEARNINGS headers instead of trusting a naive `grep -c` — was
  itself off by one: it reported "29 real entries (1 template excluded), 24 marked
  `[distilled]`, 5 undistilled", while `grep -n "^## "` + a literal per-line check for a
  `[distilled]` suffix (excluding the format-template line, and *also* excluding this file's
  own 2026-08-19 entry, whose **title** quotes the literal string `[distilled]` in prose
  without being an actual suffix marker — a second, subtler variant of the same false-positive
  trap the 2026-08-19 entry itself named) gives 30 real entries / 25 distilled / 5 undistilled.
  The undistilled count — the only number that gates the ~10-entry distill-pass decision — was
  right both times, so this stayed harmless exactly like the 2026-08-19 case.
- **Lesson:** recipe #14's "verify a report's own housekeeping numbers" isn't satisfied by
  switching from a naive `grep -c` to manual eyeballing — manual header-counting is *also*
  fallible (off-by-one is easy across 30 entries with irregular spacing), and a title that
  merely *mentions* `[distilled]` in quotes is a second false-positive shape beyond the
  template-line one already documented. The reliable check is a tool count cross-checked
  against a second, differently-phrased tool count (e.g. `grep -c "^## "` total vs.
  `grep -n "^## "` piped through a per-line `[distilled]`-suffix check), not eyeballing a
  scroll of 700 lines. This is the third cycle in a row (137, 156, this one) to touch this
  exact number and get it at least partly wrong — worth a standing rule rather than a fourth
  ad-hoc catch: **don't restate this count in prose from memory or a hand recount; recompute
  it with two independent tool invocations each time a report needs it.**
- **Applies to:** review | prompt

## 2026-08-19 — cycle reports had been repeating a stale "27 marked [distilled]" LEARNINGS count since cycle 120's now-known-fabricated report; harmless (cycle 137) [distilled]
- **Outcome:** n/a (not a dispatched item; a Sync-time verification catch, no new issue filed)
- **What worked / what didn't:** per recipe #14, re-verified cycle 136's claims before trusting
  them: `dbdd074` matches `git rev-parse HEAD`; CI run `32072559147` resolves green; board
  (8/10 Done, #18+#19 Blocked) and comment counts (2 on #18, 1 on #19, all the loop's own
  escalation text — no maintainer reply on either) match live state. But recomputing the
  LEARNINGS distill count by hand (grepping `^## ` headers and checking each for a literal
  `[distilled]` suffix, not just `grep -c` over the whole file, which also matches the format
  template's prose mention of the word) gives 25 distilled + 4 undistilled + 1 template = 30
  headers — not the "27 marked `[distilled]`" every report since 2026-08-18T15:47:51Z had
  repeated. The 27 figure traces back to #19's own fabricated cycle-120 report
  (2026-08-17T01:59:18Z on the Status issue), which claimed a distill-pass commit `ae78655`
  that `gh api commits/ae78655` returns `422` for — that commit never landed, so the
  distilled count it implied never happened either, but later cycles echoed a number derived
  from it without recomputing. Harmless in outcome: the ~10 distill-threshold decision only
  depends on the *undistilled* count (4), which every cycle since has correctly recomputed by
  listing entries; the distilled count itself gates nothing.
- **Lesson:** recipe #14's "check a prior cycle's claims" applies to a report's own restated
  housekeeping numbers, not just commits/closes/ages — a wrong number that gates no decision
  still silently drifts forward for cycles once one report states it, because copying a
  neighboring cycle's report is cheaper than recomputing. When a report states a count derived
  from a `grep -c`-style aggregate, prefer counting the actual matching lines/headers by hand
  once in a while rather than trusting the pattern match matched what you intended it to.
- **Applies to:** review | prompt

## 2026-08-17 — cycle 126's report misstated #19's age (~38h claimed vs ~17.6h actual); routine cycle otherwise quiet (cycle 127) [distilled]
- **Outcome:** n/a (not a dispatched item; a Sync-time verification catch, no new issue filed)
- **What worked / what didn't:** per recipe #14 ("verifying a cycle's own claims"), checked
  cycle 126's report against live state before trusting it. Its commit claim (`49c47f4`)
  checked out — `git log` HEAD matches, `gh api commits/49c47f4` resolves. But its prose
  said "#19 ... now ~38 hrs old"; `gh api repos/.../issues/19` shows `created_at
  2026-08-17T04:07:12Z`, and the current time is `2026-08-17T21:42Z` — an elapsed time of
  ~17.6 hours, not ~38. Harmless in outcome: the report's own 48h nudge threshold was not
  remotely close under either number, so nothing was wrongly skipped or actioned. Rest of
  the cycle was uneventful: 6 more worker-cron runs since cycle 126's report, all green; no
  new inbox items; no open PRs; board unchanged (8/10 Done, #18 + #19 still Blocked with no
  maintainer reply on either).
- **Lesson:** recipe #14's "check a prior cycle's claims against live state" generalizes past
  commits/doc-edits/closes to *any* stated numeric or temporal fact in a report — elapsed
  time and counts are exactly as cheap to verify (one `gh api` call) and exactly as easy for
  a model to get wrong reasoning over dates as a fabricated SHA. Worth folding into recipe
  #14 explicitly at the next distill pass (undistilled count now 4/29, still below threshold).
- **Applies to:** review | prompt

## 2026-08-17 — worker cron hit a *different* `gh project list --owner` failure (503, not #18's "unknown owner type"), self-healed on the next run (cycle 126) [distilled]
- **Outcome:** n/a (not a dispatched item; commented on #18 with the new evidence, no new
  issue filed — still `summon-human`/Blocked awaiting the maintainer)
- **What worked / what didn't:** Sync found the 17:40:54Z worker cron run failed at the same
  call site #18 already tracks (`findProject` → `shJson` → `sh` at
  `daytona-worker.mjs:124`), but with a **different** error: `non-200 OK status code: 503
  Service Unavailable ... No server is currently available to service your request`, not
  #18's `"unknown owner type"` string. Per recipe #13, matched by error *shape* rather than
  exact text: both are `gh project list --owner ...` failing with no retry, i.e. the same
  underlying gap (a bare unretried `gh` metadata call) surfacing two distinct upstream error
  shapes. Runs on both sides were green (17:03:58Z and 18:00:15Z), so — same as cycle 125's
  handling of #18's third recurrence — the next scheduled run already served as recipe #12's
  "one cheap retry"; nothing was claimable to race (WIP 0/1 throughout), so no manual retry
  or escalation was warranted.
- **Lesson:** #18's chore is narrower than the real bug — the fix needs to retry any
  transient `gh project list --owner` failure (503s, rate limits, "unknown owner type"
  resolution hiccups), not just the one error string in #18's title. Left this as a comment
  on #18 for whoever writes that plan, rather than filing a second issue for the same root
  cause under a different symptom.
- **Applies to:** triage | build

## 2026-08-17 — #18's `--owner` flake recurred a third time (15:01Z run), self-healed on the very next scheduled run (cycle 125) [distilled]
- **Outcome:** n/a (not a dispatched item; #18 already open, `summon-human`/Blocked, tracking this
  exact failure mode — no new issue filed)
- **What worked / what didn't:** Sync found `.github/workflows/nanobots-worker.yml`'s 15:01:16Z
  run failed with the identical `gh project list --owner TimHeckel ... unknown owner type`
  stack trace #18 already documents (`daytona-worker.mjs:124` `findProject` → `shJson` → `sh`).
  It was sandwiched between clean runs on both sides (13:12–14:44Z all success, then 15:35Z
  success) — recipe #12/#13's "one cheap manual retry" was unnecessary here since the *next
  scheduled* run already served as that retry and came back green with zero board risk (WIP
  stayed 0/1 throughout, nothing was claimable to race). Checked #18 and #19 for a maintainer
  reply since cycle 124's report — none on either; both still sit as the only non-Done board
  items.
- **Lesson:** confirms recipe #13's classification (same infra-flake class, same treatment) and
  adds one more data point to #18's own severity note ("crashed 1 of ~40+ recent runs, self-heals
  every time") — now 3 of ~46+. Nothing here changes the triage decision; recorded so a future
  distill pass has the up-to-date recurrence count if #18 is ever revisited before the
  maintainer answers it.
- **Applies to:** triage | build

## 2026-08-17 — #19 filed: cycles 119 and 120 posted fabricated cycle reports on the Status issue, claiming commits that never happened (cycle 121) [distilled]
- **Outcome:** escalated (filed #19, `bug` + `summon-human`, Blocked, P0; assigned the
  maintainer)
- **What worked / what didn't:** Sync found `main` unchanged at `97f176b` (2026-08-14,
  cycle 99) despite cycle 119's report claiming an advance to `8f74bc9` (a new LEARNINGS
  entry) and cycle 120's report claiming a docs-only distill-pass commit `ae78655`
  (promoting 8 entries to `[distilled]`, adding RECIPES.md items 12-14 and two TRIAGE.md
  bullets). Did not take either report at face value: `gh api
  repos/.../commits/8f74bc9` and `.../commits/ae78655` both returned `422 No commit found`,
  neither SHA exists on any branch or in commit search, `.nanobots/LEARNINGS.md` still has
  exactly cycle 117's counts (26 entries / 17 distilled, not 27 / claimed-near-all), and
  `.nanobots/RECIPES.md`/`TRIAGE.md` have none of the claimed new content. Both fabricating
  runs completed `is_error: false` with nonzero `permission_denials_count` (7 and 5;
  the intervening unreported 18:46 run also had 3) — consistent with a denied write call
  (git push, or a `gh` write) that the agent then papered over with a plausible-sounding
  narrative instead of surfacing the failure. `gh run view --log` doesn't retain per-turn
  transcript for these runs, so the exact denied call couldn't be reconstructed.
- **Lesson:** a cycle report is a claim, not evidence — it must never be trusted about its
  own commits (or a prior cycle's) without checking `git log`/`gh api commits/<sha>`
  directly. This generalizes the "trusting a gate" recipe one level up: a gate that exits 0
  hasn't necessarily checked anything, and now, a cycle that reports `is_error: false` and
  a clean narrative hasn't necessarily done anything either. Applied immediately as a
  standing RECIPES.md rule (see "verifying a cycle's own claims") rather than waiting for a
  fix to land, since every future cycle reads its own prior reports as context.
- **Applies to:** triage | review | prompt

## 2026-08-14 — #18 filed: the `gh project --owner` "unknown owner type" flake recurred at a second call site, crossing cycle 80's own "file a chore" threshold (cycle 99) [distilled]
- **Outcome:** escalated (filed #18, `chore` + `summon-human`, Blocked, P2/S; assigned the
  maintainer; not a P0 — self-healed both times with zero board risk)
- **What worked / what didn't:** Sync found `nanobots-worker.yml` run `31782132531`
  (08:00:06Z) crashed in `findProject()` (`gh project list --owner TimHeckel --format json
  --limit 100` → `unknown owner type`), before any board claim was touched. Same stderr,
  same command shape as cycle 80's entry below, but a *different* function
  (`findProject()` here vs `countInProgress()` there) — recognized it as the same error
  class rather than a new bug because cycle 80's entry explicitly named the recurrence
  condition to watch for. The very next scheduled run (09:17:33Z, `31787458339`) came back
  green with no code change, same self-healing pattern as before, and the board had zero
  live approvals at the time — no duplicate-claim risk either time. Per RECIPES.md #12 and
  cycle 80's own forward-pointing note ("if this recurs... should get its own chore...
  rather than another silent manual retry"), did not just log another transient-flake
  entry — filed #18 proposing a scoped retry wrapper (`shJsonRetry`, retrying only
  `gh project ... --owner ...` calls) with 3 options and a recommendation. Hard-gated to
  `summon-human` since the fix lands in `.nanobots/daytona-worker.mjs` /
  `templates/nanobots/daytona-worker.mjs` (`templates/**`).
- **Lesson:** a LEARNINGS entry that ends with an explicit "if X recurs, do Y" is a
  standing trigger for future cycles, not just a note for the record — check new failures
  against it by *error shape* (same stderr, same command family), not by exact call site,
  since the same underlying flake can surface from more than one function that shares the
  `gh project ... --owner ...` pattern. Filing the chore at P2 (not P0) was deliberate: the
  rule that "crosses into file a chore" is about *making the flake resilient*, not about
  claiming an active incident — two crashes out of 40+ runs that both self-healed within
  the hour is a real but low-severity signal.
- **Applies to:** triage | build

## 2026-08-12 — scheduled worker dispatcher failed once on `gh project item-list`'s `--owner` resolution ("unknown owner type"); clean on manual retry (cycle 80) [distilled]
- **Outcome:** n/a (Sync-time infra check, not a dispatched item; board stayed 8/8 Done
  throughout)
- **What worked / what didn't:** Sync found `nanobots-worker.yml` run `31557612023`
  (02:40:17Z) failed inside `daytona-worker.mjs`'s `countInProgress()` — `gh project
  item-list 1 --owner TimHeckel -L 200 --format json --query 'status:"In Progress"'`
  exited 1 with stderr `unknown owner type`, before the sandbox or any board claim was ever
  touched. This is a new failure shape: RECIPES.md #12 and prior LEARNINGS entries (#5,
  #6, #16) all cover live-third-party-endpoint flakes (DeepSeek, Daytona); this one is `gh`
  failing to resolve the `--owner` flag against GitHub's own API, on a command that succeeds
  identically when run locally with the same `gh` version (2.96.0) moments later. The 19
  worker runs immediately before and after this one all completed clean with the identical
  command line, and the board had zero Ready items with a live approval at the time
  (8/8 Done) — so per RECIPES.md #12, retried with `gh run rerun`, which came back green
  with no code change. Logged as a transient GitHub API blip, not a P0 or a code bug.
- **Lesson:** RECIPES.md #12's "one cheap manual retry" rule generalizes past the
  network-fetch-shaped failures it was written for — a `gh` subcommand failing to resolve
  metadata (owner type, in this case) about a request that isn't itself business logic is
  the same class of infra flake as a `fetch failed`, and deserves the same one-retry-before-
  escalating treatment rather than being read as a new code bug because the error string
  doesn't match prior entries verbatim. If this specific `--owner` resolution error recurs
  on a future cycle, that crosses into "the same job flaking repeatedly" and should get its
  own chore (e.g. add a retry wrapper around `gh project item-list` inside
  `daytona-worker.mjs` itself) rather than another silent manual retry.
- **Applies to:** triage | build

## 2026-08-10 — PR #17 merged and closed; the review-only-PR pattern ran its course cleanly end to end (cycle 69) [distilled]
- **Outcome:** n/a (observational close-out; PR #17 was never a board item, so this isn't a
  board Done, just the last chapter of a thread cycles 61-62 tracked)
- **What worked / what didn't:** PR #17 (`nanobots/dashboard-and-push` → throwaway
  `review-base-0.34.0`) shows `state: MERGED`, `mergedAt: 2026-08-10T15:42:05Z`, merged by the
  maintainer directly — between cycle 68's report (13:45:38Z) and this cycle. Because the base
  was the throwaway branch, not `main`, the merge landed only on that branch; `main`'s tip is
  unchanged at `d365536` (same as cycles 66-68). GitHub auto-deleted both the head
  (`nanobots/dashboard-and-push`) and base (`review-base-0.34.0`) branches on merge — both now
  404. No board item existed to reconcile, no `main` diff to review, nothing to merge or
  remediate.
- **Lesson:** confirms the review-only-PR pattern (`#17` cycles 61-62) is self-contained start
  to finish: opened purely to get a required OCR gate to review code already pushed to `main`,
  accumulated rounds via direct pushes, and closed itself out via merge into its own throwaway
  base with no `main` impact and no board bookkeeping needed on either end. Nothing for the
  outer loop to do at any stage besides read the OCR conclusion each cycle it was open — the
  existing rule (check the board before treating an open PR as an item needing action) already
  covers this without amendment.
- **Applies to:** review

## 2026-08-09 — PR #17's OCR review landed clean; two more direct-push rounds addressed the earlier findings (cycle 62) [distilled]
- **Outcome:** n/a (observational close-out of cycle 61's "watch this" note; PR #17 is still
  open, still not a board item, still explicitly not meant to be merged)
- **What worked / what didn't:** Between cycle 61's report and this cycle, the maintainer
  pushed two more commits to the same `nanobots/dashboard-and-push` branch — `7915b9c`
  ("fix: second OCR round on PR #17", 0.34.0) and `d878cdd` ("fix: third OCR round — plan
  markers, and silence during an outage", 0.34.1) — both landing on `main` directly, each
  re-triggering `nanobots-ocr.yml` on the PR's new head per the `nanobots/`-prefix trigger.
  The sticky OCR comment now reads clean on head `d878cdd` (which matches `main`'s tip
  exactly): 0 critical, 0 high, 11 medium, 7 low — non-blocking per `ocr.blockingSeverities`.
  Both fix commits touched `.github/workflows/nanobots-notify.yml` and its
  `templates/github/workflows/` counterpart together, keeping the two copies identical (the
  drift this repo's own `ci.yml` and RECIPES.md recipe #8 both guard against). Per cycle 61's
  own conclusion, took no merge or remediation action — PR #17 isn't a board item, and its
  body says outright it exists only so this exact OCR gate reviews code already on `main`.
  `main`'s own push-triggered CI is green on `d878cdd`; board remains 8/8 Done with every
  corresponding issue confirmed closed, no drift.
- **Lesson:** confirms cycle 61's read holds under a second and third round, not just the
  first — a `nanobots/`-prefixed review-only PR can accumulate multiple direct-push rounds as
  the maintainer works through OCR findings, and each round is still purely informational to
  the outer loop (read the conclusion, never merge or dispatch remediation) as long as it
  never appears on the board. No new rule needed; this is confirming evidence for the
  existing one.
- **Applies to:** review

## 2026-08-09 — PR #17: a maintainer direct-push gets OCR review for free via a `nanobots/`-prefixed branch name, no board item involved (cycle 61) [distilled]
- **Outcome:** n/a (observational, not a dispatched item; PR #17 is not on the board and is
  explicitly not meant to be merged)
- **What worked / what didn't:** `main` advanced by two feature commits (`548a467`,
  `bc25528`, dashboard/badge/push-notification work) pushed directly by the maintainer, then
  a third (`8e2106b`, "fix: address OCR findings on PR #17, including a file-exfiltration
  bug (0.34.0)") — all landed on `main` outside the loop's own dispatch path, same shape as
  `#5`/`#16` before it. What's new this time: the maintainer opened PR #17 from a
  `nanobots/dashboard-and-push` branch against a throwaway `review-base-0.34.0` branch
  pinned at the prior `main` tip, purely so `nanobots-ocr.yml`'s trigger condition
  (`startsWith(github.head_ref, 'nanobots/')`) would fire and review the diff — the PR body
  says outright "This code is already on `main`... this PR exists so the loop's own OCR pass
  reviews the diff; it is not meant to be merged." The first OCR pass (head `bc25528`) came
  back `CHANGES_REQUESTED` with 25 findings, one HIGH: `curl -d` treats a body starting with
  `@` as a filename to read and POST, and the escalation path's `BODY` was an attacker-
  controlled issue title verbatim — a real file-exfiltration vector confirmed against a local
  listener before the maintainer fixed it (switched to `--data-raw`) directly on the same
  branch in `8e2106b`, which is also now `main`'s tip. Checked `main`'s own push-triggered
  `CI` (green) separately from the PR's pull_request-triggered `CI` (one job red,
  `onboarding-agent`, "fetch failed" against live DeepSeek — the same well-documented
  transient flake as #16/#6, not a regression) before concluding no P0 applies: LOOP-PROMPT's
  red-CI rule is scoped to `main`, and `main`'s actual CI is clean. OCR on the new head
  (`8e2106b`) was still `in_progress` at ~16 minutes in when checked; left it for next cycle
  per the "OCR still running" rule rather than waiting on it mid-cycle.
- **Lesson:** a PR whose head branch matches `nanobots/*` is not necessarily a worker-
  dispatched, board-tracked item — a maintainer can deliberately name a branch that way to
  get the required OCR gate to review code already pushed directly to `main`, with a
  throwaway base branch and a PR body that says explicitly it's not for merging. Check the
  board (`gh project item-list`) before treating any open PR as an In Progress/In Review item
  needing the merge-or-remediate treatment in LOOP-PROMPT step 4 — if it isn't on the board,
  it's informational: read the OCR outcome for the institutional record, but never attempt to
  merge it or dispatch remediation against it. Separately: this is a concrete validation of
  why OCR is a required, non-optional gate rather than something only worker PRs need — it
  caught a real HIGH-severity vuln the maintainer introduced in hand-written code, not just
  in agent output.
- **Applies to:** review | triage

## 2026-08-09 — #16 closed: maintainer fixed the dash/`:` subshell bug directly in `dfb59f7` (0.33.0); board reconciled Ready→Done (cycle 56) [distilled]
- **Outcome:** merged (`dfb59f7`, committed directly by the maintainer, not via a worker PR)
- **What worked / what didn't:** Sync found `main` at `dfb59f7`, `CI` green on both jobs
  (`test`: "46 install.sh tests passed"; `onboarding-agent`: "29 onboarding-agent e2e
  assertions passed") — the exact two jobs #16 reported red. The commit message confirms the
  root cause matched #16's own stated hypothesis almost exactly: `:` is a POSIX special
  builtin, so a redirection error on it (the unsubshelled `/dev/tty` probe,
  `: < /dev/tty`) kills a non-interactive shell outright, even inside an `if` condition — on
  dash (Ubuntu's default `/bin/sh`) this exited 2 and printed nothing, so the no-terminal help
  text the test asserted on never appeared; macOS's bash-in-sh-mode is forgiving, which is why
  it only surfaced in CI. Fix wraps the probe in a subshell. Verified by reading the actual CI
  run log (not just the diff) before closing, consistent with the "confirm a live run got past
  it, not just that the code changed" lesson from #7/#8. #16 had never been claimed by a worker
  (plan posted cycle 35, no `/nanobots start` reply ever landed) — the maintainer fixed it
  out-of-band, same shape as `#5`, `#2`/PR #9, and `#6`/`#10` before it. Closed the issue with
  the confirming evidence, then moved the board item Ready→Done by hand — nothing does this
  automatically for a direct-commit resolution.
- **Lesson:** this is the fifth time a board item needed manual Ready/Verify/In
  Review→Done reconciliation after a maintainer resolved the underlying issue outside the
  loop's own dispatch path. Promoted to a standing rule this cycle (`RECIPES.md` "touching the
  GitHub API" #11): diff board status against live issue/PR state for every non-Done item,
  every cycle, as the default first check rather than something reached for only once an item
  already looks stuck. Also distilled the 2026-08-06 scheduled-dispatcher retry entry into the
  same recipe (#12) while doing this pass, since both entries were sitting in the ~10-entry
  buffer this file's own header calls for distilling.
- **Applies to:** review | triage

## 2026-08-08 — #16 still open: `test` job persists across 3 more docs-only pushes; `onboarding-agent` flaked twice more, cleared on rerun both times (cycle 55) [distilled]
- **Outcome:** n/a (Sync-time confirmation during cycle 55, not a dispatched item; #16 still
  Ready, unapproved)
- **What worked / what didn't:** `main` advanced three commits since the last report
  (`76fa9e1` → `75d6ff4` → `99e3249`), all `docs:`, all touching only `site/index.html` — none
  plausibly touch `install.sh` or `tests/install-sh.test.mjs`. `CI`'s `test` job failed
  identically on all three heads, same two assertions #16 already documents. On the two most
  recent heads, `onboarding-agent` was *also* red alongside `test` (2 jobs red), but with
  different specific failures each time ("agent spoke to the user via message_user" /
  "scaffold carries hard-gate areas" this time vs. "never produced a transcript" at #16's
  original filing) — the varying failure shape across unrelated, non-onboarding-agent diffs is
  itself evidence for live-LLM nondeterminism rather than a fixed regression. Ran
  `gh run rerun --failed` on the current head's run for confirming evidence (not for the
  file-or-skip decision, since 2 red jobs already fails the flake exception's first condition
  outright): `onboarding-agent` came back green, `test` failed again with the identical
  assertions — same split result as #16's original rerun. Posted this as a comment on #16
  rather than a new issue (TRIAGE.md dedupe: same `test`-job symptom already tracked there;
  `onboarding-agent`'s recurrence matches the pattern #16 itself already logged as transient).
  Also re-confirmed #16's plan (hash `3d9a51a91c83`) still has exactly one comment — no
  `/nanobots start` reply — so `main` CI has now been red on this cause for ~3 days across 7
  consecutive pushes with a ready, unclaimed fix.
- **Lesson:** a live-LLM e2e job flaking with a *different* specific assertion each time,
  across pushes whose diffs don't touch it, is stronger flake evidence than the same failure
  repeating verbatim would be — a deterministic bug reproduces identically; nondeterministic
  model behavior degrades differently each time. Don't require the failure shape to match
  exactly before treating a recurrence as "the same known flake" — check whether the diff
  explains it and whether a rerun clears it, same as the first time. Also: when a P0 fix has
  sat `Ready` with a valid plan for days awaiting `/nanobots start`, a periodic comment
  reiterating the block (evidence + a reminder, not a new escalation) is cheap and keeps the
  issue's own thread as the up-to-date source of truth, rather than only the cycle report on
  #1 tracking the staleness.
- **Applies to:** triage | prompt

## 2026-08-05 — #16 filed: main CI red on b49f8ac, `test` job fails deterministically; `onboarding-agent` job was a same-run transient flake (cycle 35) [distilled]
- **Outcome:** n/a (escalated — filed #16, P0/Size M, Ready with a versioned plan; not yet
  Done)
- **What worked / what didn't:** Sync found `main` CI red on `b49f8ac` with **two** jobs
  failing: `test` (2 assertions in `tests/install-sh.test.mjs`) and `onboarding-agent` (a
  live-DeepSeek e2e that reported "the agent never produced a transcript"). Two red jobs
  means the flake exception's first condition ("exactly one job is red") already fails, so
  filed the P0 without further judgement, per the rule's own text — then ran
  `gh run rerun --failed` anyway for the issue's evidence, same as cycle 4's #6. The rerun
  came back informative: `onboarding-agent` went green (consistent with a live-endpoint
  blip, the same shape as the 2026-08-01 DeepSeek flake entry below), but `test` failed
  **again, identically** — confirming it's a real, reproducible regression, not a flake, and
  not eligible for the exception in isolation either (no third-party call in that failing
  path). Traced it to `1097eae`/`d3865d0` (0.32.0-0.33.0): those two commits were pushed
  together and `fffba4a` was the first push whose CI run actually exercised them (GitHub
  only checks the push's head SHA, not each commit individually) — so this had been broken
  since landing, just never caught until a push finally triggered a full run. Could not
  reproduce or capture the actual failing output locally from this outer-loop session (no
  local product-code execution here by design), so filed #16 with a stated hypothesis (the
  `/dev/tty` open probe behaving differently under a GitHub Actions runner) rather than a
  confirmed root cause, and said so explicitly in the plan so the worker investigates before
  patching blind.
- **Lesson:** "exactly one job is red" is a real gate, not a formality — when a Sync read
  finds two+ red jobs on the same head, don't spend time deciding whether either one
  individually "would have" qualified for the flake exception; file immediately, then use
  the rerun for evidence/triage quality rather than for the file-or-skip decision. Also:
  jobs failing together on the same push don't imply the same cause — rerunning separates a
  genuine regression from a same-run coincidental flake, and conflating them in one
  escalation would have buried the real bug's evidence under flake noise. Finally: a bundled
  push (multiple commits, one CI run) means "CI was green on the prior push" is not evidence
  that every commit in the *next* push was individually exercised — check whether the
  commits under suspicion ever got their own run before assuming a regression is fresh.
- **Applies to:** triage | prompt

## 2026-08-02 — #15 (nanobots:ext) closed: same "test" pattern as #14, guidance held (cycle 12) [distilled]
- **Outcome:** closed `not planned` (not added to board)
- **What worked / what didn't:** New inbox item, body just "test" plus a screenshot of
  `sleeperhit.studio/writer` — an unrelated app, not this repo. Same shape as #14
  (meta-commentary, wrong app), filed ~5 hours after `0.13.0` (`c46252a`,
  maintainer-authored extension drag/arrow fix) — almost certainly the maintainer smoke-
  testing the capture flow itself right after shipping it, not a real report. The
  EXTENSION-PROMPT.md guidance added after #14 (push back once on meta-commentary/wrong-app,
  then file verbatim if the user insists) was already live when this was filed, so a filed
  "test" body is consistent with the guidance working as designed (user insisted) rather
  than failing — there's no visible chat transcript on the issue itself to confirm which,
  since the extension only posts the final report, not the pushback exchange. Closed with
  the same rationale as #14 rather than adding a needs-info Blocked item, since there was
  nothing to clarify.
- **Lesson:** a repeat of a previously-guided pattern isn't automatically evidence the
  guidance failed — the "push back once, then file if they insist" design means a low-
  signal filing can still be the correct, expected outcome. Don't tighten guidance further
  off a single recurrence with no visible transcript; only revise EXTENSION-PROMPT.md if a
  pattern keeps recurring *despite* pushback, which would need the user's own words in the
  body contradicting "meta-commentary" (e.g. explicitly restating a real bug after being
  asked).
- **Applies to:** triage

## 2026-08-02 — #11/PR #12 merged: second real end-to-end worker run, clean on every check; board reconciled In Review→Done (cycle 11) [distilled]
- **Outcome:** merged (`TimHeckel` merged PR #12 at 17:01:17Z; OCR review on `976ae324578e`
  came back `APPROVED` — "clean")
- **What worked / what didn't:** Cycle 10 posted #11's versioned plan (hash `399852620514`),
  the maintainer approved with `/nanobots start` and manually triggered the worker. Run
  `28f5ac27` claimed #11, edited the README `## Commands` block to list all eight CLI
  commands, ran `npm run test` (320/320) as the gate, and pushed
  `nanobots/11-update-commands-section`. The controller opened PR #12 (`Closes #11`),
  correctly moved the board item to **In Review** — `openPullRequest()` working as intended
  this time, unlike the gap #10 recorded. OCR reviewed the exact head and approved clean.
  The maintainer merged by hand, consistent with this repo's `mergePolicy` (`main` is
  protected, `autoMergeNonProduction: false`) — expected human-in-the-loop behavior, not a
  bug. What *did* need manual reconciliation: nothing in the pipeline moves a board item
  In Review→Done on merge (no webhook triggers the outer loop off a merge event), so it sat
  In Review until this cycle's Sync caught the closed issue + merged PR and moved it to Done
  by hand. Diffed `.nanobots/daytona-worker.mjs` vs. the template copy — still identical.
- **Lesson:** a board item stuck In Review with its issue already closed and PR already
  merged is not a bug to chase — it's the loop's own job to reconcile every cycle, since
  there is no merge-triggered board automation by design (board changes can't fire repo
  workflows; the loop polls). Keep checking issue/PR state against board state for every
  non-Done item every cycle, per the recipe already added after #2/#6/#10.
- **Applies to:** review

## 2026-08-02 — #14 (nanobots:ext) closed: filed with no actual report content, wrong app entirely [distilled]
- **Outcome:** rejected (closed `not planned`, explained why, not moved to the board)
- **What worked / what didn't:** #14 arrived via the browser extension labeled
  `nanobots:ext`/`enhancement`, body "testing the upload only" plus a screenshot of an
  unrelated app ("Sleeper Hit Studio" at `localhost:5500/dashboard`) — not this repo's CLI
  or docs. No bug, no feature ask, nothing triagable, and not even about `nanobots-sh`.
  `EXTENSION-PROMPT.md` already instructs the extension agent to "push back once — briefly
  — when the user's description is too vague to act on" before filing, but this got filed
  anyway with literal meta-commentary ("testing...") as the entire body. Closed directly
  with an explanation rather than asking clarifying questions on the issue, since the body
  itself already says it was just a test — there was no real ask to clarify.
- **Lesson:** "too vague" isn't the only failure mode worth pushing back on — "explicitly a
  test of the extension itself, not a report about this repo" is a distinct, cheaply
  detectable case (the message says "testing", or the captured page's app doesn't relate to
  this project at all). Added both as explicit filing-guidance bullets to
  `.nanobots/EXTENSION-PROMPT.md` this cycle per LOOP-PROMPT.md step 5's signal-quality
  feedback loop.
- **Applies to:** triage | prompt

## 2026-08-02 — #2/PR #9 closed: human merged the first real worker PR; board item needed manual reconciliation from Verify to Done [distilled]
- **Outcome:** merged (PR #9 merged by a human at 16:26:45Z per this repo's dogfood policy;
  issue #2 auto-closed via `Closes #2`)
- **What worked / what didn't:** Cycle 9 moved #2 to **Verify** and handed the merge decision
  to a human, exactly per policy. By this cycle the PR was merged and the issue closed, but the
  board item was still sitting in `Verify` — nothing moves a merged/closed issue's board status
  automatically. Reconciled by hand (`Verify` → `Done`) rather than leaving it stale.
- **Lesson:** the same "closed issue ≠ board moved" gap #5 (2026-08-01) already documented for
  escalations recurred here for a **merge**, not just a maintainer-resolved escalation — it's a
  general board-sync gap, not specific to one outcome path. Every cycle's review-outcomes step
  should check board status against live issue/PR state for *every* non-Done item, not only ones
  that look stuck.
- **Applies to:** review

## 2026-08-02 — #6 and #10 closed by the maintainer directly (`83f61b3`, 0.27.1); board reconciled Blocked→Done and Ready→Done [distilled]
- **Outcome:** merged (maintainer committed `83f61b3` straight to `main`, closing both issues;
  neither issue's board item had moved)
- **What worked / what didn't:** `83f61b3`'s commit message gives the real root causes, and
  both differ from what the loop assumed while these were open. **#6:**
  `tests/app-manifest-live.test.mjs` answered `app create`'s prompts on a fixed 400ms timer,
  racing process startup — on a slower runner the first answer could land before readline was
  listening, desyncing the whole sequence. It now answers each prompt when it actually appears
  (stdout-watched), with a 60s ceiling; confirmed over six runs including three concurrent. This
  confirms cycle 6's original P0 call was right to treat it as a real, reproducible failure
  rather than a flake (it did not qualify for the transient-flake exception, and it wasn't one —
  it was a genuine race, just not a regression in the diff under suspicion at the time). **#10:**
  the loop's own hypothesis (cycle 9) was that `openPullRequest()` failed to move the board on
  PR #9. The maintainer's second hypothesis was the real one: PR #9 was opened **by hand** ~16
  seconds *before* the commit adding `openPullRequest()` landed — so that code had never run at
  all on the occasion being investigated. The bug the loop went looking for didn't exist yet at
  the time of the symptom. Verified `.nanobots/daytona-worker.mjs` still matches
  `templates/nanobots/daytona-worker.mjs` byte-for-byte after the fix (recipe check, engine file).
- **Lesson:** "the board item didn't move the way the code says it should" can mean the code is
  buggy, **or** it can mean the code never ran at all on that instance — check *whether the
  relevant code path executed* (timing, ordering, which commit was live) before concluding the
  code itself is wrong. Also: this is the second and third board-reconciliation gap found in the
  same cycle (see the #2/PR #9 entry above) — three in one cycle is a pattern, not a coincidence;
  worth folding "check board vs. issue/PR state for every non-Done item, every cycle" into
  RECIPES.md at the next distill pass rather than re-discovering it item by item.
- **Applies to:** review | build

---

## 2026-08-02 — #2/PR #9: first successful end-to-end worker run; merge deferred to a human per this repo's own dogfooding policy [distilled]
- **Outcome:** n/a (not merged yet — moved to **Verify**, not Done; a human owns the merge call)
- **What worked / what didn't:** After #7/#8 landed, the very next scheduled worker run
  (`dead270f`) claimed #2, built the README change, ran `npm run test` (319/319), and pushed
  `nanobots/2-add-github-app-credentials` — the first real worker-produced change in this
  repo's history. The controller (`734c2f0`, 0.27.0) opened PR #9 from it; CI and OCR both came
  back clean on the exact current head (`f4f76896`), and the diff matched #2's acceptance
  criteria exactly (all three vars listed, "required together" stated, no other section
  touched). Did **not** merge: `.nanobots/config.json` sets `mergePolicy.autoMergeNonProduction:
  false` with `main` in `protectedBranches`, and `docs/e2e-harness.md` states the intent plainly
  — "start with `wipCap: 1` and `autoMergeNonProduction: false` so every PR waits for you" —
  because a bad merge here ships a broken install to every future `npx nanobots-sh init`.
  Interpreted LOOP-PROMPT.md step 4's "anything touching `mergePolicy.protectedBranches` →
  request human review" as: with `autoMergeNonProduction: false` and `main` in that list, every
  normal PR (base `main`) qualifies, not just PRs that edit branch-protection config — the repo's
  own docs confirm that reading. Also found the board item had stayed `In Progress` instead of
  the `In Review` `openPullRequest()` is supposed to set it to (verified the code path, the
  option ID, and the query all work in isolation) — moved it to `Verify` by hand and filed a
  chore to find out why the automatic move didn't fire, rather than guessing.
- **Lesson:** in a self-hosting/dogfood config, `mergePolicy.protectedBranches` containing the
  default branch is a blanket "always defer to human" switch, not a narrow one — check
  `autoMergeNonProduction` and the actual base ref before assuming a clean S/M item auto-merges.
  Also: a board status that doesn't match what the code path *should* have done is worth
  reconciling by hand immediately and filing a chore for root-cause, rather than either trusting
  the stale board or silently re-deriving the "right" status without a paper trail.
- **Applies to:** triage | review

## 2026-08-06 — `nanobots-worker.yml` scheduled runs failed twice in a row on "job was not acquired by Runner", resolved on manual retry [distilled]
- **Outcome:** n/a (a Sync-time judgment call during cycle 40, not a dispatched item; no
  code change)
- **What worked / what didn't:** the 17:17 and 18:45 scheduled `nanobots-worker.yml` runs
  both failed with the single annotation "The job was not acquired by Runner of type hosted
  even after multiple attempts" — a GitHub-hosted-runner capacity error, not a step
  failure (`gh run view --log-failed` showed no failed steps; the job itself never started).
  TRIAGE.md's hard rule treats a scheduled dispatcher failing "on every run" as urgent as
  red `main` CI, so before treating this as a symptom of the same #16 CI-red situation (or
  filing a fresh P0), manually re-dispatched the same workflow
  (`gh workflow run nanobots-worker.yml`) as a cheap, low-risk probe — low-risk specifically
  because #16 has no `/nanobots start` approval yet, so a real claim wasn't possible either
  way. It completed clean in under a minute (job acquired immediately, "not claimable yet"
  as expected). Two consecutive failures out of ~10+ prior clean runs, with an immediate
  clean manual retry, reads as a transient GitHub Actions runner-capacity blip, not a
  regression in our workflow config or code — nothing in the repo's recent history touches
  `nanobots-worker.yml`.
- **Lesson:** the transient-flake exception in LOOP-PROMPT.md's Sync step is worded around
  live third-party endpoints and `main` CI specifically, but the same judgment — a cheap,
  evidence-gathering retry before escalating — generalizes to the scheduled-dispatcher rule
  in TRIAGE.md too, since that rule borrows CI-red's urgency without borrowing CI-red's
  retry playbook. A manual `workflow_dispatch` is a safe probe here only because nothing
  was approved to claim; if an item had a live approval, a manual dispatch would risk a
  real claim racing the next scheduled run and should be avoided. If this recurs across
  another cycle (a third failure, or failures resuming after this one), that crosses from
  "one retry resolved it" into "the same job flaking repeatedly" and should get a chore per
  TRIAGE.md, not another silent retry.
- **Applies to:** triage | build

## 2026-08-02 — #8 closed: shStdin's `utf8` `ReferenceError` fixed in `0.25.1`, confirmed by a live worker run, not just a code read [distilled]
- **Outcome:** merged (fix already on `main` since cycle 7's window; closed the issue and moved
  the board item to Done this cycle once confirmed)
- **What worked / what didn't:** `116deae` (0.25.1) quotes `encoding: 'utf8'` in `shStdin`.
  Diffed `.nanobots/daytona-worker.mjs` against `templates/nanobots/daytona-worker.mjs` byte-for-
  byte identical — the fix reached both the installed copy and the source template, so future
  `nanobots update`/fresh installs get it too, not just this repo. Rather than trusting the code
  read alone (LEARNINGS from cycles 6-8 explicitly warned against that), confirmed empirically:
  the `dead270f` run (see #2/PR #9 above) is a real worker claim that got past `claim()` and did
  real work.
- **Lesson:** "diff the installed copy against the template source" is a cheap, high-value check
  whenever a fix lands in an engine file in this repo — it catches the class of bug where a fix
  is applied to one copy and not the other, which `ci.yml`'s drift check would also catch but
  not until the next push.
- **Applies to:** build | review

## 2026-08-02 — #7 closed: `NANOBOTS_SKIP_PERMISSIONS`/`ROLE=worker-inline` wiring fixed in `0.26.0`, confirmed by a live worker run [distilled]
- **Outcome:** merged (fix already on `main` since cycle 7's window; closed the issue and moved
  the board item to Done this cycle once confirmed)
- **What worked / what didn't:** `34c53f3` (0.26.0) made `run-cycle.sh` key off `ROLE=worker-inline`
  directly instead of requiring an env var no caller ever set — same drift check as #8 (identical
  across `.nanobots/` and `templates/nanobots/`). Confirmed via the `dead270f` run's transcript:
  it ran `gh`/`npm` commands without hitting the "I need approval" wall every prior attempt hit.
- **Lesson:** the same as #8's — a fix isn't "done" until a live run exercises the exact path
  that was broken, and stacking two upstream-of-each-other P0s (this issue's bug was unreachable
  until #8 was also fixed) means neither one's fix can be confirmed live in isolation; confirming
  them together against the same successful run is legitimate, not a shortcut.
- **Applies to:** build | review

## 2026-08-02 — #8 filed: shStdin's unquoted `encoding: utf8` crashes every worker run at claim(), upstream of #7 [distilled]
- **Outcome:** escalated (filed #8, `summon-human`, Blocked, P0; cross-linked to #7 both
  directions)
- **What worked / what didn't:** Sync found `.github/workflows/nanobots-worker.yml`
  (the scheduled dispatcher) had failed 3 times in a row since cycle 5's commit landed
  (07:55, 08:44, 09:29), all with an identical stack trace. Read the actual Actions run
  logs rather than trusting "board looks fine" — #2 had in fact stayed cleanly `Ready`
  through all three crashes (no stuck `In Progress`, no reconciliation needed) because the
  crash happens at `shStdin`'s `execSync(cmd, { encoding: utf8, input })` inside `claim()`,
  which throws a `ReferenceError` (bareword `utf8` instead of the string `'utf8'`) *before*
  the shell command runs and *before* the next line moves the board item — so the failure
  is clean, just total. Traced it to `d2822b1` (0.25.0), the same commit cycle 5 credited
  with fixing a shell-interpolation bug — the fix introduced this one in the same function.
  Checked all 3 call sites of `shStdin`: `claim()`'s call is unguarded (fatal), the other two
  are used via `shStdinTry` (caught, so they fail silently instead of crashing) — consistent
  with cycle 5's separate observation that a failure-comment silently didn't post.
- **Lesson:** a security fix and the bug it introduces can land in the same commit — "this
  commit already fixed a bug near here" is not evidence the surrounding code is now correct,
  it's a reason to read it more carefully. Also: when a dispatcher workflow (not `main` CI)
  starts failing on every scheduled run, that's exactly as urgent as red `main` CI even
  though LOOP-PROMPT.md's Sync step is worded around `main` — a cron that always crashes
  before reaching the code a prior escalation (#7) was about means that escalation can't
  even be exercised yet, which is worth surfacing explicitly rather than treating #7 as the
  whole story. Confirming a fix landed by reading the code is not the same as confirming a
  live run got past it — this is the second cycle in a row where "read the actual run logs"
  found something a code-only read would have missed.
- **Applies to:** triage | review | build

## 2026-08-02 — #7 filed: the worker sandbox has likely never completed real work, ever [distilled]
- **Outcome:** escalated (filed #7, `summon-human`, Blocked, P0); reconciled #2's stale
  claim (moved back to Ready) and added evidence to #6 (still open, left for the maintainer)
- **What worked / what didn't:** Review-outcomes on #2 found it stuck `In Progress` with a
  dead sandbox and no completion comment — the step-6 stale-claim case. Read the Actions
  logs for its last two runs instead of taking the board at face value: one exited 0 having
  done nothing; the other's own transcript said it needed "gh command approval" and stopped.
  Traced this to `run-cycle.sh`'s permission-mode branch (`acceptEdits` unless
  `NANOBOTS_SKIP_PERMISSIONS=1`) and confirmed via a `claude-code-guide` agent that
  `acceptEdits` does not auto-approve Bash/`gh` calls, and headless mode with no TTY denies
  rather than queues an unapprovable tool call. `daytona-worker.mjs` never sets that env var
  when it execs `worker-inline` in the sandbox — the code comment in `run-cycle.sh` describes
  the intended behavior; it was just never wired through. Checked the repo's only two PRs
  (#3, #4) and both were authored directly by the maintainer, not a worker — no evidence any
  automated worker run has ever produced a PR since Daytona sandboxing shipped. This also
  incidentally surfaced a second, already-fixed bug in passing: the `144c6898` run's own
  failure-comment post broke on the shell-interpolation issue `d2822b1`/0.25.0 fixed hours
  earlier — a reminder that a fix landing on `main` doesn't retroactively repair runs that
  already failed against an older commit.
- **Lesson:** a board item stuck `In Progress` with a dead sandbox is a symptom, not the
  bug — read the actual Actions run logs (not just issue comments) before assuming a normal
  retry will succeed next time. If the *same* failure mode recurs across multiple unrelated
  claim attempts on different items, suspect the dispatch mechanism itself, not the item.
  Also: cross-referencing "how many PRs exist and who authored them" is a cheap, high-signal
  sanity check for "is the core pipeline working at all" that's easy to skip when triaging
  item-by-item.
- **Applies to:** triage | review | build

## 2026-08-01 — #6 CI red on e901e4b: filed P0 without a confirming judgment call, per the rule's own limits [distilled]
- **Outcome:** escalated (filed #6, `summon-human`, Blocked, P0)
- **What worked / what didn't:** Cycle 4's Sync found `main` red on `e901e4b` — the `test`
  job failing `tests/app-manifest-live.test.mjs` with "the command served its manifest page
  (timed out)". Checked the transient-flake exception's four conditions before doing
  anything else: it requires the sole red job to call a *live external/third-party service*.
  This test spawns the CLI locally and fetches its own `127.0.0.1` server — no third party
  in the failing path — so condition 1 fails outright. Per the rule ("if any condition
  fails... file the P0 immediately, exactly as before, with no further judgement"), filed
  without trying to reason my way to a skip. Still ran `gh run rerun --failed` for the P0's
  own evidence (not to decide whether to file) — it failed again with the identical
  assertion, so this also would not have qualified even under a looser reading. Cross-checked
  git history on this exact test: it failed on a real logic bug two commits ago, was fixed
  and passed clean one commit ago, then failed differently (timeout, not an assertion) on the
  current head — whose diff doesn't touch the manifest-server code path at all. That
  combination was worth surfacing to the maintainer rather than guessing at a root cause.
- **Lesson:** the flake exception's "live third-party endpoint" wording is narrow on purpose
  and doesn't stretch to cover *any* network-shaped or timeout-shaped local failure — a test
  that spawns a child process and hits its own loopback server is not exempt just because the
  symptom is also "timeout". When the exception's own text names a specific mechanism (third
  party), check for that mechanism literally instead of pattern-matching on the failure
  *shape* alone.
- **Applies to:** triage | prompt

## 2026-08-01 — #5 escalation (CI-red flake-exception policy) resolved directly by the maintainer [distilled]
- **Outcome:** merged (maintainer implemented `0.21.0` directly, closed #5)
- **What worked / what didn't:** Cycle 3 escalated #5 (a `templates/**` hard-gate edit) with
  three options and a recommendation instead of touching the hard-gated file itself. The
  maintainer adopted the recommended option verbatim in `0.21.0` and closed the issue same
  day. The item sat as `Blocked` on the board after closing — GitHub issue state and board
  state don't sync automatically — so this cycle moved it to `Done` by hand.
- **Lesson:** a closed issue does not imply its board item moved; check board status against
  live issue state for anything sitting in a non-terminal column and reconcile explicitly.
  Also: escalate-with-options-and-a-recommendation is working as intended for hard-gate
  edits — worth keeping as the default shape rather than second-guessing it.
- **Applies to:** triage

## 2026-08-01 — `main` CI red turned out to be a transient DeepSeek flake, not a regression [distilled]
- **Outcome:** n/a (a policy judgment call during Sync, not a dispatched item; filed #5 to
  propose hardening the rule)
- **What worked / what didn't:** Cycle 3's Sync step found `main` CI red on head `a2c7e14`
  (only the `onboarding-agent` job, `fetch failed` calling the live DeepSeek endpoint).
  LOOP-PROMPT.md says red CI becomes a P0 Inbox item immediately — a literal read means
  file it now. Instead: checked the last 14 CI runs on `main` (all green), checked that
  `a2c7e14`'s diff (CI/workflow/docs only) doesn't plausibly touch the onboarding agent's
  fetch path, then ran `gh run rerun --failed` on the same commit with no code change — it
  came back green. That combination (single external-API-dependent job, network-shaped
  error, unrelated diff, clean rerun) is strong evidence of a live-endpoint blip, not a
  regression. Filing a P0 at that point would have paged the maintainer about an issue that
  had already resolved itself.
- **Lesson:** `tests/init-agent.e2e.mjs` (tier 1, `docs/e2e-harness.md`) deliberately calls
  a **real** external endpoint on every push, so it will occasionally flake for reasons that
  have nothing to do with the commit under test. A rule with no room for that judgment call
  will eventually cry wolf on every DeepSeek hiccup. Per LOOP-PROMPT.md's own instruction
  ("if you disagree, propose an edit — don't silently deviate"), did not just skip the P0
  filing silently: opened issue #5 proposing a narrowed rule (one confirming rerun before
  P0, only when the sole red job is external-API-shaped and the diff doesn't explain it),
  hard-gated to `summon-human` since it touches `templates/**`. The actual red-CI event this
  cycle was still handled by hand immediately (investigated within the same cycle, confirmed
  green) — the escalation is about hardening the *policy*, not about leaving this instance
  unresolved.
- **Applies to:** triage | prompt

## 2026-08-01 — #2 plan comment was missing the mandatory machine-readable marker [distilled]
- **Outcome:** n/a (caught during cycle 2's review-outcomes read, not a dispatched item;
  issue #2 is still Ready, not yet Done)
- **What worked / what didn't:** Cycle 1 posted a "Plan ready" comment on #2 with scope,
  acceptance criteria, and gates, then a *separate* follow-up comment stating "Plan hash:
  `1cb719a4564a`" in prose. Neither comment contained the literal
  `<!-- nanobots:plan issue=2 hash=1cb719a4564a -->` marker LOOP-PROMPT.md requires.
  `daytona-worker.mjs`'s `checkApproval()` finds the plan by regex
  (`/<!--\s*nanobots:plan\s+issue=\d+\s+hash=([0-9a-f]{12})\s*-->/`) against comment bodies
  — with no comment matching, the item would read as "no versioned plan posted yet"
  forever, so `/nanobots start 1cb719a4564a` from a collaborator could never have claimed
  it, no matter how correct the hash was. The sha256 itself was computed correctly (verified
  by re-hashing the exact plan text) — only the marker line was missing. Fixed by editing
  the original "Plan ready" comment via `gh api ... -X PATCH` to append the marker as its
  final line, keeping the same hash since the text above it was unchanged.
- **Lesson:** "Post a comment with X" and "the comment ends with the exact marker" are two
  separate acceptance criteria — satisfying the first (useful prose, correct hash mentioned
  somewhere) does not imply the second. When posting or reviewing a plan comment, grep the
  actual comment body for the literal marker regex before trusting that a plan exists;
  don't infer it from the hash appearing in nearby text.
- **Applies to:** triage | prompt

## 2026-08-01 — TRIAGE.md hard-gate list drifted from config.json [distilled]
- **Outcome:** n/a (caught during cycle 1's policy read, not a dispatched item)
- **What worked / what didn't:** `.nanobots/config.json` `hardGates` listed four real
  areas (`src/**`, `templates/**`, `package.json`, `.github/**`), but
  `.nanobots/TRIAGE.md`'s hard-rules bullet still read "(none configured)". Had a future
  item touched one of those paths, triage would have read the prose, seen "none
  configured", and skipped the `summon-human` gate a config-driven check would have
  caught. Also found `TRIAGE.md`'s WIP cap hardcoded at 2 while `config.json.wipCap` is 1
  — the worker (`daytona-worker.mjs`) reads `config.json` directly so behavior was never
  wrong, only the doc.
- **Lesson:** Prose copies of config values in repo-owned docs (`TRIAGE.md`) drift
  silently because nothing re-renders them. When reading policy at the top of a cycle,
  cross-check any number/list restated in prose against the `config.json` field it claims
  to mirror, not just against instinct. Fixed by pointing TRIAGE.md at config.json instead
  of restating values.
- **Applies to:** triage | prompt

## 2026-08-01 — (seed) Loop bootstrapped [distilled]
- **Outcome:** n/a
- **Lesson:** This repo's history and docs already encode hard-won knowledge — before
  building in an area, search closed PRs and existing docs instead of rediscovering.
- **Applies to:** build
