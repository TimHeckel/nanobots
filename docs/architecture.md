# Architecture

Two nested loops with GitHub as the shared state store and audit trail, and humans as a
deliberate signal source — not a bottleneck. Inspired by
[Autoresearch/Introspection](https://www.latent.space/p/autoresearch-introspection).

## Principles

1. **The outer loop is the control mechanism.** It never writes product code. It reads
   signals, shapes work, dispatches, evaluates results, and updates its own policy docs.
2. **Constantly learning.** Every completed item produces a `LEARNINGS.md` entry; periodic
   distill passes promote lessons into `TRIAGE.md`, `RECIPES.md` (the "agent recipes" of
   the article), and the repo's agent instructions file. The loop's policy documents are
   its weights; GitHub history is the training log.
3. **Humans as signal, on purpose.** The maintainer is an input channel (issues,
   `summon-human` escalations, PR reviews) with explicit hard gates. Autonomy grows by
   moving areas out of the hard-gate set as trust accrues — never by skipping it.
4. **GitHub is the audit trail.** All state lives in GitHub surfaces; any session — local
   Claude, Actions run, a VM, a sandbox — can pick up the loop cold, because the loop has
   no private state.
5. **Cost control.** The outer loop is cheap (read/triage/comment); the expensive workers
   run only on dispatched, WIP-capped work.

## GitHub surface mapping

| Loop concept | GitHub surface |
|---|---|
| Signal intake | Issues via issue forms, auto-labeled `nanobots:inbox` |
| Kanban / state machine | Projects v2 board — Status: Inbox → Backlog → Ready → In Progress → In Review → Verify → Blocked → Done |
| Priority / size | Single-select fields `Priority` (P0-P3), `Size` (S/M/L/XL) |
| Work spec | Triage comment on the issue (acceptance criteria, tests, pointers) |
| Dispatch | Outer loop comments `@claude` + brief → inner workflow runs → PR. Or a local/VM worker claims the card directly (pull beats push) |
| Execution audit | Branch + PR per item, linked `Closes #N`, label `nanobots:built` |
| Human gates | `summon-human` label + assignment; PR review for L-sized items |
| Learning | `.nanobots/LEARNINGS.md` (append-only) → distilled into TRIAGE/RECIPES/instructions |
| Loop heartbeat | Pinned **Nanobots Status** issue — one short report per cycle |

## The scaffolder-not-framework decision

`init` renders everything into the target repo; afterwards the repo has **zero runtime
dependency on nanobots**. This is deliberate:

- The repo's rubric and recipes are *supposed* to drift from the templates — that drift IS
  the learning. A framework would fight it; a scaffold embraces it.
- Engine-owned files (prompts, runner, workflows, forms) carry a `nanobots:engine-owned`
  marker and are re-rendered by `nanobots update`. Repo-owned files (TRIAGE, RECIPES,
  LEARNINGS, config.json) are rendered once and never touched again.

## Design decisions that came from research (July 2026)

See [research/](research/) for the full reports.

- **claude-code-action@v1 for both loops** — cron + `prompt:` is Anthropic's documented
  headless-agent shape; `@claude` mentions are the dispatch path.
- **Classic PAT, never `GITHUB_TOKEN`, never fine-grained** — the default token cannot
  access org Projects v2 at all; fine-grained PATs are flaky on the Projects GraphQL API.
- **Human-actor dispatch** — claude-code-action refuses bot-initiated runs, so dispatch
  comments must post via a human's PAT.
- **Poll, don't webhook** — `projects_v2_item` events only reach GitHub Apps/org webhooks,
  not repo workflows. At the scale this targets, polling on the loop cadence is simpler
  and sufficient.
- **Deliberately skipped**: a GitHub App (real-time webhooks + bot identity — the latter
  actively breaks dispatch), extra worker engines in-box (the PR seam is the adapter),
  hosted triage services (the rubric does triage with full repo context).
- **Watch list**: GitHub Agentic Workflows (`gh-aw`) as a possible outer-workflow
  replacement; Claude Code Routines as a laptop-free hosted runtime; the pi-autoresearch
  keep/revert pattern for metric-gated work (perf, bundle size, coverage).
