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

## 2026-08-01 — (seed) Loop bootstrapped
- **Outcome:** n/a
- **Lesson:** This repo's history and docs already encode hard-won knowledge — before
  building in an area, search closed PRs and existing docs instead of rediscovering.
- **Applies to:** build
