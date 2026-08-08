// E2E harness for the onboarding agent — the ONLY install path, and the one thing plain
// unit tests can't reach because it needs a live tool-calling model.
//
// Runs the REAL agent loop against a REAL OpenAI-compatible endpoint with every side effect
// stubbed (NANOBOTS_INIT_DRY_RUN=1): nothing written, no `gh` invoked, no secrets set, no
// sandbox created. Asserts on the transcript of tool calls the agent actually made.
//
//   OCR_LLM_URL=... OCR_LLM_TOKEN=... OCR_LLM_MODEL=... node tests/init-agent.e2e.mjs
//
// Skips (exit 0) when the endpoint isn't configured, so it's safe in a credential-less CI.
// This is deliberately NOT part of `npm test` — it costs a model call.

import { spawnSync, execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'cli.mjs');

if (!process.env.OCR_LLM_URL || !process.env.OCR_LLM_TOKEN || !process.env.OCR_LLM_MODEL) {
  console.log('skip — OCR_LLM_URL/_TOKEN/_MODEL not set (no endpoint to exercise the agent against)');
  process.exit(0);
}

let passed = 0;
const fails = [];
const ok = (cond, label) => { if (cond) passed++; else fails.push(label); };

// A scratch git repo with a GitHub origin: enough for detect(), and disposable.
const dir = mkdtempSync(join(tmpdir(), 'nanobots-e2e-'));
execSync('git init -q .', { cwd: dir });
execSync('git remote add origin https://github.com/acme/widget.git', { cwd: dir });

const out = join(dir, 'transcript.json');
const res = spawnSync('node', [CLI, 'init'], {
  cwd: dir,
  encoding: 'utf8',
  timeout: 5 * 60 * 1000,
  env: {
    ...process.env,
    NANOBOTS_INIT_DRY_RUN: '1',
    NANOBOTS_INIT_DRY_RUN_OUT: out,
  },
});

if (!existsSync(out)) {
  console.error('FAILED — the agent never produced a transcript. stdout/stderr follow:\n');
  console.error((res.stdout || '').slice(-3000));
  console.error((res.stderr || '').slice(-2000));
  rmSync(dir, { recursive: true, force: true });
  process.exit(1);
}

const { finished, calls } = JSON.parse(readFileSync(out, 'utf8'));
const byTool = (name) => calls.filter((c) => c.tool === name);
const names = (tool, key = 'name') => new Set(byTool(tool).map((c) => c[key]));

// ── the agent drove the setup to completion ──────────────────────────────────
ok(res.status === 0, `init exited cleanly (got ${res.status})`);
ok(typeof finished === 'string' && finished.length > 0, 'agent called finish() with a summary');
ok(calls.length >= 5, `agent made a real sequence of tool calls (got ${calls.length})`);

// ── it talked to the user, and only through its tools ────────────────────────
// WHICH tool carries the prose is nondeterministic: across runs the model has used
// message_user, and has folded the same explanation into the ask_user/ask_choice question
// text instead. The user cannot tell the difference. Asserting message_user specifically
// held CI red for many cycles (see LEARNINGS cycles 35/40/55) over nothing a user would ever
// notice, so assert the OUTCOME — that the user was told things, and specifically that the
// one step no tool can perform for them got through.
const userFacing = [
  ...byTool('message_user').map((c) => c.text || ''),
  ...byTool('ask_user').map((c) => c.question || ''),
  ...byTool('ask_choice').map((c) => c.question || ''),
  finished,
].join('\n');
ok(userFacing.trim().length > 200, 'agent conveyed substantive user-facing prose through its tools');
// Step H: enabling "Auto-add to project" is the one thing the GitHub API cannot do, so if the
// agent never says it, the install is quietly incomplete no matter how clean the run looks.
// Matches "Auto-add" ONLY. A looser /workflows/ pattern false-matched the unrelated
// "install the scheduled cron workflows?" question, which would let a genuinely missing
// step H pass — the agent does drop it roughly one run in six without the prompt insisting.
ok(/auto-?add/i.test(userFacing),
  'the manual board step reached the user (no tool can do it for them)');
ok(byTool('ask_user').length > 0, 'agent collected input via ask_user');
ok(byTool('ask_user').some((c) => c.secret === true), 'agent marked at least one prompt as secret (masked input)');
// The model's secret flag is nondeterministic — observed set and unset for the same prompt
// across runs. What must hold is that every credential prompt was ACTUALLY masked, which the
// CLI enforces on the question text rather than trusting the flag.
const unmasked = byTool('ask_user').filter((c) => /\b(token|key|pem|secret|password|pat|credential)\b/i.test(c.question || '') && !c.masked);
ok(unmasked.length === 0, `every credential prompt was actually masked (${unmasked.length} unmasked: ${unmasked.map((c) => (c.question || '').slice(0, 40)).join(' | ')})`);

