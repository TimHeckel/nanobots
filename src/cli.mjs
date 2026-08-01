#!/usr/bin/env node
// nanobots — self-improving agent loops for any GitHub repo.
// Zero-dependency scaffolder: after `init`, the target repo is self-contained.

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline/promises';

const PKG = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'));
const VERSION = PKG.version;
const TEMPLATES = join(dirname(fileURLToPath(import.meta.url)), '..', 'templates');

const c = {
  cyan: (s) => `\x1b[1;36m${s}\x1b[0m`,
  yellow: (s) => `\x1b[1;33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};
const say = (m) => console.log(`${c.cyan('[nanobots]')} ${m}`);
const warn = (m) => console.log(`${c.yellow('[nanobots]')} ${m}`);
const die = (m) => { console.error(`${c.yellow('[nanobots]')} ${m}`); process.exit(1); };

function sh(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts }).trim();
}
function shTry(cmd, opts = {}) {
  try { return sh(cmd, opts); } catch { return null; }
}

// ── detection ────────────────────────────────────────────────────────────────

function detect() {
  const root = shTry('git rev-parse --show-toplevel');
  if (!root) die('not inside a git repository');

  const remote = shTry('git remote get-url origin') || '';
  const m = remote.match(/github\.com[:/]([^/]+)\/([^/.]+)(\.git)?/);
  const owner = m?.[1] ?? null;
  const repo = m?.[2] ?? null;

  let defaultBranch = shTry('git symbolic-ref --short refs/remotes/origin/HEAD');
  defaultBranch = defaultBranch ? defaultBranch.replace(/^origin\//, '') : 'main';

  // Propose gate commands from package.json scripts (npm/pnpm/yarn detected by lockfile)
  const gates = [];
  const pkgPath = join(root, 'package.json');
  if (existsSync(pkgPath)) {
    const runner = existsSync(join(root, 'pnpm-lock.yaml')) ? 'pnpm'
      : existsSync(join(root, 'yarn.lock')) ? 'yarn'
      : 'npm run';
    const scripts = JSON.parse(readFileSync(pkgPath, 'utf8')).scripts ?? {};
    for (const name of ['lint', 'typecheck', 'test']) {
      if (scripts[name]) gates.push(`${runner} ${name}`);
    }
  }

  return { root, owner, repo, defaultBranch, gates };
}

// ── rendering ────────────────────────────────────────────────────────────────

function render(content, values) {
  return content.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in values)) die(`template references unknown placeholder {{${key}}}`);
    return values[key];
  });
}

function templateValues(cfg) {
  return {
    OWNER: cfg.owner,
    REPO: cfg.repo,
    BOARD: cfg.board,
    HUMAN_LABEL: cfg.humanLabel,
    WIP_CAP: String(cfg.wipCap),
    DEFAULT_BRANCH: cfg.defaultBranch,
    GATES_LIST: cfg.gates.map((g) => `   - \`${g}\``).join('\n') || '   - (no gates configured — add some to .nanobots/config.json)',
    HARD_GATES_LIST: cfg.hardGates.map((g) => `  - ${g}`).join('\n') || '  - (none configured)',
    INSTALL_DATE: new Date().toISOString().slice(0, 10),
    DAYTONA_SNAPSHOT: cfg.daytona?.snapshot || 'provider default',
    DAYTONA_TARGET: cfg.daytona?.target || 'us',
    OCR_VERSION: cfg.ocr?.version || 'v1.7.12',
    OCR_BLOCKING_SEVERITIES: (cfg.ocr?.blockingSeverities || ['critical', 'high']).join(', '),
  };
}

