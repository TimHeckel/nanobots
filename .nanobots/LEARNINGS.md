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

## 2026-08-01 — #2 plan comment was missing the mandatory machine-readable marker
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

## 2026-08-01 — TRIAGE.md hard-gate list drifted from config.json
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
