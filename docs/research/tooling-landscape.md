# Always-Running Self-Improving Agent Loop on GitHub — Tooling Landscape (July 2026)

Research basis: 12 web searches + 2 primary-source doc fetches (Anthropic docs, GitHub docs). Decisive verdicts on what's real/maintained vs. hype.

## TL;DR recommendation
**Adopt the primitives; build only the thin control-plane glue.** Strongest 2026 stack for a solo-dev product repo already on Claude Code:
- **Inner loop:** `anthropics/claude-code-action@v1` (issue-assign → PR) — reuses your CLAUDE.md conventions.
- **Outer loop scheduling:** Actions `schedule:` cron + **GitHub Agentic Workflows (`gh-aw`)** for NL triage/roadmap agents (public preview since June 2026, security-hardened).
- **Kanban control plane:** Projects v2 via **GraphQL + a classic PAT (or GitHub App token)** — NOT `GITHUB_TOKEN` (confirmed: cannot touch org Projects v2).
- **Feedback→issues:** native Sentry alert-rule and PostHog error-tracking GitHub integrations (both create issues directly; no glue).
- **Memory/learning:** in-repo `CLAUDE.md` + `lessons.md`/`SHARED_TASK_NOTES.md` convention (Ralph/continuous-claude pattern); optionally **Pi + pi-autoresearch** edit→measure→keep/revert loop for metric-driven self-improvement.

---

## 1. Anthropic claude-code-action / Claude Code GitHub App
**Status: real, GA, best fit.** `anthropics/claude-code-action@v1` — launched Sept 29 2025 w/ Claude Code 2.0, built on the **Claude Agent SDK**. Runs full Claude Code runtime in an Actions runner.
- **Modes auto-detected** (v1 removed explicit `mode:`): **interactive** (`@claude` mentions → posts a *tracking comment* with progress checkboxes = "track mode") vs **automation** (explicit `prompt:` runs immediately on any event, no tracking comment).
- **Creates PRs / implements features / fixes bugs**, respects `CLAUDE.md`. App needs Contents/Issues/PRs read&write.
- **Scheduled runs:** yes — `on: schedule: cron` (docs ship a Daily Report cron example). cron + `prompt:` = headless roadmap/triage agent.
- **Skills/plugins:** `prompt:` accepts skill invocations (`/code-review:code-review …`) + can install plugin marketplaces — your `.claude/skills` and code-review plugin run in CI.
- **Auth:** Anthropic API key, or Bedrock/Vertex via OIDC. Setup: `/install-github-app`.
- **No native Projects v2 integration** — wire the kanban yourself (§2).
- **Claude Code Routines** (research preview, **Apr 14 2026**): cloud-hosted saved configs (prompt+repos+connectors) run **on cron, API call, or GitHub webhook** with no laptop awake ("wake up to PRs ready to merge"). Anthropic's hosted Ralph loop — watch it, but Actions path is more controllable today.
- **Claude Agent SDK** (renamed from Claude Code SDK Sept 2025): `query()` runs full agent loop headlessly — JSON output, `--resume`, `--allowedTools`, programmatic subagents via `agents` option, cost/permission limits. Escape hatch for a custom orchestrator.

**Adopt:** claude-code-action@v1 for inner loop + cron automation-mode workflow for outer loop. **Watch:** Routines.

## 2. GitHub Projects v2 automation (kanban control plane)
**Biggest gotcha, verified from GitHub docs:** **`GITHUB_TOKEN` is repo-scoped and CANNOT access Projects v2** (org or user). Use one of:
- **Classic PAT** with `project`+`repo` scopes — most reliable (community consensus).
- **GitHub App installation token** with **read&write to *organization* projects** (repo-project permission is explicitly *insufficient* for org projects) — recommended for org projects.
- **Fine-grained PATs** are flaky for Projects/GraphQL — avoid.

**Mechanics:**
- Add items/set status: GraphQL `addProjectV2ItemById` + `updateProjectV2ItemFieldValue` with `singleSelectOptionId`. First query the project to extract field ID + each option ID (jq), then mutate. All via `gh api graphql` in a workflow.
- **`actions/add-to-project`** (official, maintained): auto-adds issues/PRs on open/label; cross-org via `project-url`. No Projects-classic support.
- **Built-in Projects workflows** (auto-add, item-closed→Done) cover trivial transitions with no token — use these, reserve GraphQL for agent-driven status moves.
- `gh project` subcommands exist; `yahsan2/gh-pm` extension adds PM ergonomics.

**Adopt:** classic PAT/App token secret + a reusable "move card to <status>" GraphQL step; built-in workflows for auto-add and closed→Done.

