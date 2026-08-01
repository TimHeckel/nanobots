#!/usr/bin/env node
// nanobots — self-improving agent loops for any GitHub repo.
// Zero-dependency scaffolder: after `init`, the target repo is self-contained.

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import readline from 'node:readline/promises';
import { Writable } from 'node:stream';

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

  // Prove EXEC, not just lifecycle. Create/delete passing while exec is broken is exactly
  // what happened in practice: `verify daytona` reported "ready", then every real worker run
  // died at its first command inside a sandbox it had already paid to provision. A proof that
  // skips the thing the worker actually does is not a proof.
  let exec = null;
  try {
    const detail = await (await fetch(`${base}/sandbox/${sandbox.id}`, { headers })).json();
    const proxy = detail?.toolboxProxyUrl;
    if (!proxy) throw new Error('sandbox advertises no toolboxProxyUrl — the API shape has moved');
    const r = await fetch(`${proxy.replace(/\/$/, '')}/${sandbox.id}/process/execute`, {
      method: 'POST', headers, body: JSON.stringify({ command: 'echo nanobots-verify' }),
    });
    const body = await r.text();
    if (!r.ok) throw new Error(`${r.status}: ${body.slice(0, 200)}`);
    const parsed = JSON.parse(body);
    if (parsed.exitCode !== 0 || !String(parsed.result ?? '').includes('nanobots-verify')) {
      throw new Error(`unexpected result: ${body.slice(0, 200)}`);
    }
    exec = { ok: true };
  } catch (err) {
    exec = { ok: false, error: err.message };
  }

  const delRes = await fetch(`${base}/sandbox/${sandbox.id}`, { method: 'DELETE', headers });
  const cleaned = delRes.ok;
  if (!exec.ok) {
    throw new Error(`sandbox exec failed (create/delete were fine, so this is the toolbox API): ${exec.error}`);
  }
  return { sandboxId: sandbox.id, cleaned, execOk: true };
}

// ── GitHub App creation (manifest flow) ───────────────────────────────────────
// GitHub has no API to create an App outright, but the App Manifest flow gets us all the way
// there: we POST a manifest with the permissions ALREADY DECLARED, the user just clicks
// "Create GitHub App", and GitHub hands back a code we exchange for the App id AND private
// key. That is the whole point — a hand-created App lets someone tick `pull_requests` and
// silently defeat the per-run credential design. A manifest makes the permission set
// impossible to get wrong.

function manifestPage(manifest, actionUrl) {
  const json = JSON.stringify(manifest)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return `<!doctype html><meta charset="utf-8"><title>Creating your nanobots GitHub App…</title>
<body style="font:15px system-ui;padding:3rem;max-width:34rem;margin:auto">
<h2>Handing you to GitHub…</h2>
<p>Review the permissions (Contents: write, Metadata: read — nothing else) and press
<b>Create GitHub App</b>. You'll come straight back here.</p>
<form id="f" method="post" action="${actionUrl}"><input type="hidden" name="manifest" value="${json}"></form>
<script>document.getElementById('f').submit()</script></body>`;
}

const DONE_PAGE = `<!doctype html><meta charset="utf-8"><title>nanobots</title>
<body style="font:15px system-ui;padding:3rem;max-width:34rem;margin:auto">
<h2>✅ App created</h2><p>Return to your terminal — nanobots has the credentials.</p></body>`;

