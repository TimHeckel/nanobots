#!/usr/bin/env node
// nanobots — self-improving agent loops for any GitHub repo.
// Zero-dependency scaffolder: after `init`, the target repo is self-contained.

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline/promises';

const VERSION = '0.1.0';
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

  // Existing @claude workflow?
  let hasClaudeWorkflow = false;
  const wfDir = join(root, '.github', 'workflows');
  if (existsSync(wfDir)) {
    for (const f of readdirSync(wfDir)) {
      if (!/\.ya?ml$/.test(f)) continue;
      const body = readFileSync(join(wfDir, f), 'utf8');
      if (body.includes('claude-code-action') && body.includes('issue_comment')) {
        hasClaudeWorkflow = true;
        break;
      }
    }
  }

  return { root, owner, repo, defaultBranch, gates, hasClaudeWorkflow };
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
    GATES_INLINE: cfg.gates.map((g) => `\`${g}\``).join(', ') || '(none configured)',
    GATES_LIST: cfg.gates.map((g) => `   - \`${g}\``).join('\n') || '   - (no gates configured — add some to .nanobots/config.json)',
    HARD_GATES_LIST: cfg.hardGates.map((g) => `  - ${g}`).join('\n') || '  - (none configured)',
    INSTALL_DATE: new Date().toISOString().slice(0, 10),
  };
}

// Engine-owned files: re-rendered by `update`. Repo-owned: rendered once, never touched again.
const ENGINE_OWNED = [
  { src: 'nanobots/LOOP-PROMPT.md', dest: '.nanobots/LOOP-PROMPT.md' },
  { src: 'nanobots/WORKER-PROMPT.md', dest: '.nanobots/WORKER-PROMPT.md' },
  { src: 'nanobots/RUNTIMES.md', dest: '.nanobots/RUNTIMES.md' },
  { src: 'nanobots/run-cycle.sh', dest: '.nanobots/run-cycle.sh', exec: true },
  { src: 'github/ISSUE_TEMPLATE/feature-request.yml', dest: '.github/ISSUE_TEMPLATE/feature-request.yml' },
  { src: 'github/ISSUE_TEMPLATE/bug-report.yml', dest: '.github/ISSUE_TEMPLATE/bug-report.yml' },
  { src: 'github/ISSUE_TEMPLATE/chore-tech-debt.yml', dest: '.github/ISSUE_TEMPLATE/chore-tech-debt.yml' },
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
    die("gh token missing the 'project' scope. Run: gh auth refresh -s project");
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

async function cmdInit(flags) {
  const d = detect();
  if (!d.owner) die('could not parse owner/repo from the origin remote');

  const defaults = {
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
    outerWorkflow: true,
  };

  let answers = { ...defaults };
  if (!flags.yes) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = async (q, dflt) => (await rl.question(`${q} ${c.dim(`[${dflt}]`)} `)).trim() || dflt;
    console.log(`\n${c.cyan('nanobots init')} — ${d.owner}/${d.repo} (${d.defaultBranch})\n`);
    answers.board = await ask('Board name?', defaults.board);
    answers.humanLabel = await ask('Human-gate label?', defaults.humanLabel);
    answers.wipCap = parseInt(await ask('Max items in progress at once (WIP cap)?', String(defaults.wipCap)), 10) || 2;
    answers.gates = (await ask('Gate commands, comma-separated?', defaults.gates.join(', ') || 'none detected'))
      .split(',').map((s) => s.trim()).filter((s) => s && s !== 'none detected');
    answers.hardGates = (await ask('Hard-gate areas (never auto-worked), comma-separated?', defaults.hardGates.join(', ')))
      .split(',').map((s) => s.trim()).filter(Boolean);
    answers.outerWorkflow = /^y/i.test(await ask('Install the scheduled outer-loop Action?', 'Y/n') || 'y');
    rl.close();
  }

  const cfg = {
    version: VERSION,
    owner: d.owner,
    repo: d.repo,
    defaultBranch: d.defaultBranch,
    board: answers.board,
    humanLabel: answers.humanLabel,
    wipCap: answers.wipCap,
    gates: answers.gates,
    hardGates: answers.hardGates,
    innerWorkflowManaged: !d.hasClaudeWorkflow,
    outerWorkflowEnabled: answers.outerWorkflow,
  };
  const values = templateValues(cfg);

  // Render
  for (const entry of ENGINE_OWNED) writeRendered(d.root, entry, values, { overwrite: true });
  for (const entry of REPO_OWNED) writeRendered(d.root, entry, values, { overwrite: false });
  if (cfg.outerWorkflowEnabled) {
    writeRendered(d.root, { src: 'github/workflows/nanobots-outer.yml', dest: '.github/workflows/nanobots-outer.yml' }, values, { overwrite: true });
  }
  if (cfg.innerWorkflowManaged) {
    writeRendered(d.root, { src: 'github/workflows/nanobots-inner.yml', dest: '.github/workflows/nanobots-inner.yml' }, values, { overwrite: true });
  } else {
    say('existing @claude workflow detected — not installing nanobots-inner.yml.');
  }

  const cfgPath = join(d.root, '.nanobots', 'config.json');
  if (!existsSync(cfgPath)) {
    writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
    say('wrote .nanobots/config.json');
  }

  // GitHub state
  let coords = null;
  if (!flags.noGithub) {
    coords = scaffoldGitHub(cfg);
  } else {
    say('--no-github: skipped board/label scaffolding.');
  }

  // Optional model-assisted suggestions (the ONLY step that uses a model, and it's opt-in)
  if (flags.smart) {
    if (shTry('command -v claude')) {
      say('running --smart repo analysis with the claude CLI (this may take a minute)...');
      const prompt = 'Study this repository (conventions, test setup, risk areas). Write .nanobots/SUGGESTIONS.md proposing: repo-specific additions to .nanobots/TRIAGE.md hard gates, repo-specific recipes for .nanobots/RECIPES.md, and any gate commands missing from .nanobots/config.json. Suggestions only — do not modify other files.';
      spawnSync('claude', ['-p', prompt, '--permission-mode', 'acceptEdits'], { cwd: d.root, stdio: 'inherit' });
    } else {
      warn('--smart requested but no `claude` CLI on PATH — skipped.');
    }
  }

  // Checklist
  console.log(`\n${c.cyan('Done.')} Remaining manual steps:\n`);
  console.log(`  1. Project → Workflows (GitHub UI): enable "Auto-add to project" with filter:`);
  console.log(`       is:issue is:open label:nanobots:inbox   (repo: ${cfg.owner}/${cfg.repo})`);
  console.log(`     set "Item added to project" → Status: Inbox; verify "Issue closed"/"PR merged" → Done.`);
  console.log(`  2. Secrets for Actions mode (skip if only running locally):`);
  console.log(`       CLAUDE_CODE_OAUTH_TOKEN  (claude setup-token)`);
  console.log(`       PROJECTS_PAT             (CLASSIC PAT: project + repo scopes, human account)`);
  console.log(`       gh variable set NANOBOTS_OUTER_ENABLED --body 1 --repo ${cfg.owner}/${cfg.repo}`);
  if (cfg.innerWorkflowManaged) {
    console.log(`  3. Install the Claude GitHub App if missing: run \`/install-github-app\` in claude.`);
  }
  if (coords) console.log(`\n  Board: https://github.com/orgs/${cfg.owner}/projects/${coords.projectNumber} (user account: check your projects tab)`);
  console.log(`\nStart the loop:  /loop in Claude Code with .nanobots/LOOP-PROMPT.md`);
  console.log(`             or:  npx nanobots-sh run outer\n`);
}