// Engine-owned files: re-rendered by `update`. Repo-owned: rendered once, never touched again.
const ENGINE_OWNED = [
  { src: 'nanobots/LOOP-PROMPT.md', dest: '.nanobots/LOOP-PROMPT.md' },
  { src: 'nanobots/WORKER-PROMPT.md', dest: '.nanobots/WORKER-PROMPT.md' },
  { src: 'nanobots/RUNTIMES.md', dest: '.nanobots/RUNTIMES.md' },
  { src: 'nanobots/run-cycle.sh', dest: '.nanobots/run-cycle.sh', exec: true },
  { src: 'nanobots/daytona-client.mjs', dest: '.nanobots/daytona-client.mjs' },
  { src: 'nanobots/daytona-worker.mjs', dest: '.nanobots/daytona-worker.mjs' },
  { src: 'nanobots/github-app-auth.mjs', dest: '.nanobots/github-app-auth.mjs' },
  { src: 'nanobots/ocr-autofix-lib.mjs', dest: '.nanobots/ocr-autofix-lib.mjs' },
  { src: 'nanobots/open-code-review-report.mjs', dest: '.nanobots/open-code-review-report.mjs' },
  { src: 'nanobots/ocr-autofix-worker.mjs', dest: '.nanobots/ocr-autofix-worker.mjs' },
  { src: 'nanobots/ocr-autofix-controller.mjs', dest: '.nanobots/ocr-autofix-controller.mjs' },
  { src: 'github/workflows/nanobots-ocr.yml', dest: '.github/workflows/nanobots-ocr.yml' },
  { src: 'github/ISSUE_TEMPLATE/feature-request.yml', dest: '.github/ISSUE_TEMPLATE/feature-request.yml' },
  { src: 'github/ISSUE_TEMPLATE/bug-report.yml', dest: '.github/ISSUE_TEMPLATE/bug-report.yml' },
  { src: 'github/ISSUE_TEMPLATE/chore-tech-debt.yml', dest: '.github/ISSUE_TEMPLATE/chore-tech-debt.yml' },
];
// Rendered only when the matching config flag is on (still engine-owned once present).
// OCR's PR-triggered workflow is unconditional (see ENGINE_OWNED above) — it needs no
// cron, so there's no "local" alternative the way outer/worker have one.
const CONDITIONAL_ENGINE_OWNED = [
  { src: 'github/workflows/nanobots-outer.yml', dest: '.github/workflows/nanobots-outer.yml', when: (cfg) => cfg.actionsEnabled },
  { src: 'github/workflows/nanobots-worker.yml', dest: '.github/workflows/nanobots-worker.yml', when: (cfg) => cfg.actionsEnabled },
];
const REPO_OWNED = [
  { src: 'nanobots/TRIAGE.md', dest: '.nanobots/TRIAGE.md' },
  { src: 'nanobots/RECIPES.md', dest: '.nanobots/RECIPES.md' },
  { src: 'nanobots/LEARNINGS.md', dest: '.nanobots/LEARNINGS.md' },
  { src: 'nanobots/EXTENSION-PROMPT.md', dest: '.nanobots/EXTENSION-PROMPT.md' },
];

function writeRendered(root, entry, values, { overwrite }) {
  const destPath = join(root, entry.dest);
  if (!overwrite && existsSync(destPath)) {
    say(`${entry.dest} exists — left alone (repo-owned).`);
    return;
  }
  mkdirSync(dirname(destPath), { recursive: true });
  const content = render(readFileSync(join(TEMPLATES, entry.src), 'utf8'), values);
  writeFileSync(destPath, content);
  if (entry.exec) chmodSync(destPath, 0o755);
  say(`wrote ${entry.dest}`);
}

// ── github scaffolding ───────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  ['Inbox', 'GRAY', 'New, untriaged'],
  ['Backlog', 'GRAY', 'Triaged, below the line'],
  ['Ready', 'BLUE', 'Spec written, dispatchable'],
  ['In Progress', 'YELLOW', 'A worker is on it'],
  ['In Review', 'ORANGE', 'PR open, gates running'],
  ['Verify', 'PURPLE', 'Awaiting human / final verify'],
  ['Blocked', 'RED', 'Needs info or a decision'],
  ['Done', 'GREEN', 'Merged and verified'],
];