// Runs a one-shot local listener, walks the user through the GitHub form, and converts the
// resulting code into { appId, pem, slug }. Never writes the key to disk.
async function createAppViaManifest({ owner, repo, isOrg, appName }) {
  const { createServer } = await import('node:http');
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname === '/') {
        const port = server.address().port;
        const manifest = {
          name: appName,
          url: `https://github.com/${owner}/${repo}`,
          redirect_url: `http://127.0.0.1:${port}/cb`,
          public: false,
          // nanobots polls and needs no webhook, but GitHub's manifest schema still REQUIRES
          // hook_attributes.url whenever hook_attributes is present — omitting it fails the
          // whole submission with the unhelpful `"url" wasn't supplied`. Supply a valid URL
          // and disable delivery.
          hook_attributes: { url: `https://github.com/${owner}/${repo}`, active: false },
          default_events: [],
          // The load-bearing line: contents+metadata only. No pull_requests, no checks,
          // no statuses, no administration.
          default_permissions: { contents: 'write', metadata: 'read' },
        };
        const action = isOrg
          ? `https://github.com/organizations/${owner}/settings/apps/new`
          : 'https://github.com/settings/apps/new';
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end(manifestPage(manifest, action));
        return;
      }
      if (url.pathname === '/cb') {
        const code = url.searchParams.get('code');
        if (!code) { res.writeHead(400); res.end('missing code'); return; }
        try {
          const conv = await fetch(`https://api.github.com/app-manifests/${code}/conversions`, {
            method: 'POST',
            headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'nanobots-init' },
          });
          const body = await conv.json();
          if (!conv.ok || !body.id) throw new Error(`conversion failed: ${conv.status} ${body.message ?? ''}`);
          res.writeHead(200, { 'content-type': 'text/html' });
          res.end(DONE_PAGE);
          server.close();
          resolve({ appId: String(body.id), pem: body.pem, slug: body.slug, htmlUrl: body.html_url });
        } catch (err) {
          res.writeHead(500); res.end(String(err.message));
          server.close();
          reject(err);
        }
        return;
      }
      res.writeHead(404); res.end();
    });

    server.listen(0, '127.0.0.1', () => {
      const url = `http://127.0.0.1:${server.address().port}/`;
      console.log(`\n${c.cyan('→')} opening ${url} — if your browser didn't open, paste that URL into it.\n`);
      openBrowser(url);
    });
    server.on('error', reject);
    // Generous: the user has to read a GitHub permissions page and click through.
    setTimeout(() => { server.close(); reject(new Error('timed out waiting for the GitHub App to be created (5 min)')); }, 5 * 60 * 1000);
  });
}

