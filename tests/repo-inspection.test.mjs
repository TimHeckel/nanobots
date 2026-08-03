// Drives the REAL list_files / read_file tools inside `nanobots init`.
//
// WHY not a mirror: the dry-run path stubs every tool, so a dry-run e2e proves the agent asked
// for a file and proves nothing about what it got back. That exact gap has bitten this repo
// three times. So this spins up a fake OpenAI-compatible endpoint, runs the actual CLI against
// a real throwaway git repo, and scripts tool calls. The tool RESULTS come back to the fake
// server as `tool` messages — which means the server observes the genuine implementation's
// output, and that is what these assertions read.
//
// Nothing here touches GitHub: the script only ever calls list_files, read_file and finish.

import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'cli.mjs');
let passed = 0;
const fails = [];
const ok = (c, l) => { if (c) passed++; else fails.push(l); };

// ── a real repo to interrogate ───────────────────────────────────────────────
const root = mkdtempSync(join(tmpdir(), 'nanobots-inspect-'));
const git = (...a) => execFileSync('git', a, { cwd: root, stdio: 'pipe' });

mkdirSync(join(root, 'src', 'billing'), { recursive: true });
writeFileSync(join(root, 'package.json'), '{ "name": "demo", "version": "1.0.0" }\n');
writeFileSync(join(root, 'src', 'billing', 'stripe.ts'), 'export const charge = () => {};\n');
writeFileSync(join(root, 'big.txt'), 'x'.repeat(20000));
writeFileSync(join(root, '.env.local'), 'STRIPE_SECRET_KEY=sk_live_THIS_MUST_NEVER_REACH_THE_MODEL\n');
writeFileSync(join(root, 'deploy.pem'), '-----BEGIN PRIVATE KEY-----\nNEVER_LEAK_ME\n');

git('init', '-q', '-b', 'main');
git('config', 'user.email', 'test@example.com');
git('config', 'user.name', 'Test');
git('remote', 'add', 'origin', 'https://github.com/acme/demo.git');
git('add', '-A', '-f');
git('commit', '-qm', 'init');

// ── the script the fake model runs ───────────────────────────────────────────
const call = (name, args) => ({ tool_calls: [{ id: `c${Math.round(performance.now())}${name}`, type: 'function', function: { name, arguments: JSON.stringify(args) } }] });
const SCRIPT = [
  call('list_files', {}),
  call('read_file', { path: 'package.json' }),
  call('read_file', { path: 'src/billing/stripe.ts' }),
  call('read_file', { path: '.env.local' }),          // credential file
  call('read_file', { path: 'deploy.pem' }),          // credential file
  call('read_file', { path: '../../../etc/passwd' }), // traversal
  call('read_file', { path: 'nope.txt' }),            // missing
  call('read_file', { path: 'big.txt' }),             // truncation
  call('finish', { summary: 'inspection test done' }),
];

let turn = 0;
let lastMessages = [];
const server = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    try { lastMessages = JSON.parse(body).messages || []; } catch { /* ignore */ }
    const msg = SCRIPT[Math.min(turn++, SCRIPT.length - 1)];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: null, ...msg } }] }));
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/chat/completions`;

// ── run the real CLI ─────────────────────────────────────────────────────────
// MUST be async: the fake server lives in this process's event loop, so a synchronous spawn
// would block it and deadlock waiting for a reply it can never send.
let out = '';
const code = await new Promise((done) => {
  const child = spawn(process.execPath, [CLI, 'init'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, OCR_LLM_URL: url, OCR_LLM_TOKEN: 'fake', OCR_LLM_MODEL: 'fake-model', NANOBOTS_INIT_DRY_RUN: '' },
  });
  const kill = setTimeout(() => { child.kill('SIGKILL'); fails.push('CLI did not exit within 30s'); }, 30000);
  child.stdout.on('data', (c) => { out += c; });
  child.stderr.on('data', (c) => { out += c; });
  child.on('close', (c) => { clearTimeout(kill); done(c); });
});
server.close();
if (code !== 0) fails.push(`CLI exited ${code}: ${out.slice(-400)}`);

// The tool results the agent actually received, in order.
const results = lastMessages.filter((m) => m.role === 'tool').map((m) => String(m.content));
const [files, pkg, ts, envFile, pem, traversal, missing, big] = results;

ok(results.length === 8, `all 8 inspection tools ran (got ${results.length})`);

// list_files
ok(/^5 tracked files:/.test(files || ''), 'list_files reports the tracked-file count');
ok((files || '').includes('src/billing/stripe.ts'), 'list_files returns nested paths');
ok((files || '').includes('package.json'), 'list_files returns root files');
ok(!(files || '').includes('.git/'), 'list_files does not walk into .git');

// read_file — the happy path
ok((pkg || '').includes('"name": "demo"'), 'read_file returns real file contents');
ok((ts || '').includes('export const charge'), 'read_file reads nested paths');

// read_file — credentials never enter the model's context
ok(/^refused:/.test(envFile || ''), '.env.local is refused, not read');
ok(!(envFile || '').includes('sk_live_'), 'no .env value reaches the model');
ok(/^refused:/.test(pem || ''), '.pem is refused, not read');
ok(!(pem || '').includes('NEVER_LEAK_ME'), 'no private-key material reaches the model');
ok(!JSON.stringify(lastMessages).includes('sk_live_THIS_MUST_NEVER_REACH_THE_MODEL'),
  'the secret appears NOWHERE in the whole conversation sent to the model');

// read_file — the guards
ok(/outside the repository/.test(traversal || ''), 'path traversal is rejected');
ok(!(traversal || '').includes('root:'), '/etc/passwd contents never returned');
ok(/not found/.test(missing || ''), 'a missing file returns a clear error');
ok(/truncated — 20000 chars total/.test(big || ''), 'large files are truncated with a note');
ok((big || '').length < 13000, `truncation actually bounds the payload (${(big || '').length} chars)`);

// The agent must not have been handed a prefilled hard-gate list to rubber-stamp.
const system = String((lastMessages[0] || {}).content || '');
ok(!/hard-gate areas never auto-worked, comma-separated \[/.test(system),
  'step A no longer offers a canned hard-gate default');
ok(/A2\. HARD GATES/.test(system), 'the prompt has a dedicated hard-gates step');
ok(/list_files/.test(system) && /read_file/.test(system),
  'the hard-gates step tells the agent to read the repo first');

rmSync(root, { recursive: true, force: true });

if (fails.length) {
  console.error(`\n${fails.length} FAILED:`);
  for (const f of fails) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`ok — ${passed} repo-inspection tests passed`);