function scaffoldGitHub(cfg) {
  const { owner, repo, board } = cfg;
  const nwo = `${owner}/${repo}`;

  const scopes = shTry('gh auth status') ?? '';
  if (!scopes.includes('project')) {
    throw new Error("gh token missing the 'project' scope. Run: gh auth refresh -s project");
  }

  // Project
  let project = null;
  const list = shTry(`gh project list --owner ${owner} --format json --limit 100`);
  if (list) {
    project = JSON.parse(list).projects?.find((p) => p.title === board) ?? null;
  }
  if (!project) {
    say(`creating project "${board}" under ${owner}...`);
    project = JSON.parse(sh(`gh project create --owner ${owner} --title "${board}" --format json`));
  } else {
    say(`project "${board}" already exists.`);
  }
  const num = project.number;
  say(`project number=${num}`);

  shTry(`gh project link ${num} --owner ${owner} --repo ${nwo}`);

  // Status options (GraphQL; not all API versions support editing — degrade to manual)
  const fields = JSON.parse(sh(`gh project field-list ${num} --owner ${owner} --format json --limit 30`));
  const status = fields.fields.find((f) => f.name === 'Status');
  const have = (status?.options ?? []).map((o) => o.name).join(',');
  const want = STATUS_OPTIONS.map(([n]) => n).join(',');
  if (have !== want) {
    const opts = STATUS_OPTIONS.map(([n, col, d]) => `{name: "${n}", color: ${col}, description: "${d}"}`).join(' ');
    const mutation = `mutation($fieldId: ID!) { updateProjectV2Field(input: { fieldId: $fieldId, singleSelectOptions: [${opts}] }) { projectV2Field { ... on ProjectV2SingleSelectField { id } } } }`;
    const ok = shTry(`gh api graphql -f query='${mutation}' -f fieldId="${status.id}"`);
    if (ok) say('Status options set.');
    else warn(`could not set Status options via API — set them manually in the project settings to: ${want}`);
  } else {
    say('Status options already configured.');
  }

  // Custom fields
  for (const [name, options] of [['Priority', 'P0,P1,P2,P3'], ['Size', 'S,M,L,XL']]) {
    if (fields.fields.some((f) => f.name === name)) {
      say(`field '${name}' exists.`);
    } else {
      sh(`gh project field-create ${num} --owner ${owner} --name "${name}" --data-type SINGLE_SELECT --single-select-options "${options}"`);
      say(`field '${name}' created.`);
    }
  }

  // Labels
  const labels = [
    ['nanobots:inbox', 'bfd4f2', 'New signal awaiting outer-loop triage'],
    ['nanobots:built', '0e8a16', 'Implemented by a nanobot worker'],
    ['nanobots:ext', '5319e7', 'Filed via the browser extension (signal-quality tracked)'],
    [cfg.humanLabel, 'b60205', 'Hard gate: human decision required before work'],
    ['needs-info', 'fbca04', 'Too vague to spec; questions posted'],
    ['chore', 'c2e0c6', 'Refactor / cleanup / hardening'],
  ];
  for (const [name, color, desc] of labels) {
    const made = shTry(`gh label create "${name}" --repo ${nwo} --color "${color}" --description "${desc}"`);
    say(made !== null ? `label '${name}' created.` : `label '${name}' exists.`);
  }

  // Pinned status issue
  let statusIssue = shTry(`gh issue list --repo ${nwo} --search 'in:title "Nanobots Status"' --state open --json number --jq '.[0].number'`);
  if (!statusIssue) {
    const url = sh(`gh issue create --repo ${nwo} --title "🤖 Nanobots Status — cycle reports" --body "The outer loop posts one short report per cycle here (see .nanobots/LOOP-PROMPT.md). Humans: read the latest comment for current state; open a normal issue to feed the loop."`);
    statusIssue = url.split('/').pop();
    shTry(`gh issue pin ${statusIssue} --repo ${nwo}`);
  }
  say(`status issue: #${statusIssue}`);

  return { projectNumber: num, statusIssue };
}

// ── commands ─────────────────────────────────────────────────────────────────

function defaultAnswers(d) {
  return {
    board: 'Nanobots',
    humanLabel: 'summon-human',
    wipCap: 2,
    gates: d.gates,
    hardGates: [
      'payments / billing',
      'auth / sessions',
      'database schema / migrations',
      'secrets / credentials',
      'production infrastructure',
      'destructive data operations',
    ],
    actionsEnabled: true,
  };
}

function buildConfig(d, answers) {
  const a = { ...defaultAnswers(d), ...answers };
  return {
    version: VERSION,
    owner: d.owner,
    repo: d.repo,
    defaultBranch: d.defaultBranch,
    board: a.board,
    humanLabel: a.humanLabel,
    wipCap: a.wipCap,
    gates: a.gates,
    hardGates: a.hardGates,
    actionsEnabled: a.actionsEnabled,
    daytona: { snapshot: null, target: 'us', autoDeleteMinutes: 60, databaseBootstrap: [] },
    ocr: {
      version: 'v1.7.12',
      blockingSeverities: ['critical', 'high'],
      maxRounds: 3,
      // Narrows the autofix responder's protected-surface list beyond the built-in
      // defaults (.github/**, .nanobots/**, lockfiles, etc. — see RUNTIMES.md). Repo
      // policy can only narrow eligibility further, never widen past the built-ins.
      autofix: { protectedPaths: [] },
    },
    approval: { requireVersionedStart: true },
    // GitHub's native stacked PRs (public preview since 2026-07-30) via the `gh-stack`
    // extension. Default OFF: while the feature is in preview and subject to change, an
    // upstream behavior shift should not be able to strand the loop. See RUNTIMES.md.
    stacks: {
      enabled: false,
      // Not a restack-cost limit — that's GitHub's problem now. This caps review
      // comprehension and the blast radius when the bottom layer has to change.
      maxDepth: 3,
    },
    mergePolicy: { autoMergeNonProduction: false, protectedBranches: [d.defaultBranch] },
  };
}

function renderScaffold(d, cfg) {
  const values = templateValues(cfg);
  for (const entry of ENGINE_OWNED) writeRendered(d.root, entry, values, { overwrite: true });
  for (const entry of REPO_OWNED) writeRendered(d.root, entry, values, { overwrite: false });
  for (const entry of CONDITIONAL_ENGINE_OWNED) {
    if (entry.when(cfg)) writeRendered(d.root, entry, values, { overwrite: true });
  }
  const cfgPath = join(d.root, '.nanobots', 'config.json');
  if (!existsSync(cfgPath)) {
    writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
    say('wrote .nanobots/config.json');
  }
  return cfgPath;
}