// After creation the App still has to be INSTALLED on the repo. We can't click that for the
// user, but we can watch for it: mint an App JWT and poll until the installation appears,
// which also yields the installation id without asking them to read it out of a URL.
async function waitForInstallation({ appId, pem, slug }, { timeoutMs = 5 * 60 * 1000 } = {}) {
  const { appJwt } = await import(pathToFileURL(join(TEMPLATES, 'nanobots', 'github-app-auth.mjs')).href);
  const installUrl = `https://github.com/apps/${slug}/installations/new`;
  console.log(`\n${c.cyan('→')} opening ${installUrl}\n   Choose ${c.cyan('Only select repositories')} and pick your repo, then come back here.\n`);
  openBrowser(installUrl);

  const started = Date.now();
  process.stdout.write('   waiting for the installation');
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch('https://api.github.com/app/installations', {
        headers: {
          Authorization: `Bearer ${appJwt({ appId, privateKey: pem })}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'nanobots-init',
        },
      });
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          process.stdout.write(' ✓\n');
          return String(list[0].id);
        }
      }
    } catch { /* transient — keep polling */ }
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, 3000));
  }
  process.stdout.write('\n');
  throw new Error('timed out waiting for the app installation');
}

// ── the onboarding agent ───────────────────────────────────────────────────────
// nanobots has no interactive install path other than this. `init` boots an agent on
// the same OpenAI-compatible endpoint the repo already needs for OCR review, and that
// agent drives the whole setup — config, scaffold, GitHub state, secrets, verification —
// conversationally, through the tools below. (Hidden `--headless` scaffolds from defaults
// for CI/self-tests; it is deliberately absent from the help text.)

// Defence in depth. The onboarding agent is told to set secret:true when it asks for a
// credential, but compliance is nondeterministic — observed both ways against the same model.
// A credential must never echo in the user's terminal because of a model slip, so we mask on
// the question text too and treat the model's flag as a hint, not the control.
const CREDENTIAL_QUESTION = /\b(token|api[- ]?key|key|pem|private[- ]?key|secret|password|pat|credential)\b/i;
const isCredentialPrompt = (question, flagged) => Boolean(flagged) || CREDENTIAL_QUESTION.test(question || '');

// Terminal line reader with optional masking for secret values (zero-dependency).
// ONE readline interface for the whole session, created lazily. Two hard-won constraints:
//   1. `node:readline/promises` question() RETURNS A PROMISE and takes no callback. Passing
//      one is silently swallowed as an options object and the prompt hangs forever.
//   2. A fresh interface per prompt does NOT survive the previous one's close() — the second
//      prompt never receives input. The interface must be shared and closed once at the end.
// Both of these hung `init` outright, which is the only install path, so they are covered by
// tests/prompt.test.mjs.
let sharedRl = null;
let promptOut = null;
function promptInterface() {
  if (!sharedRl) {
    // readline echoes input to its output stream. Redrawing over that echo afterwards is too
    // late — a PASTED credential arrives as one chunk, gets echoed in full, and is in the
    // terminal (and scrollback) before any redraw runs. So we give readline a mutable sink
    // and suppress the echo at the source instead.
    promptOut = new Writable({
      write(chunk, enc, cb) {
        if (promptOut.muted) process.stdout.write('*');
        else process.stdout.write(chunk, enc);
        cb();
      },
    });
    promptOut.muted = false;
    sharedRl = readline.createInterface({ input: process.stdin, output: promptOut, terminal: true });
  }
  return sharedRl;
}
function closePrompt() {
  if (sharedRl) { sharedRl.close(); sharedRl = null; promptOut = null; }
}

// Numbered multiple choice. Better than a free-text question whenever the user might not
// have the thing yet — "paste it" vs "walk me through getting one" is a choice, not a blank.
async function promptChoice(question, options) {
  console.log(`\n${c.cyan('?')} ${question}`);
  options.forEach((o, i) => console.log(`   ${c.cyan(String(i + 1))}) ${o}`));
  for (;;) {
    const raw = (await promptLine(`   choose 1-${options.length}: `)).trim();
    const n = Number.parseInt(raw, 10);
    if (n >= 1 && n <= options.length) return options[n - 1];
    const typed = raw && options.find((o) => o.toLowerCase().startsWith(raw.toLowerCase()));
    if (typed) return typed;
    console.log(c.dim(`   enter a number between 1 and ${options.length}`));
  }
}

function openBrowser(url) {
  // Tests drive this flow for real and must not hijack the developer's browser.
  if (process.env.NANOBOTS_NO_BROWSER === '1') return;
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  spawnSync(cmd, [url], { stdio: 'ignore' });
}

async function promptLine(query, { secret = false } = {}) {
  const rl = promptInterface();
  if (!secret) return rl.question(query);
  const answer = rl.question(query);   // the prompt itself is written while still unmuted
  promptOut.muted = true;              // …everything after it becomes asterisks
  try {
    return await answer;
  } finally {
    promptOut.muted = false;
    process.stdout.write('\n');
  }
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
  { type: 'function', function: { name: 'ask_user', description: 'Ask an open question and return the typed answer. Set secret:true for tokens/keys (input is masked). Prefer ask_choice whenever the answer is one of a known set.', parameters: { type: 'object', properties: { question: { type: 'string' }, secret: { type: 'boolean' } }, required: ['question'] } } },
  { type: 'function', function: { name: 'ask_choice', description: 'Ask a multiple-choice question; the user picks by number and the chosen option string is returned. Use this for every yes/no and every "do you have X or should I help you get it" decision — it is far better than an open question when the user may not have the thing yet.', parameters: { type: 'object', properties: { question: { type: 'string' }, options: { type: 'array', items: { type: 'string' }, minItems: 2 } }, required: ['question', 'options'] } } },
  { type: 'function', function: { name: 'create_github_app', description: 'CREATE the GitHub App for the user via GitHub\'s App Manifest flow: opens their browser, they press one button, and this returns the App ID and private key with the correct permissions (contents:write + metadata:read, no pull_requests) already baked in. Then it waits for them to install it and captures the installation id. Use this instead of asking them to create an App by hand.', parameters: { type: 'object', properties: { appName: { type: 'string', description: 'Globally unique App name, e.g. nanobots-<owner>' }, isOrg: { type: 'boolean', description: 'true if the repo owner is an organization' } }, required: ['appName'] } } },
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

You cannot see the screen. Communicate ONLY through message_user (to tell the user things) and ask_user (to collect input). Never put user-facing text in plain assistant content. Be warm but concise. Never invent a token, key, or URL: always ask_user for secret values.

TWO RULES THAT ARE NOT OPTIONAL:
1. **message_user before every lettered section below.** ask_user asks a bare question with no context; message_user is the only way the user learns what a thing is, why it is needed, or how to get it. A run that is nothing but ask_user calls is a failed run — the user is staring at demands with no explanation.
2. **secret:true on EVERY ask_user that collects a token, key, PEM, password, or PAT.** Without it their credential echoes in plain text in their terminal and scrollback.

KEEP IT SHORT — this is a terminal, not a document:
- Your opening greeting is ONE short sentence. Do not preview what is coming, do not list the questions you are about to ask, do not define terms up front.
- Each message_user is 1-2 sentences, max ~30 words. If a section needs more, say the minimum and let the questions carry the rest.
- **Explain each thing at the moment you ask about it, never in advance.** A question whose meaning is obvious from its own wording (board name, WIP cap) needs no explanation at all — just ask it.
- Never restate what the user just told you back to them. Acknowledge briefly or not at all.

ANSWER HANDLING:
- For any question that collects a LIST (gate commands, hard-gate areas), treat a bare "none", "no", "n/a", "skip", "empty", or "-" as an explicitly EMPTY list. Pass [] — never store the literal word as a list entry. Empty is a valid, supported answer for both of these; say so in the question itself, e.g. "(or 'none')".
- An empty reply always means "accept the bracketed default", which is NOT the same as "none". Do not conflate them.

Target repo: ${nwo} (default branch ${d.defaultBranch}). Detected gate/test commands: ${d.gates.join(', ') || 'none detected'}.

Run the setup in this order:

A. CONFIG — greet, name the repo, then gather (ask_user, accepting the bracketed default on empty input): board name [Nanobots]; human-gate label [summon-human]; WIP cap [2]; gate/test commands, comma-separated [the detected ones above]; hard-gate areas never auto-worked, comma-separated [payments, auth, db migrations, secrets, prod infra, destructive ops]; install the scheduled outer-loop + worker Actions crons? [yes]. Then call render_scaffold with the collected values (split comma lists into arrays).

B. GITHUB STATE — call check_gh. If the token lacks the project scope, tell the user to run \`gh auth refresh -s project\` in another terminal, then ask_user to continue and re-check. Once ready, call scaffold_github.

C. REQUIRED SECRETS — for each, explain what it is and how to get it, ask_user (secret:true), then set_secret:
   • CLAUDE_CODE_OAUTH_TOKEN — model credential for the outer loop + workers; mint with \`claude setup-token\` (Claude Pro/Max subscription). If the user prefers a metered API key, set the name ANTHROPIC_API_KEY instead. Exactly one of the two is required.
   • PROJECTS_PAT — a CLASSIC GitHub personal access token with THREE scopes: repo, project, AND read:org, from a human account (the default GITHUB_TOKEN cannot touch org Projects v2). read:org is required even for a personal account: without it the \`gh project\` CLI fails with "unknown owner type" even though the underlying GraphQL API works. Give them this direct link, which pre-ticks all three: https://github.com/settings/tokens/new?scopes=repo,project,read:org&description=nanobots
   • DAYTONA_API_KEY — from daytona.io → API Keys. REQUIRED; workers always build in a Daytona sandbox. Before storing it, call verify_daytona with the key; only set_secret it if the proof passes. If it fails, report the error and offer to retry.

C2. CLAUDE CODE GITHUB APP — REQUIRED for the Actions outer loop, and easy to miss because everything else can be perfectly configured and the loop still fails 100% of the time without it. The outer-loop workflow uses anthropics/claude-code-action, which refuses to run unless the Claude Code GitHub App is installed on the repository: every cycle dies with "Claude Code is not installed on this repository". It is NOT needed if they only ever run the loop from a laptop or their own VM, which invoke the claude CLI directly.
   message_user this, with the link https://github.com/apps/claude, then ask_choice: ["I've installed it (or I'll only run the loop locally)", "Open the link and wait while I install it"]. Either way just proceed afterwards — you cannot verify the installation yourself, so do not claim you did.

D. PER-RUN GITHUB APP CREDENTIALS — YOU CREATE IT FOR THEM, they do not create it by hand.
   Explain the tradeoff in two sentences: without an App the sandbox holds a long-lived, org-wide PAT that can open, update and merge PRs — which makes the outer loop's review advisory instead of authoritative; with one, each run gets a short-lived, repo-scoped token that can clone and push and nothing else.
   Then ask_choice: ["Create the GitHub App for me now (recommended)", "I'll paste credentials for an App I already have", "Skip — use the PAT for now, add this later"].
   • "Create … for me" → call create_github_app with appName "nanobots-<owner>" (lowercased) and isOrg set correctly. It opens their browser, they click one button, and it stores all three secrets itself. DO NOT ask them for App ID, installation ID, or the PEM afterwards — the tool already stored them. Just confirm what happened.
   • "I'll paste …" → ask_user for each of the three and set_secret them. Tell them all three are required; a partial setup is treated as unconfigured and silently falls back to the PAT.
   • "Skip" → say the PAT stays in use and move on. Do not store anything.
   Only if they say tasks may edit .github/workflows: set_variable NANOBOTS_GITHUB_APP_WORKFLOWS=true, warning that an org owner must grant Workflows: write on the installation FIRST or every token mint fails.

E. REQUIRED OCR REVIEW. Explain properly before asking for anything — most users have never heard of this. Say, in your own words: OCR is Open Code Review, an independent second model that reviews every PR a nanobot opens, on that PR's exact commit. It posts real GitHub review comments, and findings it rates critical or high BLOCK the merge until they are fixed or a human overrides. It is required and has no opt-out, because isolated builds without an independent review of the result is only half the safety story — the worker that wrote the code is not allowed to be the only thing that judges it. Mention that the endpoint powering YOU is exactly what OCR needs, so they can reuse the same values. Confirm each with ask_user, then: set_secret OCR_LLM_TOKEN; set_variable OCR_LLM_URL; set_variable OCR_LLM_MODEL.

F. OPTIONAL AUTOFIX RESPONDER. Explain what it actually does before asking: when OCR blocks a PR, this second model tries to fix the findings itself. It proposes exact, character-level text replacements — never free-form patches or shell commands — and each one is validated mechanically against the real file before anything is written. The repair runs in its own disposable Daytona sandbox, and it only pushes if your gates pass and the PR hasn't moved. Anything it is unsure about, or that touches a protected path (.github, .nanobots, lockfiles, auth, migrations, infra), comes back as "needs human" instead of a patch. Capped at 3 rounds per PR. Say plainly that this is the one optional component that WRITES CODE, and that leaving it off means blocked PRs simply wait for a human.
   Then ask_choice: ["Yes — let it try to fix blocking findings", "No — review only, I'll fix them myself"].
   If yes: set_secret OCR_AUTOFIX_TOKEN (falls back to OCR_LLM_TOKEN), set_variable OCR_AUTOFIX_MODEL and OCR_AUTOFIX_URL (fall back to OCR_LLM_*), set_variable OCR_AUTOFIX_ENABLED=true.

G. CRONS. Explain the consequence before asking, because this is the switch that makes the loop autonomous: enabling them means the outer loop starts triaging on a timer and workers start claiming approved work without you present. Note what still gates it — a worker will not claim anything until a human replies "/nanobots start <hash>" to the plan comment — and note that the crons do nothing until the workflow files are committed and pushed.
   Then ask_choice: ["Not yet — I'll run a cycle by hand first and watch what it does (recommended)", "Yes — enable both crons now"].
   Only on "Yes": set_variable NANOBOTS_OUTER_ENABLED=1 and NANOBOTS_WORKER_ENABLED=1.

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
  if (/\b(token|key|pem|secret|pat|credential)\b/i.test(question)) return 'DRYRUN-NOT-A-REAL-CREDENTIAL';
  // Anything that reads as a confirmation gets an affirmative. Answering "" (accept default)
  // to "do you have X ready?" makes the agent skip the step, which produced false failures.
  if (/\b(y\/n|yes\/no|do you|did you|are you|have you|would you|will you|should i|shall (i|we)|can you|ready|want|like to|prefer|enable|set (this|it|that) up|configure|continue|proceed|go ahead|ok to|now\?)\b/i.test(question)) return 'yes';
  return ''; // accept the bracketed default
}

// Every tool becomes a recorder. Secret VALUES are never captured — a transcript can land in
// CI logs — only the name and whether a value was supplied.
function dryRunTools(transcript) {
  const rec = (tool, detail, result) => { transcript.push({ tool, ...detail }); return result; };
  return {
    message_user: async ({ text }) => rec('message_user', { chars: (text || '').length }, 'shown'),
    ask_user: async ({ question, secret }) => {
      const answer = dryRunAnswer(question || '');
      const masked = isCredentialPrompt(question, secret);
      return rec('ask_user', {
        question,
        secret: !!secret,                 // what the model claimed
        masked,                           // what actually happened
        answered: answer ? (masked ? '<redacted>' : answer) : '<default>',
      }, answer);
    },
    render_scaffold: async (a) => rec('render_scaffold', {
      board: a.board, humanLabel: a.humanLabel, wipCap: a.wipCap,
      gates: a.gates, hardGates: a.hardGates, actionsEnabled: a.actionsEnabled,
    }, 'scaffold written (dry run — nothing was actually written).'),
    ask_choice: async ({ question, options }) => {
      const opts = (options || []).map(String);
      // Prefer the affirmative/"help me" option so a dry run walks the fullest path.
      const pick = opts.find((o) => /^(yes|create|set (it )?up|walk me|help me)/i.test(o)) ?? opts[0] ?? '';
      return rec('ask_choice', { question, options: opts, chose: pick }, pick);
    },
    create_github_app: async ({ appName }) => rec('create_github_app', { appName },
      'GitHub App created (id 999999), installed (installation 888888), all three secrets stored. Nothing further to ask the user for.'),
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
    ask_user: async ({ question, secret }) => promptLine(`${c.cyan('?')} ${question} `, { secret: isCredentialPrompt(question, secret) }),
    ask_choice: async ({ question, options }) => {
      if (!Array.isArray(options) || options.length < 2) return 'error: need at least two options';
      return promptChoice(question, options.map(String));
    },
    create_github_app: async ({ appName, isOrg }) => {
      try {
        const app = await createAppViaManifest({
          owner: d.owner, repo: d.repo, isOrg: Boolean(isOrg),
          appName: appName || `nanobots-${d.owner}`.toLowerCase(),
        });
        say(`app created: ${app.htmlUrl} (id ${app.appId})`);
        // Store immediately — if the install step fails the user still keeps the credentials.
        const put = (name, value) => spawnSync('gh', ['secret', 'set', name, '--repo', nwo], { input: String(value) }).status === 0;
        if (!put('NANOBOTS_GITHUB_APP_ID', app.appId)) return 'error: created the app but failed to store NANOBOTS_GITHUB_APP_ID';
        if (!put('NANOBOTS_GITHUB_APP_PRIVATE_KEY', app.pem)) return 'error: created the app but failed to store NANOBOTS_GITHUB_APP_PRIVATE_KEY';

        const installationId = await waitForInstallation(app);
        if (!put('NANOBOTS_GITHUB_APP_INSTALLATION_ID', installationId)) return 'error: installed, but failed to store NANOBOTS_GITHUB_APP_INSTALLATION_ID';
        return `GitHub App "${app.slug}" created (id ${app.appId}), installed (installation ${installationId}), and all three secrets stored. Permissions are contents:write + metadata:read only — no pull_requests. Nothing further to ask the user for.`;
      } catch (err) {
        return `error: ${err.message}. The PAT fallback still works; offer to skip and add the App later.`;
      }
    },
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

  try {
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
  } finally {
    // Without this the process hangs on an open stdin handle after the agent finishes.
    closePrompt();
  }
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
  say(`sandbox ${proof.sandboxId} created; exec proof passed.`);
  if (proof.cleaned) say('deleted.');
  else warn(`cleanup failed for ${proof.sandboxId} — check the Daytona dashboard and delete it manually.`);

  say(`${c.cyan('daytona: ready')} — connection + lifecycle proof passed.`);
}

// `nanobots app create` — the manifest flow, standalone.
//
// It also lives as a tool inside `init`, but skipping it there used to leave no way back:
// adding per-run credentials later meant re-running the whole onboarding conversation. Most
// people skip it on the first pass (it is the one step that opens a browser), so "later"
// is the common case, not the exception.
// `nanobots app install <slug>` — finish a setup that got as far as creating the App.
// Repo secrets are write-only, so once the id and PEM are stored we cannot read them back to
// mint a JWT and poll for the installation. The installation id is visible to the user in the
// URL after installing, so we ask for it rather than pretending we can discover it.
async function cmdAppInstall(slug) {
  const d = detect();
  if (!d.owner) die('could not parse owner/repo from the origin remote');
  const nwo = `${d.owner}/${d.repo}`;
  if (!slug) die('usage: nanobots app install <app-slug>   (e.g. nanobots-yourname)');

  const url = `https://github.com/apps/${slug}/installations/new`;
  console.log(`\n${c.cyan('→')} opening ${url}`);
  console.log(`   Choose ${c.cyan('Only select repositories')} → ${nwo}, then install.`);
  console.log(`   Afterwards your address bar reads ${c.dim('github.com/settings/installations/<ID>')} — that trailing number is what I need.\n`);
  openBrowser(url);

  const id = (await promptLine(`${c.cyan('?')} Installation ID: `)).trim();
  closePrompt();
  if (!/^\d+$/.test(id)) die(`"${id}" is not an installation id — it is the number at the end of the settings/installations URL`);

  const ok = spawnSync('gh', ['secret', 'set', 'NANOBOTS_GITHUB_APP_INSTALLATION_ID', '--repo', nwo], { input: id }).status === 0;
  if (!ok) die('failed to store NANOBOTS_GITHUB_APP_INSTALLATION_ID');
  say(`installation ${id} stored — all three App secrets are now set.`);
  console.log(`\n${c.cyan('Done.')} Workers on ${nwo} now get a short-lived, repo-scoped token per run.`);
  console.log(`${c.dim('contents:write is repository-wide, not ref-scoped — branch protection is what contains a stray push.')}\n`);
}

async function cmdApp(sub, arg) {
  if (sub === 'install') return cmdAppInstall(arg);
  if (sub !== 'create') die('usage: nanobots app create | nanobots app install <app-slug>');
  const d = detect();
  if (!d.owner) die('could not parse owner/repo from the origin remote');
  const nwo = `${d.owner}/${d.repo}`;

  const existing = shTry(`gh secret list --repo ${nwo}`) ?? '';
  if (existing.includes('NANOBOTS_GITHUB_APP_ID')) {
    warn(`${nwo} already has NANOBOTS_GITHUB_APP_ID set. Creating a second App will overwrite all three secrets.`);
    const go = await promptChoice('Continue and replace the existing App credentials?', ['No — leave them alone', 'Yes — replace them']);
    if (go.startsWith('No')) { closePrompt(); return; }
  }

  const isOrgAnswer = await promptChoice(`Is "${d.owner}" an organization or a personal account?`, ['Personal account', 'Organization']);
  const appName = (await promptLine(`${c.cyan('?')} App name (must be globally unique) ${c.dim(`[nanobots-${d.owner.toLowerCase()}]`)} `)).trim()
    || `nanobots-${d.owner.toLowerCase()}`;

  console.log(`\n${c.dim('The App is created with contents:write + metadata:read and nothing else — notably')}`);
  console.log(`${c.dim('NOT pull_requests, so a sandbox can push a branch but can never open, change or merge a PR.')}\n`);

  let app;
  try {
    app = await createAppViaManifest({ owner: d.owner, repo: d.repo, isOrg: isOrgAnswer === 'Organization', appName });
  } catch (err) {
    closePrompt();
    die(`app creation failed: ${err.message}\nThe PAT fallback keeps working; re-run \`nanobots app create\` to try again.`);
  }
  say(`created ${app.htmlUrl} (id ${app.appId})`);

  const put = (name, value) => spawnSync('gh', ['secret', 'set', name, '--repo', nwo], { input: String(value) }).status === 0;
  // Store before installing: if the install step fails the credentials are not lost.
  if (!put('NANOBOTS_GITHUB_APP_ID', app.appId)) { closePrompt(); die('failed to store NANOBOTS_GITHUB_APP_ID'); }
  if (!put('NANOBOTS_GITHUB_APP_PRIVATE_KEY', app.pem)) { closePrompt(); die('failed to store NANOBOTS_GITHUB_APP_PRIVATE_KEY'); }
  say('app id + private key stored as repo secrets.');

  try {
    const installationId = await waitForInstallation(app);
    if (!put('NANOBOTS_GITHUB_APP_INSTALLATION_ID', installationId)) { closePrompt(); die('failed to store NANOBOTS_GITHUB_APP_INSTALLATION_ID'); }
    say(`installation ${installationId} stored.`);
    console.log(`\n${c.cyan('Done.')} Workers on ${nwo} now get a short-lived, repo-scoped token per run.`);
    console.log(`${c.dim('Reminder: contents:write is repository-wide, not ref-scoped — branch protection is what contains a stray push.')}\n`);
  } catch (err) {
    warn(`app created and stored, but the installation was not detected: ${err.message}`);
    warn(`Install it at https://github.com/apps/${app.slug}/installations/new, then set the id:`);
    warn(`  gh secret set NANOBOTS_GITHUB_APP_INSTALLATION_ID --repo ${nwo}`);
    warn('All three are required — a partial setup is treated as unconfigured and falls back to the PAT.');
  }
  closePrompt();
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
  case 'app':
    await cmdApp(args[args.indexOf('app') + 1], args[args.indexOf('app') + 2]);
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
  nanobots app create                              create + install the per-run credential GitHub App
  nanobots app install <slug>                      finish an interrupted app setup (stores the installation id)
  nanobots verify daytona                          connection + lifecycle proof before enabling the worker cron
  nanobots extension                               copy the browser extension here (+ load steps)
  nanobots version

Docs: https://github.com/TimHeckel/nanobots
`);
}
