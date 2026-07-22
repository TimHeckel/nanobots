#!/usr/bin/env node
// nanobots:engine-owned v0.2 — re-rendered by `nanobots update`
//
// Claims one approved Ready item and builds it inside a disposable Daytona sandbox.
// Called by `.nanobots/run-cycle.sh worker` — not meant to be invoked directly, though
// `node .nanobots/daytona-worker.mjs` works the same way if you want to run it by hand.
//
// Env:
//   GH_TOKEN          classic PAT, scopes project+repo, human account (same one the
//                      outer loop uses)
//   DAYTONA_API_KEY   controller-side only; never enters the sandbox
//   One model credential (see .nanobots/RUNTIMES.md "Swapping the brain")
//
// ASSUMPTIONS ON THE DAYTONA REST API: this script calls the endpoints documented at
// https://www.daytona.io/docs/en/typescript-sdk/ as of this template's authoring. Daytona's
// API surface can move faster than this file does. Run `npx nanobots-sh verify daytona`
// after wiring your key and before enabling the worker cron — if that proof fails on a
// request shape, the fix belongs in daytonaApi()/createSandbox()/execInSandbox() below,
// nowhere else in this file needs to change.
//
// See .nanobots/RUNTIMES.md "Security model" for what does and doesn't enter the sandbox,
// and why the sandbox — not a separate relay — holds the GitHub token for this one run.

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createSandbox as daytonaCreateSandbox, execInSandbox as daytonaExecInSandbox, deleteSandbox as daytonaDeleteSandbox, redact } from './daytona-client.mjs';

const c = {
  cyan: (s) => `\x1b[1;36m${s}\x1b[0m`,
  yellow: (s) => `\x1b[1;33m${s}\x1b[0m`,
};
const say = (m) => console.log(`${c.cyan('[daytona-worker]')} ${m}`);
const warn = (m) => console.log(`${c.yellow('[daytona-worker]')} ${m}`);
const die = (m) => { console.error(`${c.yellow('[daytona-worker]')} ${m}`); process.exit(1); };

function sh(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts }).trim();
}
function shTry(cmd, opts = {}) {
  try { return sh(cmd, opts); } catch { return null; }
}
function shJson(cmd) {
  return JSON.parse(sh(cmd));
}

// ── config & env ─────────────────────────────────────────────────────────────

if (!existsSync('.nanobots/config.json')) die('no .nanobots/config.json — run from the repo root');
const cfg = JSON.parse(readFileSync('.nanobots/config.json', 'utf8'));
const NWO = `${cfg.owner}/${cfg.repo}`;
const daytona = cfg.daytona ?? {};
const approvalRequired = cfg.approval?.requireVersionedStart !== false;

const DAYTONA_API_KEY = process.env.DAYTONA_API_KEY;
if (!DAYTONA_API_KEY) die('DAYTONA_API_KEY not set — see .nanobots/RUNTIMES.md');
if (!process.env.GH_TOKEN) die('GH_TOKEN not set — see .nanobots/RUNTIMES.md');
const MODEL_CREDS = ['CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN']
  .filter((k) => process.env[k]);
if (MODEL_CREDS.length === 0) die('need CLAUDE_CODE_OAUTH_TOKEN, ANTHROPIC_API_KEY, or ANTHROPIC_AUTH_TOKEN');
// Anthropic-compatible provider swap (see RUNTIMES.md "Swapping the brain") rides along
// with ANTHROPIC_AUTH_TOKEN if set — forward it into the sandbox too.
const MODEL_ENV = Object.fromEntries(
  [...MODEL_CREDS, 'ANTHROPIC_BASE_URL', 'ANTHROPIC_MODEL', 'ANTHROPIC_SMALL_FAST_MODEL']
    .filter((k) => process.env[k])
    .map((k) => [k, process.env[k]]),
);

const RUN_ID = randomUUID();

// ── GitHub board helpers (same conventions as .nanobots/RUNTIMES.md) ───────────

function findProject() {
  const list = shJson(`gh project list --owner ${cfg.owner} --format json --limit 100`);
  const project = list.projects?.find((p) => p.title === cfg.board);
  if (!project) die(`board "${cfg.board}" not found under ${cfg.owner} — run \`nanobots init\` first`);
  return project;
}