// ── daytona proof (shared by `verify daytona` and the onboarding agent) ────────

async function daytonaProof(apiKey) {
  const base = process.env.DAYTONA_API_URL || 'https://app.daytona.io/api';
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

  const listRes = await fetch(`${base}/sandbox`, { headers });
  if (!listRes.ok) throw new Error(`connection failed: ${listRes.status} ${(await listRes.text().catch(() => '')).slice(0, 200)}`);

  const createRes = await fetch(`${base}/sandbox`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ labels: { purpose: 'nanobots-verify' }, autoStopInterval: 5, autoDeleteInterval: 10 }),
  });
  if (!createRes.ok) throw new Error(`sandbox create failed: ${createRes.status} ${(await createRes.text().catch(() => '')).slice(0, 200)}`);
  const sandbox = await createRes.json();

  const delRes = await fetch(`${base}/sandbox/${sandbox.id}`, { method: 'DELETE', headers });
  const cleaned = delRes.ok;
  return { sandboxId: sandbox.id, cleaned };
}

// ── the onboarding agent ───────────────────────────────────────────────────────
// nanobots has no interactive install path other than this. `init` boots an agent on
// the same OpenAI-compatible endpoint the repo already needs for OCR review, and that
// agent drives the whole setup — config, scaffold, GitHub state, secrets, verification —
// conversationally, through the tools below. (Hidden `--headless` scaffolds from defaults
// for CI/self-tests; it is deliberately absent from the help text.)

// Terminal line reader with optional masking for secret values (zero-dependency).
function promptLine(query, { secret = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (!secret) {
      rl.question(query, (v) => { rl.close(); resolve(v); });
      return;
    }
    const onData = () => process.stdout.write(`\x1b[2K\x1b[200D${query}${'*'.repeat(rl.line.length)}`);
    process.stdin.on('data', onData);
    rl.question(query, (v) => { process.stdin.removeListener('data', onData); rl.close(); process.stdout.write('\n'); resolve(v); });
  });
}

async function llmChat({ url, token, model, messages, tools }) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, tools, tool_choice: 'auto', temperature: 0.2 }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
  const data = await res.json();
  const msg = data.choices?.[0]?.message;
  if (!msg) throw new Error(`LLM returned no message: ${JSON.stringify(data).slice(0, 300)}`);
  return msg;
}

