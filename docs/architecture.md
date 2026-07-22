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
6. **Workers execute in isolation, always.** A worker touches product code — arbitrary
   build/test commands, a fresh branch, a push. That never happens on a laptop or a shared
   CI runner; it always happens inside a disposable [Daytona](https://daytona.io) sandbox
   that's created for one work item and deleted the moment it's done. This is the one
   non-optional runtime choice nanobots makes — see `.nanobots/RUNTIMES.md` "Security
   model" for exactly what does and doesn't enter the box, and why.
7. **Every PR gets reviewed, always.** OCR runs on every `nanobots:built` PR, not just the
   ones a repo opted into. Isolated execution without an independent review of what came
   out of it is only half the safety story — this is the other, non-optional half.
8. **The one opt-in write path is bounded, atomic, and re-verified at every step.** The
   surgical autofix responder (`OCR_AUTOFIX_ENABLED`) is optional because it's the second
   place — besides the worker — that writes code. Everything about it is narrower than the
   worker: only exact, mechanically-validated text replacements (never free-form patches or
   shell commands), only for findings OCR already flagged, only inside its own disposable
   Daytona sandbox, capped at 3 rounds per PR, and re-checked against the live PR head
   before every push and before every thread resolution.

## GitHub surface mapping

| Loop concept | GitHub surface |
|---|---|
| Signal intake | Issues via issue forms, auto-labeled `nanobots:inbox` |
| Kanban / state machine | Projects v2 board — Status: Inbox → Backlog → Ready → In Progress → In Review → Verify → Blocked → Done |
| Priority / size | Single-select fields `Priority` (P0-P3), `Size` (S/M/L/XL) |
| Work spec | Triage comment on the issue (acceptance criteria, tests, pointers) |
| Plan approval | Versioned `Plan ready` comment + plan-hash marker; a collaborator's `/nanobots start <hash>` gates dispatch (config: `approval.requireVersionedStart`) |
| Dispatch | Pull, not push: `.nanobots/daytona-worker.mjs` claims the top approved Ready item itself, from a scheduled cron or a manual run |
| Execution | A disposable Daytona sandbox per item — see `.nanobots/RUNTIMES.md` |
| Execution audit | Branch + PR per item, linked `Closes #N`, label `nanobots:built` |
| Review gate | Every `nanobots:built` PR gets a bounded [Open Code Review](https://github.com/alibaba/open-code-review) pass — inline review comments + approve/request-changes, fingerprinted machine-readable report — run as a normal Actions job on the exact PR head — required, no opt-out |
| Autofix (optional) | `nanobots:ocr-responder-state` sticky comment tracks round count/status per PR; eligible findings get exact replacements from a disposable Daytona remediation sandbox, one repair commit per round, threads resolved with evidence |
| Human gates | `summon-human` label + assignment; PR review for L-sized items, protected branches, hard-gate areas, and anything autofix marks `needs_human` |
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
- **Daytona is required for workers, not one runtime among several.** Worker execution is
  the one place nanobots runs arbitrary, agent-written code — build commands, tests,
  whatever the recipe calls for. That's worth isolating unconditionally rather than
  leaving it as a laptop/VM/Actions choice. The outer loop stays runtime-agnostic because
  it never does that.
- **OCR runs as a plain Actions job, not inside the sandbox.** It only reads a diff and
  calls an LLM — no code execution — so the isolation an ephemeral Actions runner already
  gives you is sufficient. This also means no separately hosted inference relay: a
  scaffolder with no control plane has nowhere to run one, and per-job Actions secrets
  give the same "credential dies with the job" property for free.
- **The sandbox pushes and opens the PR itself**, using the same GitHub PAT the outer loop
  already carries, injected for one run and destroyed with the sandbox. A fully mediated
  design — a typed controller that performs every git/GitHub mutation so the model never
  touches a token — is stronger, but requires infrastructure (a GitHub App, a token-minting
  service) disproportionate to a template-rendering CLI. See `.nanobots/RUNTIMES.md`
  "Security model" for the honest tradeoff and the escape hatch for teams that need more.
- **Watch list**: GitHub Agentic Workflows (`gh-aw`) as a possible outer-workflow
  replacement; Claude Code Routines as a laptop-free hosted runtime; the pi-autoresearch
  keep/revert pattern for metric-gated work (perf, bundle size, coverage).
- **The autofix responder's push credential is the workflow's own `github.token`, not a
  PAT.** Unlike the worker (which needs the board-wide `PROJECTS_PAT` since it operates
  across the whole repo's Projects v2 state), autofix only ever needs to push to one
  same-repo PR branch — a scope GitHub's own ephemeral, job-scoped token already covers,
  and which GitHub itself refuses to grant against fork PRs. That's a stronger boundary
  than application logic re-deriving "same repo only" itself, and it comes for free.
- **Autofix's review/report/controller scripts are checked out from the PR's base commit,
  never its head.** A PR that could rewrite the code judging it would defeat the whole
  review; the workflow resolves PR metadata via `gh pr view` before checkout so nothing
  trusted ever runs from PR-controlled source, with `persist-credentials: false` on that
  checkout since nothing there needs to push.
- **Exact-replacement patches, not agent-driven file edits.** The autofix worker is
  deliberately not "run another coding agent in a loop" — it's a single bounded call per
  file that returns structured dispositions and literal `oldText`/`newText` pairs, checked
  mechanically (unique in the real file, inside a shown excerpt, no overlaps) before
  anything is written. Cheaper, auditable, and it can't invent scope the finding didn't ask
  for.
