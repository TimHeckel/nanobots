# E2E harness

Three tiers, cheapest first. Tiers 0–1 run in CI (`.github/workflows/ci.yml`); tiers 2–3 are
the dogfood install and are driven by hand.

| Tier | Proves | Credentials | Where |
|---|---|---|---|
| 0 | render/config logic, packaging | none | CI, every push |
| 1 | the onboarding agent's live tool-calling loop | `OCR_LLM_*` | CI, every push (self-skips without the secret) |
| 2 | GitHub scaffolding against a real repo | `PROJECTS_PAT`, `gh` w/ `project` scope | manual |
| 3 | claim → sandbox → PR → OCR → merge | + `DAYTONA_API_KEY`, model credential | manual |

## Tier 0 — free

`npm test` (129 assertions) plus a headless scaffold smoke test and a package-contents check.
Run locally with `npm test`.

## Tier 1 — the onboarding agent (the important one)

`init` is the only install path, and its agent loop can't be reached by unit tests — it needs
a live tool-calling model. `tests/init-agent.e2e.mjs` runs the **real** agent against a **real**
endpoint with `NANOBOTS_INIT_DRY_RUN=1`, which swaps every side-effecting tool for a recorder:
nothing is written, no `gh` runs, no secrets are set, no sandbox is created. It then asserts on
the transcript of tool calls — including ordering invariants like *Daytona is verified before
its key is stored*, and that no credential value ever reaches the transcript.

```bash
OCR_LLM_URL=https://api.deepseek.com/chat/completions \
OCR_LLM_TOKEN=sk-... \
OCR_LLM_MODEL=deepseek-v4-flash \
node tests/init-agent.e2e.mjs
```

It exits 0 with `skip` when those aren't set, so a credential-less CI stays green. In CI, set
`OCR_LLM_URL` / `OCR_LLM_MODEL` as **repo variables** and `OCR_LLM_TOKEN` as a **secret**.

Deliberately not part of `npm test` — it costs a model call.

## Tiers 2–3 — dogfooding nanobots on itself

We install the loop onto `TimHeckel/nanobots` itself. That is the truest test of the product
thesis, and it is also the highest-blast-radius option: **the workers would be editing the
package that generates workers.** A merged bad change here ships broken installs to every
consumer via npm. So the gates below are not optional.

### Required secrets/variables on this repo

```bash
gh secret set PROJECTS_PAT              # classic PAT, project + repo + read:org, human account
gh secret set DAYTONA_API_KEY
gh secret set CLAUDE_CODE_OAUTH_TOKEN   # or ANTHROPIC_API_KEY
gh secret set OCR_LLM_TOKEN
gh variable set OCR_LLM_URL   --body https://api.deepseek.com/chat/completions
gh variable set OCR_LLM_MODEL --body deepseek-v4-flash
gh auth refresh -s project              # the board needs it
```

Optional, and worth exercising since it's new — the per-run App credential path:

```bash
gh secret set NANOBOTS_GITHUB_APP_ID
gh secret set NANOBOTS_GITHUB_APP_INSTALLATION_ID
gh secret set NANOBOTS_GITHUB_APP_PRIVATE_KEY
```

### Non-negotiable gates for the self-install

After `init`, edit `.nanobots/config.json` so a worker can never touch the engine:

```jsonc
{
  "hardGates": [
    "the CLI itself (src/**)",              // changes every future install
    "the templates (templates/**)",          // changes what every repo renders
    "packaging and release (package.json)",  // version/publish surface
    "CI workflows (.github/workflows/**)",
    // …plus the usual payments/auth/migrations/secrets/infra entries
  ],
  "mergePolicy": { "autoMergeNonProduction": false, "protectedBranches": ["main"] },
  "wipCap": 1
}
```

Everything in `hardGates` gets `summon-human` and is never auto-dispatched, so the loop can
still *triage* engine issues — it just can't build or merge them unattended. Start with
`wipCap: 1` and `autoMergeNonProduction: false` so every PR waits for you.

Also turn on branch protection for `main` before enabling the worker cron. With the GitHub App
path, `contents: write` is repository-wide rather than ref-scoped — branch protection, not
token scope, is what actually contains a stray push.

### Running it

Leave the crons off at first and drive it by hand, so nothing runs while you're not watching:

```bash
npx nanobots-sh verify daytona     # prove the key before anything claims work
npx nanobots-sh run outer          # one triage cycle — read the Status issue after
npx nanobots-sh run worker         # one claim → sandbox → PR
```

Only after a few clean manual cycles:

```bash
gh variable set NANOBOTS_OUTER_ENABLED  --body 1
gh variable set NANOBOTS_WORKER_ENABLED --body 1
```

### Known frictions of self-installing

- **`.nanobots/` vs `templates/nanobots/`.** The installed loop and the templates that generate
  it now live in the same checkout. They don't collide (different paths), but remember that
  `nanobots update` re-renders `.nanobots/` from the *installed package*, not from your working
  copy of `templates/` — so a local template edit isn't live until you reinstall or re-render.
- **Board state is permanent-ish.** `init` creates a project, six labels, and a pinned issue on
  the public repo. Removing them later is manual.
- **Stray branches/PRs.** A failed run can leave `nanobots/<issue>-<slug>` branches behind;
  nanobots has no ref-cleanup subsystem, so that cleanup is yours.

### The OCR chain (bugs 8–13)

OCR is documented as a **required** review that blocks merges. It had never successfully run
once. Six failures sat behind each other, each only visible after the previous was fixed:

| # | Symptom | Root cause |
|---|---|---|
| 8 | install 404 | asset is `opencodereview-linux-amd64`, workflow asked for `ocr-linux-amd64` |
| 9 | report step 404 | used a GraphQL node ID (`IC_kwD…`) against a REST endpoint needing a numeric id |
| 10 | binary died in 50ms | workflow read `OCR_LLM_URL`/`MODEL` from **secrets**; `init` sets them as **variables** → empty |
| 11 | every finding dropped | OCR emits `comments[]`/`path`; parser read `findings[]`/`file` |
| 12 | docs-only PR blocked forever | OCR exits 0 with no output when nothing is reviewable; treated as "review failed" |
| 13 | fixes appeared to do nothing | reviewer checked out `base_sha`, so it ran the engine code from the PR's merge-base |

**#13 is the one to remember.** It made #9–#12 look unfixable: each fix landed on the default
branch while CI kept running the pre-fix copy from the merge-base. The reviewer now checks out
the base *branch tip* — equally trusted, always current.

**#12 is the mirror image of the rest.** Every other bug was something that did not work; that
one was a gate so conservative it could never pass. Both directions matter: the fix keeps
"nonzero exit" and "unknown exit" blocking, so a review that *might* not have happened still
never reads as clean.

### Guard rails added

- `verify daytona` runs a real command in the sandbox, not just create/delete.
- `tests/plan-protocol.test.mjs` asserts the prompt's documented plan marker satisfies the
  worker's parser, and that the loop's own approval prose does **not** count as approval.
- `tests/ocr-parse.test.mjs` pins OCR's real JSON shape and keeps empty/malformed output loud.
- CI fails if `.nanobots/` has drifted from `templates/` — the installed copy is what actually
  runs, and forgetting `nanobots update` silently reverts fixes.