// ── it rendered a sane scaffold ──────────────────────────────────────────────
const scaffold = byTool('render_scaffold')[0];
ok(scaffold, 'agent called render_scaffold');
if (scaffold) {
  ok(typeof scaffold.board === 'string' && scaffold.board.length > 0, 'scaffold has a board name');
  ok(Number.isInteger(Number(scaffold.wipCap)) && Number(scaffold.wipCap) > 0, `scaffold has a positive WIP cap (got ${scaffold.wipCap})`);
  // NOT "length > 0". The A2 step tells the agent to propose gates and then accept the user's
  // edits, including "none" — an empty list is a legitimate answer for a small repo, and the
  // dry run's scripted user answers vaguely, so it lands there sometimes. What must hold is
  // that the agent READ THE REPO before deciding, and did so before rendering: a list arrived
  // at without looking is the canned default this step exists to eliminate.
  ok(Array.isArray(scaffold.hardGates), 'scaffold carries a hard-gate list (empty is allowed)');
  const firstLook = calls.findIndex((c) => c.tool === 'list_files' || c.tool === 'read_file');
  const rendered = calls.findIndex((c) => c.tool === 'render_scaffold');
  ok(firstLook !== -1, 'agent inspected the repo rather than guessing at hard gates');
  ok(firstLook !== -1 && firstLook < rendered, 'it inspected BEFORE rendering the scaffold');
  ok(byTool('read_file').length >= 2, `agent opened real files, not just the tree (${byTool('read_file').length})`);
}

// ── it set up GitHub state ───────────────────────────────────────────────────
ok(byTool('check_gh').length > 0, 'agent checked gh auth before scaffolding GitHub');
ok(byTool('scaffold_github').length > 0, 'agent scaffolded the board/labels/status issue');

// ── it collected the credentials the loop actually requires ──────────────────
const secrets = names('set_secret');
const vars = names('set_variable');
const model = [...secrets].some((n) => /CLAUDE_CODE_OAUTH_TOKEN|ANTHROPIC_API_KEY/.test(n));
ok(model, `agent set a model credential (saw: ${[...secrets].join(', ') || 'none'})`);
ok(secrets.has('PROJECTS_PAT'), 'agent set PROJECTS_PAT');
ok(secrets.has('DAYTONA_API_KEY'), 'agent set DAYTONA_API_KEY');
ok(secrets.has('OCR_LLM_TOKEN'), 'agent set OCR_LLM_TOKEN');
ok(vars.has('OCR_LLM_URL') && vars.has('OCR_LLM_MODEL'), 'agent set the OCR endpoint variables');

// Daytona must be PROVEN before its key is stored — that ordering is the whole point.
const daytonaVerifyAt = calls.findIndex((c) => c.tool === 'verify_daytona');
const daytonaSecretAt = calls.findIndex((c) => c.tool === 'set_secret' && c.name === 'DAYTONA_API_KEY');
ok(daytonaVerifyAt !== -1, 'agent ran verify_daytona');
ok(daytonaVerifyAt !== -1 && daytonaSecretAt !== -1 && daytonaVerifyAt < daytonaSecretAt,
  'agent verified Daytona BEFORE storing the key');

// ── no secret value ever entered the transcript ──────────────────────────────
const blob = JSON.stringify(calls);
ok(!blob.includes('DRYRUN-NOT-A-REAL-CREDENTIAL'), 'no credential value leaked into the transcript');
ok(byTool('set_secret').every((c) => !('value' in c)), 'set_secret records the name only, never the value');

// ── zero side effects ────────────────────────────────────────────────────────
ok(!existsSync(join(dir, '.nanobots')), 'dry run wrote no .nanobots/ directory');
ok(!existsSync(join(dir, '.github')), 'dry run wrote no .github/ directory');
ok(readdirSync(dir).filter((f) => f !== '.git' && f !== 'transcript.json').length === 0,
  'dry run left the target repo untouched');

rmSync(dir, { recursive: true, force: true });

if (fails.length) {
  console.error(`FAILED ${fails.length} of ${passed + fails.length}:`);
  for (const f of fails) console.error(`  ✗ ${f}`);
  console.error(`\ntranscript had ${calls.length} calls: ${calls.map((c) => c.tool).join(' → ')}`);
  process.exit(1);
}
console.log(`ok — ${passed} onboarding-agent e2e assertions passed (${calls.length} tool calls, model: ${process.env.OCR_LLM_MODEL})`);