## 3. Autonomous issue-to-PR tools (2026 viability)
- **GitHub Copilot coding agent** — GA, all paid Copilot plans. Assign issue → PR via web/mobile/**`gh` CLI/REST**. Model picker, self-review, built-in code+secret+dep scanning. GitHub-hosted (no self-host), zero-glue if you pay for Copilot.
- **Claude (as 3P coding agent)** — GA, assignable alongside Copilot, your API key. Best fit given your Claude Code investment.
- **OpenAI Codex** — GA (cloud+CLI+IDE), your API key. Reads issue→sandbox→tests→PR; native GitHub code-review. Strong alternative.
- **OpenHands** (ex-OpenDevin, All-Hands-AI) — v1.7 (May 2026), ~74k★, best-adopted OSS agent. **Fully self-hostable, any LLM.** `openhands-resolver` (PyPI) does issue→PR; ~53%+ SWE-bench Verified w/ Claude 4.5. GitHub/GitLab Actions CI runner in active dev (#8603). **The OSS pick.**
- **Cursor background agents** — GA, GitHub-first, Cursor-hosted sandboxes; good but IDE-centric.
- **Devin** — GA, Cognition-hosted VM; full-delegation, priciest/least controllable for solo dev.
- **SWE-agent** — OSS/research harness; prefer OpenHands for production.
- **sweep.dev / aider bots** — faded/legacy in 2026; aider survives as a CLI, not a hosted bot.

**Adopt:** claude-code-action primary + **OpenHands resolver** as self-hosted fallback/parallel worker. Copilot coding agent if already paying for Copilot.

## 4. Continuous roadmap / triage tooling
- **GitHub Agentic Workflows (`github/gh-aw`)** — standout 2026 primitive. Public preview **Jun 11 2026** (tech preview Feb 13). Write automation as **NL Markdown in `.github/workflows/`**; `gh aw compile` → hardened `.lock.yml` (SHA-pinned deps, frontmatter validation, 3 scanners: actionlint/zizmor/poutine). **Read-only by default**; writes via pre-approved "safe outputs." Engine-agnostic (Copilot/Claude/Gemini/Codex). Purpose-built for triage/roadmap agents, lowest-risk. **Adopt for the outer loop.**
- **Dosu** (dosu.dev) — hosted AI triage: auto-label, dedupe, research-preview replies, full auto-responses; learns from repo history. **Deprecating its hosted stale bot Aug 1 2026** in favor of `better-stale-bot`, **itself built on gh-aw** — signal that gh-aw is where GitHub-native triage is consolidating.
- Smaller OSS: `mattleibow/triage-assistant`, `DeMoorJasper/triage-bot`, marketplace "Triage issues"/"Issue AI Agent" actions — fine for narrow labeling; gh-aw supersedes most.

**Adopt:** gh-aw triage workflow (label+dedupe+prioritize into Projects board). Dosu if you want hosted zero-maintenance.

## 5. Feedback ingestion → GitHub issues
- **Sentry → GitHub:** native. Add a **"create GitHub issue" action to Sentry alert rules** → auto-creates issue on conditions; two-way sync of status/assignee/comments to dedupe. No glue.
- **PostHog error tracking → GitHub:** native (you run PostHog). Create GitHub issue from an exception's "External references" w/ partial stack trace + backlink. More manual-per-issue than Sentry's rule automation, but built-in.
- Feature-request/canny-style: no strong 2026 finding; simplest = `gh issue create` webhook or a gh-aw workflow turning inbound feedback into labeled issues.

**Adopt:** Sentry alert-rule→issue for crashes; PostHog external-reference for product errors; both feed one triage lane.

## 6. Scheduled/cron agents & loop reference architectures
- **Ralph / "Ralph Wiggum" loop** (Geoffrey Huntley): `while true` feeding an agent a prompt file until done. Now an **official Anthropic plugin** (`anthropics/claude-code/plugins/ralph-wiggum`) and absorbed into native **`/loop`** (cron, session-scoped, auto-expires after 3 days).
- **`AnandChowdhary/continuous-claude`** — "Ralph loop with PRs": runs Claude Code (or Codex) continuously, **creates PRs → waits for checks → merges**, persists context via `SHARED_TASK_NOTES.md`. Flags: `--worktree`, `--max-calls-per-hour`, `--completion-signal`, duration/cost limits, reviewer passes. **Directly usable inner-loop reference architecture.** Variants: `snarktank/ralph` (PRD loop), `vercel-labs/ralph-loop-agent` (AI SDK), `frankbria/ralph-claude-code` (exit detection).
- **Actions loop patterns:** `schedule: cron` heartbeat; **`concurrency` groups** to prevent overlap; **`workflow_dispatch` self-chaining** to work around the **6-hour per-job limit**; matrix fan-out for parallel items. gh-aw wraps these safely.
- Claude Code Routines (§1) = hosted evolution of cron-Ralph.

**Adopt:** cron outer loop (gh-aw or plain Actions) picking the top Projects card and dispatching a continuous-claude-style inner loop (worktree + shared notes + throttle + completion signal). `concurrency` = single-flight.

## 7. Memory / learning for repo agents
- **In-repo memory convention** is the proven pattern: `CLAUDE.md` (auto-loaded standards), `.github/copilot-instructions.md` (Copilot equivalent), and an agent-appended **`lessons.md`/`SHARED_TASK_NOTES.md`** carrying context across runs without blowing context (continuous-claude does exactly this). Your `~/.claude` MEMORY.md + graphify graph is already a sophisticated version.
- **Pi + pi-autoresearch** — the "introspection" ecosystem asked about:
  - **Pi** = opinionated, minimal **terminal coding agent** by **Mario Zechner** (mariozechner.at, pi.dev) — `pi-tui`→`pi-ai`, used in ~7 production projects. Open-source, in `bradAGI/awesome-cli-coding-agents`.
  - **`pi-autoresearch`** (by `davebcn87`, Mar 2026, ~2.1k★) — a Pi extension/skill implementing an **autonomous edit→measure→keep-if-better/revert-if-worse loop** (inspired by Karpathy's autoresearch) for any target: LLM training, **test speed, bundle size, Lighthouse scores.** This is the "self-improving" primitive — a metric-gated Ralph loop; **likely the "Pi framework" the latent.space introspection discussion pointed at.** (Separately, latent.space's Marc Andreessen ep discusses "Pi + OpenClaw" and self-modifying agents conceptually — same buzzword, different context.)

**Adopt:** keep learnings in-repo (`CLAUDE.md` + agent-appended `lessons.md`); for genuinely self-improving *metric* loops (perf/bundle/coverage) replicate the pi-autoresearch keep/revert harness (you don't need Pi itself).

---

## Build vs. Adopt summary
| Layer | Adopt | Build (thin glue) |
|---|---|---|
| Inner loop (issue→PR) | claude-code-action@v1; OpenHands OSS fallback | CLAUDE.md conventions + completion-signal |
| Outer loop (triage/roadmap) | **gh-aw** NL workflows + cron | triage rubric prompt; prioritization logic |
| Kanban control plane | Projects v2 GraphQL + built-in workflows | "move card" GraphQL step; **classic PAT/App token secret (NOT GITHUB_TOKEN)** |
| Feedback ingestion | Sentry alert-rule→issue; PostHog external refs | optional gh-aw normalizer |
| Scheduling/perpetual loop | Actions cron + concurrency + workflow_dispatch chaining; watch Routines | single-flight guard; 6h re-dispatch |
| Memory/self-improvement | in-repo CLAUDE.md/lessons.md; pi-autoresearch pattern | agent-appended learnings; keep/revert harness |

## Key gotchas (decisive)
1. **`GITHUB_TOKEN` cannot access org Projects v2** — use classic PAT (`project`+`repo`) or App token w/ **org** project read&write. (Verified in GitHub docs.)
2. **Fine-grained PATs unreliable for Projects v2/GraphQL** — prefer classic PAT or App token.
3. **claude-code-action v1 breaking changes** vs beta: no `mode:`, `direct_prompt`→`prompt`, CLI opts moved into `claude_args`.
4. **6-hour Actions job limit** — long loops must checkpoint + re-dispatch, not one giant job.
5. **gh-aw is read-only by default** — declare "safe outputs" for it to write. Feature, not bug.

## Citations
- claude-code-action: https://github.com/anthropics/claude-code-action · https://code.claude.com/docs/en/github-actions
- Claude Code Routines: https://apito.ai/en/blog/dev-guides/claude-code-routines-cloud-automation-2026/
- Claude Agent SDK: https://code.claude.com/docs/en/agent-sdk/agent-loop · https://platform.claude.com/docs/en/agent-sdk/subagents
- Projects v2 API/tokens: https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/automating-projects-using-actions · https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects · https://github.com/orgs/community/discussions/70487 · https://github.com/actions/add-to-project
- Copilot coding agent: https://github.blog/ai-and-ml/github-copilot/assigning-and-completing-issues-with-coding-agent-in-github-copilot/ · https://docs.github.com/copilot/concepts/agents/coding-agent/about-coding-agent · https://docs.github.com/en/copilot/concepts/agents/about-third-party-coding-agents
- Codex/Cursor/Devin: https://developers.openai.com/codex/integrations/github · https://github.com/openai/codex · https://techsy.io/en/blog/background-coding-agents-compared
- OpenHands: https://github.com/OpenHands/openhands · https://pypi.org/project/openhands-resolver/ · https://github.com/OpenHands/OpenHands/issues/8603
- gh-aw: https://github.com/github/gh-aw · https://github.github.com/gh-aw/ · https://github.blog/changelog/2026-06-11-github-agentic-workflows-is-now-in-public-preview/
- Dosu: https://dosu.dev/blog/automating-github-issue-triage · https://dosu.dev/blog/an-ai-stale-bot-that-you-can-trust
- Sentry/PostHog → issues: https://sentry.io/integrations/github/ · https://sentry.io/changelog/2023-11-6-automatically-create-issues-for-jira-server-and-github/ · https://posthog.com/docs/error-tracking/external-tracking
- Ralph/continuous loops: https://github.com/anthropics/claude-code/blob/main/plugins/ralph-wiggum/README.md · https://github.com/AnandChowdhary/continuous-claude · https://paddo.dev/blog/claude-code-loop-ralph-wiggum-evolution/
- Pi / pi-autoresearch: https://mariozechner.at/posts/2025-11-30-pi-coding-agent/ · https://github.com/davebcn87/pi-autoresearch · https://www.latent.space/p/pmarca · https://github.com/bradAGI/awesome-cli-coding-agents