const ONBOARDING_TOOLS = [
  { type: 'function', function: { name: 'message_user', description: 'Say something to the user in the terminal. This is your ONLY channel for user-facing text — never put it in plain content.', parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } } },
  { type: 'function', function: { name: 'ask_user', description: 'Ask the user a question and return their typed answer. Set secret:true for tokens/keys (input is masked).', parameters: { type: 'object', properties: { question: { type: 'string' }, secret: { type: 'boolean' } }, required: ['question'] } } },
  { type: 'function', function: { name: 'render_scaffold', description: 'Write the .nanobots/ prompts, workflows, and config.json into the repo. Call once after gathering config.', parameters: { type: 'object', properties: { board: { type: 'string' }, humanLabel: { type: 'string' }, wipCap: { type: 'integer' }, gates: { type: 'array', items: { type: 'string' } }, hardGates: { type: 'array', items: { type: 'string' } }, actionsEnabled: { type: 'boolean' } }, required: ['board', 'humanLabel', 'wipCap', 'gates', 'hardGates', 'actionsEnabled'] } } },
  { type: 'function', function: { name: 'check_gh', description: 'Report gh auth status and whether the token has the project scope needed for Projects v2.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'scaffold_github', description: 'Create the project board, Status/Priority/Size fields, labels, and pinned status issue. Requires render_scaffold first.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'set_secret', description: 'Set a GitHub Actions secret (encrypted) on this repo via gh. Use for tokens/keys.', parameters: { type: 'object', properties: { name: { type: 'string' }, value: { type: 'string' } }, required: ['name', 'value'] } } },
  { type: 'function', function: { name: 'set_variable', description: 'Set a GitHub Actions variable (plaintext) on this repo via gh. Use for URLs, model IDs, enable flags.', parameters: { type: 'object', properties: { name: { type: 'string' }, value: { type: 'string' } }, required: ['name', 'value'] } } },
  { type: 'function', function: { name: 'verify_daytona', description: 'Prove a Daytona API key works by creating and deleting a throwaway sandbox. Call before storing the key.', parameters: { type: 'object', properties: { apiKey: { type: 'string' } }, required: ['apiKey'] } } },
  { type: 'function', function: { name: 'finish', description: 'End onboarding with a short summary of what was configured and anything left for the user.', parameters: { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'] } } },
];

function onboardingSystemPrompt(d) {
  const nwo = `${d.owner}/${d.repo}`;
  return `You are the nanobots onboarding agent, running inside the \`npx nanobots-sh init\` CLI, on the user's machine, in their target git repo. Your job: get a complete, working nanobots install stood up for THIS repo, conversationally, using your tools.

You cannot see the screen. Communicate ONLY through message_user (to tell the user things) and ask_user (to collect input). Never put user-facing text in plain assistant content. Be warm but concise — one or two sentences per step before you act. Never invent a token, key, or URL: always ask_user for secret values.

Target repo: ${nwo} (default branch ${d.defaultBranch}). Detected gate/test commands: ${d.gates.join(', ') || 'none detected'}.

Run the setup in this order:

A. CONFIG — greet, name the repo, then gather (ask_user, accepting the bracketed default on empty input): board name [Nanobots]; human-gate label [summon-human]; WIP cap [2]; gate/test commands, comma-separated [the detected ones above]; hard-gate areas never auto-worked, comma-separated [payments, auth, db migrations, secrets, prod infra, destructive ops]; install the scheduled outer-loop + worker Actions crons? [yes]. Then call render_scaffold with the collected values (split comma lists into arrays).

B. GITHUB STATE — call check_gh. If the token lacks the project scope, tell the user to run \`gh auth refresh -s project\` in another terminal, then ask_user to continue and re-check. Once ready, call scaffold_github.

C. REQUIRED SECRETS — for each, explain what it is and how to get it, ask_user (secret:true), then set_secret:
   • CLAUDE_CODE_OAUTH_TOKEN — model credential for the outer loop + workers; mint with \`claude setup-token\` (Claude Pro/Max subscription). If the user prefers a metered API key, set the name ANTHROPIC_API_KEY instead. Exactly one of the two is required.
   • PROJECTS_PAT — a CLASSIC GitHub personal access token with project + repo scopes, from a human account (the default GITHUB_TOKEN cannot touch org Projects v2). github.com → Settings → Developer settings → Personal access tokens (classic).
   • DAYTONA_API_KEY — from daytona.io → API Keys. REQUIRED; workers always build in a Daytona sandbox. Before storing it, call verify_daytona with the key; only set_secret it if the proof passes. If it fails, report the error and offer to retry.

D. RECOMMENDED — PER-RUN GITHUB APP CREDENTIALS. Explain the tradeoff in two sentences, then ask whether to set it up now (skipping is fine — the PAT keeps working and they can add this later). Without an App, the sandbox holds a long-lived, org-wide PAT that can open, update, and merge PRs, which makes the outer loop's review advisory rather than authoritative. With one, the sandbox gets a short-lived, repository-scoped token per run that can clone and push and nothing else.
   If yes, walk them through it: register a GitHub App (Settings → Developer settings → GitHub Apps → New), install it on SELECTED REPOSITORIES (this repo only, never "all repositories"), and grant exactly Contents: write and Metadata: read — and explicitly NOT Pull requests, Administration, Checks, or Statuses. Then ask_user for each and store: set_secret NANOBOTS_GITHUB_APP_ID; set_secret NANOBOTS_GITHUB_APP_INSTALLATION_ID (the number at the end of the installation's settings URL); set_secret NANOBOTS_GITHUB_APP_PRIVATE_KEY (secret:true — the whole PEM including BEGIN/END lines; if their terminal mangles multi-line paste, tell them a single line with \\n escapes works, those are restored automatically).
   State two caveats plainly: all three values are required, and a partial setup is treated as unconfigured and silently falls back to the PAT; and \`contents: write\` is repository-wide, NOT branch-scoped — branch protection on the default branch, not the token, is what actually contains a stray push.
   Only if they say tasks may edit .github/workflows: set_variable NANOBOTS_GITHUB_APP_WORKFLOWS=true, and warn that an org owner must grant Workflows: write on the installation FIRST, because requesting a permission the installation lacks makes EVERY token mint fail and stalls every run.

E. REQUIRED OCR REVIEW — every nanobots:built PR gets a required review. Note the endpoint powering YOU is exactly what OCR needs, so the user can reuse it. Confirm each value with ask_user, then: set_secret OCR_LLM_TOKEN; set_variable OCR_LLM_URL (e.g. https://api.deepseek.com/chat/completions); set_variable OCR_LLM_MODEL (e.g. deepseek-v4-flash).

F. OPTIONAL AUTOFIX — ask if they want the surgical autofix responder (writes code, only inside Daytona). If yes: set_secret OCR_AUTOFIX_TOKEN (falls back to OCR_LLM_TOKEN), set_variable OCR_AUTOFIX_MODEL and OCR_AUTOFIX_URL (fall back to OCR_LLM_*), set_variable OCR_AUTOFIX_ENABLED=true. If no, skip.

G. CRONS — only if they chose to install the Actions in step A, ask whether to enable the crons now (they may prefer to watch a manual cycle first). If yes: set_variable NANOBOTS_OUTER_ENABLED=1 and NANOBOTS_WORKER_ENABLED=1.

H. MANUAL STEP — message_user the one thing the GitHub API can't do: in the Project's Workflows settings, enable "Auto-add to project" with filter \`is:issue is:open label:nanobots:inbox\`, set "Item added to project" → Status: Inbox, and confirm "Issue closed"/"PR merged" → Done.

I. Call finish with a concise summary: what got set, what's optional/left, and how to start the loop (\`/loop\` in Claude Code with .nanobots/LOOP-PROMPT.md, or \`npx nanobots-sh run outer\`).

If any tool returns an error, tell the user plainly and offer to retry or skip. Respect skips. Keep going until the required steps are done or the user asks to stop, then finish.`;
}

const DRY_RUN = process.env.NANOBOTS_INIT_DRY_RUN === '1';

// Scripted answers for a dry run. An empty string is the natural "accept the bracketed
// default" reply, which makes this robust to however the agent chooses to word a question.
// Anything asking for a credential gets an obvious sentinel so the agent walks the whole
// secret-collection path — set_secret is a recorder here, so no real credential is involved.
function dryRunAnswer(question) {
  const scripted = process.env.NANOBOTS_INIT_DRY_RUN_ANSWERS;
  if (scripted) {
    try {
      for (const [pattern, answer] of Object.entries(JSON.parse(scripted))) {
        if (new RegExp(pattern, 'i').test(question)) return answer;
      }
    } catch { /* malformed script — fall through to the heuristics */ }
  }
  if (/\b(token|key|pem|secret|pat)\b/i.test(question)) return 'DRYRUN-NOT-A-REAL-CREDENTIAL';
  if (/\b(yes\/no|y\/n|do you want|would you like|should i|enable|set (this|it) up)\b/i.test(question)) return 'yes';
  return ''; // accept the default
}

// Every tool becomes a recorder. Secret VALUES are never captured — a transcript can land in
// CI logs — only the name and whether a value was supplied.
function dryRunTools(transcript) {
  const rec = (tool, detail, result) => { transcript.push({ tool, ...detail }); return result; };
  return {
    message_user: async ({ text }) => rec('message_user', { chars: (text || '').length }, 'shown'),
    ask_user: async ({ question, secret }) => {
      const answer = dryRunAnswer(question || '');
      return rec('ask_user', { question, secret: !!secret, answered: answer ? (secret ? '<redacted>' : answer) : '<default>' }, answer);
    },
    render_scaffold: async (a) => rec('render_scaffold', {
      board: a.board, humanLabel: a.humanLabel, wipCap: a.wipCap,
      gates: a.gates, hardGates: a.hardGates, actionsEnabled: a.actionsEnabled,
    }, 'scaffold written (dry run — nothing was actually written).'),
    check_gh: async () => rec('check_gh', {}, 'authenticated. project scope: present.'),
    scaffold_github: async () => rec('scaffold_github', {}, 'board ready (project #1), status issue #1, labels + fields created.'),
    set_secret: async ({ name, value }) => rec('set_secret', { name, hasValue: Boolean(value) }, `secret ${name} set.`),
    set_variable: async ({ name, value }) => rec('set_variable', { name, value }, `variable ${name}=${value} set.`),
    verify_daytona: async () => rec('verify_daytona', {}, 'daytona ok — created and deleted sandbox sbx-dryrun.'),
  };
}

function emitTranscript(transcript, finished) {
  const out = JSON.stringify({ finished, calls: transcript }, null, 2);
  const dest = process.env.NANOBOTS_INIT_DRY_RUN_OUT;
  if (dest) { writeFileSync(dest, `${out}\n`); say(`dry-run transcript → ${dest}`); }
  else console.log(`\n--- nanobots dry-run transcript ---\n${out}`);
}

async function cmdInit(flags) {
  const d = detect();
  if (!d.owner) die('could not parse owner/repo from the origin remote');

  // Hidden non-interactive path for CI and this package's own tests.
  if (flags.headless) {
    const cfg = buildConfig(d, {});
    renderScaffold(d, cfg);
    if (!flags.noGithub) {
      try { scaffoldGitHub(cfg); } catch (e) { die(e.message); }
    } else {
      say('--no-github: skipped board/label scaffolding.');
    }
    say('headless scaffold complete.');
    return;
  }

  const url = process.env.OCR_LLM_URL;
  const token = process.env.OCR_LLM_TOKEN;
  const model = process.env.OCR_LLM_MODEL;
  if (!url || !token || !model) {
    die(`\`nanobots init\` is an AI onboarding agent — it needs an OpenAI-compatible inference endpoint.
It runs on the SAME provider your repo needs for the required OCR review, so this key isn't extra.

Set these first, then re-run \`npx nanobots-sh init\`:

  export OCR_LLM_URL=https://api.deepseek.com/chat/completions
  export OCR_LLM_TOKEN=sk-...              # your provider key
  export OCR_LLM_MODEL=deepseek-v4-flash

Any OpenAI-compatible /chat/completions endpoint with tool-calling works (DeepSeek, OpenAI, Together, a local server, …).`);
  }

  console.log(`\n${c.cyan('nanobots init')} — onboarding agent for ${d.owner}/${d.repo} (${d.defaultBranch})`);
  console.log(c.dim(`running on ${model} @ ${url}\n`));

  const nwo = `${d.owner}/${d.repo}`;
  const state = { cfg: null };

  const liveTools = {
    message_user: async ({ text }) => { console.log(`\n${text}\n`); return 'shown'; },
    ask_user: async ({ question, secret }) => promptLine(`${c.cyan('?')} ${question} `, { secret: !!secret }),
    render_scaffold: async (a) => {
      state.cfg = buildConfig(d, {
        board: a.board, humanLabel: a.humanLabel, wipCap: parseInt(a.wipCap, 10) || 2,
        gates: a.gates || [], hardGates: a.hardGates || [], actionsEnabled: a.actionsEnabled !== false,
      });
      renderScaffold(d, state.cfg);
      return `scaffold written for ${nwo} (board "${state.cfg.board}", WIP cap ${state.cfg.wipCap}, actions ${state.cfg.actionsEnabled ? 'on' : 'off'}).`;
    },
    check_gh: async () => {
      const status = shTry('gh auth status') ?? '';
      if (!status) return 'gh is not authenticated. Run `gh auth login` (with the project scope), then retry.';
      return `authenticated. project scope: ${status.includes('project') ? 'present' : "MISSING — run `gh auth refresh -s project`"}.`;
    },
    scaffold_github: async () => {
      if (!state.cfg) return 'error: call render_scaffold first.';
      try { const coords = scaffoldGitHub(state.cfg); return `board ready (project #${coords.projectNumber}), status issue #${coords.statusIssue}, labels + fields created.`; }
      catch (e) { return `error: ${e.message}`; }
    },
    set_secret: async ({ name, value }) => {
      if (!name || value == null) return 'error: name and value required.';
      const r = spawnSync('gh', ['secret', 'set', name, '--repo', nwo], { input: String(value) });
      return r.status === 0 ? `secret ${name} set.` : `error: gh secret set ${name} failed: ${(r.stderr || '').toString().slice(0, 200)}`;
    },
    set_variable: async ({ name, value }) => {
      if (!name || value == null) return 'error: name and value required.';
      const r = spawnSync('gh', ['variable', 'set', name, '--repo', nwo, '--body', String(value)]);
      return r.status === 0 ? `variable ${name}=${value} set.` : `error: gh variable set ${name} failed: ${(r.stderr || '').toString().slice(0, 200)}`;
    },
    verify_daytona: async ({ apiKey }) => {
      if (!apiKey) return 'error: apiKey required.';
      try { const p = await daytonaProof(apiKey); return `daytona ok — created and ${p.cleaned ? 'deleted' : 'FAILED to delete'} sandbox ${p.sandboxId}.${p.cleaned ? '' : ' Check the dashboard and remove it manually.'}`; }
      catch (e) { return `daytona verification FAILED: ${e.message}`; }
    },
  };

  // Dry run (NANOBOTS_INIT_DRY_RUN=1): swap every side-effecting tool for a recorder so CI can
  // exercise the REAL agent loop against a REAL endpoint with zero side effects — nothing
  // written, no `gh` invoked, no secrets set, no sandbox created. This is how the one path
  // every new user hits gets tested without a throwaway repo per run.
  const transcript = [];
  const toolImpls = DRY_RUN ? dryRunTools(transcript) : liveTools;

  const messages = [
    { role: 'system', content: onboardingSystemPrompt(d) },
    { role: 'user', content: 'Begin onboarding.' },
  ];

  for (let step = 0; step < 60; step++) {
    let msg;
    try { msg = await llmChat({ url, token, model, messages, tools: ONBOARDING_TOOLS }); }
    catch (e) { die(`onboarding agent call failed: ${e.message}`); }
    messages.push(msg);

    const calls = msg.tool_calls || [];
    if (!calls.length) {
      // Model replied in prose instead of calling a tool — surface it and let the user drive.
      if (msg.content && msg.content.trim()) console.log(`\n${msg.content.trim()}\n`);
      const reply = await promptLine(`${c.cyan('you:')} `);
      if (!reply.trim() || /^(done|exit|quit|stop)$/i.test(reply.trim())) { console.log('\nonboarding ended.'); return; }
      messages.push({ role: 'user', content: reply });
      continue;
    }

    let finished = null;
    for (const call of calls) {
      const name = call.function?.name;
      let a = {};
      try { a = JSON.parse(call.function?.arguments || '{}'); } catch { /* tolerate empty/garbled args */ }
      let result;
      if (name === 'finish') { finished = a.summary || 'done'; result = 'ok'; }
      else if (toolImpls[name]) result = await toolImpls[name](a);
      else result = `error: unknown tool ${name}`;
      messages.push({ role: 'tool', tool_call_id: call.id, content: typeof result === 'string' ? result : JSON.stringify(result) });
    }
    if (finished !== null) {
      console.log(`\n${c.cyan('Done.')} ${finished}\n`);
      if (DRY_RUN) emitTranscript(transcript, finished);
      return;
    }
  }
  if (DRY_RUN) emitTranscript(transcript, null);
  warn('onboarding hit its step limit — re-run `npx nanobots-sh init` to continue where the repo left off.');
}

function cmdUpdate() {
  const d = detect();
  const cfgPath = join(d.root, '.nanobots', 'config.json');
  if (!existsSync(cfgPath)) die('no .nanobots/config.json — run `nanobots init` first');
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
  const values = templateValues(cfg);
  for (const entry of ENGINE_OWNED) writeRendered(d.root, entry, values, { overwrite: true });
  for (const entry of CONDITIONAL_ENGINE_OWNED) {
    if (entry.when(cfg)) writeRendered(d.root, entry, values, { overwrite: true });
  }
  say('engine-owned files re-rendered. Repo-owned files (TRIAGE, RECIPES, LEARNINGS, config) untouched.');
}

// ── verify ───────────────────────────────────────────────────────────────────

async function cmdVerify(target) {
  if (target !== 'daytona') die('usage: nanobots verify daytona');
  const apiKey = process.env.DAYTONA_API_KEY;
  if (!apiKey) die('DAYTONA_API_KEY not set');

  say('authenticating to Daytona + running a create/delete proof...');
  let proof;
  try { proof = await daytonaProof(apiKey); }
  catch (e) { die(e.message); }
  say(`sandbox ${proof.sandboxId} created.`);
  if (proof.cleaned) say('deleted.');
  else warn(`cleanup failed for ${proof.sandboxId} — check the Daytona dashboard and delete it manually.`);

  say(`${c.cyan('daytona: ready')} — connection + lifecycle proof passed.`);
}

function cmdExtension() {
  // Chrome has no CLI install path for extensions (by design), so this
  // materializes the extension folder locally and prints the load steps.
  const src = join(TEMPLATES, '..', 'extension');
  if (!existsSync(src)) die('extension files missing from this package — update nanobots-sh');
  const dest = join(process.cwd(), 'nanobots-extension');
  cpSync(src, dest, { recursive: true });
  say(`extension copied to ${dest}`);
  console.log(`
To load it in Chrome/Brave/Edge:
  1. open chrome://extensions
  2. toggle "Developer mode" (top right)
  3. "Load unpacked" → select ${dest}
  4. pin the icon, then open its Options to connect GitHub + R2 + a model key
`);
}

function cmdRun(role) {
  if (!['outer', 'worker'].includes(role)) die('usage: nanobots run <outer|worker>');
  const d = detect();
  const script = join(d.root, '.nanobots', 'run-cycle.sh');
  if (!existsSync(script)) die('no .nanobots/run-cycle.sh — run `nanobots init` first');
  const res = spawnSync('bash', [script, role], { cwd: d.root, stdio: 'inherit' });
  process.exit(res.status ?? 1);
}

// ── main ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args.find((a) => !a.startsWith('-'));
const flags = {
  headless: args.includes('--headless'),   // hidden: CI / self-test scaffold, no agent
  noGithub: args.includes('--no-github'),
};

switch (command) {
  case 'init':
    await cmdInit(flags);
    break;
  case 'update':
    cmdUpdate();
    break;
  case 'run':
    cmdRun(args[args.indexOf('run') + 1]);
    break;
  case 'extension':
    cmdExtension();
    break;
  case 'verify':
    await cmdVerify(args[args.indexOf('verify') + 1]);
    break;
  case 'version':
    console.log(VERSION);
    break;
  default:
    console.log(`
${c.cyan('nanobots')} v${VERSION} — self-improving agent loops for any GitHub repo

  nanobots init                                    AI onboarding agent (needs OCR_LLM_URL/TOKEN/MODEL)
  nanobots update                                  re-render engine-owned files
  nanobots run <outer|worker>                      one headless cycle (worker = Daytona sandbox)
  nanobots verify daytona                          connection + lifecycle proof before enabling the worker cron
  nanobots extension                               copy the browser extension here (+ load steps)
  nanobots version

Docs: https://github.com/TimHeckel/nanobots
`);
}