function findStatusField(project) {
  const fields = shJson(`gh project field-list ${project.number} --owner ${cfg.owner} --format json --limit 30`);
  const status = fields.fields.find((f) => f.name === 'Status');
  if (!status) die('Status field not found on the board');
  const options = Object.fromEntries((status.options ?? []).map((o) => [o.name, o.id]));
  return { id: status.id, options, projectId: project.id };
}

function countInProgress(projectNumber) {
  const items = shJson(`gh project item-list ${projectNumber} --owner ${cfg.owner} -L 200 --format json --query 'status:"In Progress"'`);
  return (items.items ?? []).length;
}

// Ready items, best candidate first (Priority then smallest Size — same order the outer
// loop dispatches in). gh's item-list JSON shape has moved across versions; if this
// throws, inspect `gh project item-list <n> --owner <o> --format json | jq` and adjust.
function listReadyCandidates(projectNumber) {
  const items = shJson(`gh project item-list ${projectNumber} --owner ${cfg.owner} -L 200 --format json --query 'status:"Ready"'`);
  const sizeRank = { S: 0, M: 1, L: 2, XL: 3 };
  const prioRank = { P0: 0, P1: 1, P2: 2, P3: 3 };
  return (items.items ?? [])
    .map((it) => ({
      itemId: it.id,
      number: it.content?.number,
      priority: it.priority ?? it.Priority ?? 'P3',
      size: it.size ?? it.Size ?? 'M',
    }))
    .filter((it) => it.number)
    .sort((a, b) => (prioRank[a.priority] ?? 9) - (prioRank[b.priority] ?? 9)
      || (sizeRank[a.size] ?? 9) - (sizeRank[b.size] ?? 9));
}

function issueLabels(number) {
  const issue = shJson(`gh issue view ${number} --repo ${NWO} --json labels`);
  return (issue.labels ?? []).map((l) => l.name);
}

// Plan-hash approval: LOOP-PROMPT.md posts a `Plan ready` comment ending with
// `<!-- nanobots:plan issue=N hash=<12-hex> -->`; a collaborator approves with
// `/nanobots start <hash>` in a later comment. Both must reference the SAME, latest hash.
function checkApproval(number) {
  if (!approvalRequired) return { approved: true };
  const comments = shJson(`gh issue view ${number} --repo ${NWO} --json comments --jq '.comments'`);
  let planHash = null;
  let planIndex = -1;
  comments.forEach((cmt, i) => {
    const m = cmt.body?.match(/<!--\s*nanobots:plan\s+issue=\d+\s+hash=([0-9a-f]{12})\s*-->/);
    if (m) { planHash = m[1]; planIndex = i; }
  });
  if (!planHash) return { approved: false, reason: 'no versioned plan posted yet' };
  for (let i = comments.length - 1; i > planIndex; i--) {
    const m = comments[i].body?.match(/\/nanobots start ([0-9a-f]{12})\b/);
    if (m && m[1] === planHash) {
      const login = comments[i].author?.login;
      const perm = shTry(`gh api repos/${NWO}/collaborators/${login}/permission --jq .permission`);
      if (perm && ['admin', 'write', 'maintain'].includes(perm)) {
        return { approved: true, approver: login, hash: planHash };
      }
    }
  }
  return { approved: false, reason: `no valid /nanobots start ${planHash} from a collaborator yet` };
}

function claim(number, projectNumber, statusField) {
  const item = shJson(`gh project item-list ${projectNumber} --owner ${cfg.owner} -L 200 --format json --query 'status:"Ready"'`)
    .items.find((it) => it.content?.number === number);
  if (!item) return false;
  const claimNote = `<!-- nanobots:run issue=${number} run=${RUN_ID} attempt=1 -->\n🤖 daytona-worker claimed this item (run \`${RUN_ID.slice(0, 8)}\`) — building in an isolated Daytona sandbox.`;
  sh(`gh issue comment ${number} --repo ${NWO} --body ${JSON.stringify(claimNote)}`);
  sh(`gh project item-edit --project-id ${statusField.projectId} --id ${item.id} --field-id ${statusField.id} --single-select-option-id ${statusField.options['In Progress']}`);
  // Re-read: confirm our claim comment is still the most recent run marker (single-flight, best effort).
  const latest = shJson(`gh issue view ${number} --repo ${NWO} --json comments --jq '.comments'`)
    .filter((cmt) => /nanobots:run issue=\d+ run=/.test(cmt.body ?? ''))
    .pop();
  const ourRun = latest?.body?.includes(RUN_ID);
  if (!ourRun) { warn(`lost the claim race on #${number} — backing off`); return false; }
  return true;
}