function cmdUpdate() {
  const d = detect();
  const cfgPath = join(d.root, '.nanobots', 'config.json');
  if (!existsSync(cfgPath)) die('no .nanobots/config.json — run `nanobots init` first');
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
  const values = templateValues(cfg);
  for (const entry of ENGINE_OWNED) writeRendered(d.root, entry, values, { overwrite: true });
  if (cfg.outerWorkflowEnabled) {
    writeRendered(d.root, { src: 'github/workflows/nanobots-outer.yml', dest: '.github/workflows/nanobots-outer.yml' }, values, { overwrite: true });
  }
  if (cfg.innerWorkflowManaged) {
    writeRendered(d.root, { src: 'github/workflows/nanobots-inner.yml', dest: '.github/workflows/nanobots-inner.yml' }, values, { overwrite: true });
  }
  say('engine-owned files re-rendered. Repo-owned files (TRIAGE, RECIPES, LEARNINGS, config) untouched.');
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
  yes: args.includes('--yes') || args.includes('-y'),
  smart: args.includes('--smart'),
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
  case 'version':
    console.log(VERSION);
    break;
  default:
    console.log(`
${c.cyan('nanobots')} v${VERSION} — self-improving agent loops for any GitHub repo

  nanobots init [--smart] [--no-github] [--yes]   scaffold this repo
  nanobots update                                  re-render engine-owned files
  nanobots run <outer|worker>                      one headless cycle
  nanobots version

Docs: https://github.com/TimHeckel/nanobots
`);
}