// ── Daytona sandbox lifecycle (shared helpers in daytona-client.mjs) ───────────

async function createSandbox(number) {
  const labels = { owner: cfg.owner, repo: cfg.repo, issue: String(number), run: RUN_ID };
  say(`creating sandbox for #${number} (snapshot=${daytona.snapshot || 'provider default'}, target=${daytona.target || 'us'})...`);
  return daytonaCreateSandbox(DAYTONA_API_KEY, {
    labels,
    snapshot: daytona.snapshot,
    target: daytona.target,
    autoDeleteInterval: daytona.autoDeleteMinutes ?? 60,
  });
}

async function execInSandbox(sandboxId, command, opts = {}) {
  return daytonaExecInSandbox(DAYTONA_API_KEY, sandboxId, command, opts);
}

async function deleteSandbox(sandboxId) {
  if (!sandboxId) return;
  const ok = await daytonaDeleteSandbox(DAYTONA_API_KEY, sandboxId, { onWarn: warn });
  if (ok) say(`sandbox ${sandboxId} deleted.`);
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const project = findProject();
  const statusField = findStatusField(project);

  const inProgress = countInProgress(project.number);
  if (inProgress >= (cfg.wipCap ?? 2)) {
    say(`WIP cap reached (${inProgress}/${cfg.wipCap}) — nothing to claim this run.`);
    return;
  }

  const candidates = listReadyCandidates(project.number);
  let target = null;
  for (const cand of candidates) {
    const labels = issueLabels(cand.number);
    if (labels.includes(cfg.humanLabel)) continue;
    const approval = checkApproval(cand.number);
    if (!approval.approved) {
      say(`#${cand.number} not claimable yet: ${approval.reason}`);
      continue;
    }
    target = { ...cand, approval };
    break;
  }
  if (!target) { say('no claimable Ready item this run.'); return; }

  say(`claiming #${target.number} (run ${RUN_ID})...`);
  if (!claim(target.number, project.number, statusField)) return;

  let sandboxId;
  try {
    sandboxId = await createSandbox(target.number);

    for (const step of daytona.databaseBootstrap ?? []) {
      say(`db bootstrap: ${step}`);
      const r = await execInSandbox(sandboxId, step, { timeout: 300 });
      if (r.exitCode !== 0) throw new Error(`database bootstrap step failed: ${step}`);
    }

    say('cloning repository into sandbox...');
    const cloneCmd = `git clone --branch ${cfg.defaultBranch} https://x-access-token:${process.env.GH_TOKEN}@github.com/${NWO}.git repo`;
    const clone = await execInSandbox(sandboxId, cloneCmd, { timeout: 300 });
    if (clone.exitCode !== 0) throw new Error('clone failed');

    say('running the worker prompt inside the sandbox...');
    const build = await execInSandbox(sandboxId, 'bash .nanobots/run-cycle.sh worker-inline', {
      cwd: 'repo',
      timeout: 60 * 45,
      env: { GH_TOKEN: process.env.GH_TOKEN, ...MODEL_ENV },
    });

    sh(`gh issue comment ${target.number} --repo ${NWO} --body ${JSON.stringify(
      `<!-- nanobots:run issue=${target.number} run=${RUN_ID} attempt=1 state=done -->\n`
      + `🤖 sandbox run finished (exit ${build.exitCode}). Tail:\n\n\`\`\`\n${redact(build.result).slice(-3000)}\n\`\`\``,
    )}`);
    if (build.exitCode !== 0) throw new Error(`worker exited ${build.exitCode} — see the issue comment for the sanitized tail`);
  } catch (err) {
    warn(`run ${RUN_ID} for #${target.number} failed: ${err.message}`);
    shTry(`gh issue comment ${target.number} --repo ${NWO} --body ${JSON.stringify(
      `<!-- nanobots:run issue=${target.number} run=${RUN_ID} attempt=1 state=failed -->\n🤖 sandbox run failed: ${redact(err.message)}`,
    )}`);
  } finally {
    await deleteSandbox(sandboxId);
  }
}

await main();
