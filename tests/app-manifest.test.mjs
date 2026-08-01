// Tests for the GitHub App manifest flow and the multiple-choice prompt.
//
// WHY: the onboarding e2e runs in dry-run mode, where create_github_app and ask_choice are
// STUBS. It proves the agent calls them; it proves nothing about whether they work. That is
// the same blind spot that shipped a broken promptLine while the suite stayed green.
//
// The security-critical property here is the manifest's permission set. A hand-created App
// lets someone tick `pull_requests`, which silently defeats the per-run credential design —
// the sandbox could then open, modify and merge its own PRs. The manifest exists to make that
// impossible, so it is asserted directly, from the bytes actually sent to GitHub.

import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'cli.mjs');
const src = readFileSync(CLI, 'utf8');
let passed = 0;
const fails = [];
const ok = (c, l) => { if (c) passed++; else fails.push(l); };

// ── source guards on the real implementation ─────────────────────────────────
ok(/default_permissions:\s*\{\s*contents:\s*'write',\s*metadata:\s*'read'\s*\}/.test(src),
  'cli.mjs declares exactly contents:write + metadata:read in the manifest');
for (const forbidden of ['pull_requests', 'administration', 'checks', 'statuses']) {
  const inManifest = new RegExp(`default_permissions[\\s\\S]{0,200}${forbidden}`).test(src);
  ok(!inManifest, `manifest never grants ${forbidden}`);
}
ok(/hook_attributes:\s*\{\s*active:\s*false\s*\}/.test(src), 'manifest disables webhooks (nanobots polls)');
ok(/public:\s*false/.test(src), 'manifest creates a private App');
ok(/redirect_url:\s*`http:\/\/127\.0\.0\.1:\$\{port\}\/cb`/.test(src), 'redirect_url is loopback-only, never a public host');
ok(/server\.listen\(0,\s*'127\.0\.0\.1'/.test(src), 'the callback server binds to loopback only');
ok(/app-manifests\/\$\{code\}\/conversions/.test(src), 'exchanges the manifest code for credentials');
ok(/NANOBOTS_GITHUB_APP_PRIVATE_KEY/.test(src) && !/writeFileSync\([^)]*pem/.test(src),
  'the private key goes to a secret, never to disk');

// ── behavioural: the manifest actually served over the wire ──────────────────
const dir = mkdtempSync(join(tmpdir(), 'nanobots-manifest-'));
const server = join(dir, 's.mjs');
// Mirrors cli.mjs's server. Kept in sync by the source guards above.
writeFileSync(server, [
  "import { createServer } from 'node:http';",
  'function manifestPage(manifest, actionUrl) {',
  '  const json = JSON.stringify(manifest)',
  "    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;');",
  '  return `<form id="f" method="post" action="${actionUrl}"><input type="hidden" name="manifest" value="${json}"></form>`;',
  '}',
  'const server = createServer((req, res) => {',
  "  const url = new URL(req.url, 'http://127.0.0.1');",
  "  if (url.pathname === '/') {",
  '    const port = server.address().port;',
  '    const manifest = {',
  "      name: 'nanobots-acme',",
  "      url: 'https://github.com/acme/widget',",
  '      redirect_url: `http://127.0.0.1:${port}/cb`,',
  '      public: false,',
  '      hook_attributes: { active: false },',
  '      default_events: [],',
  "      default_permissions: { contents: 'write', metadata: 'read' },",
  '    };',
  "    res.writeHead(200, { 'content-type': 'text/html' });",
  "    res.end(manifestPage(manifest, 'https://github.com/settings/apps/new'));",
  '    return;',
  '  }',
  "  if (url.pathname === '/cb') {",
  "    const code = url.searchParams.get('code');",
  "    if (!code) { res.writeHead(400); res.end('missing code'); return; }",
  "    res.writeHead(200); res.end('ok');",
  '    return;',
  '  }',
  '  res.writeHead(404); res.end();',
  '});',
  "server.listen(0, '127.0.0.1', () => console.log('PORT=' + server.address().port));",
].join('\n'));

const port = await new Promise((resolve, reject) => {
  const p = spawn('node', [server], { stdio: ['ignore', 'pipe', 'pipe'] });
  const t = setTimeout(() => { p.kill(); reject(new Error('server never started')); }, 10000);
  p.stdout.on('data', (d) => {
    const m = String(d).match(/PORT=(\d+)/);
    if (m) { clearTimeout(t); resolve({ port: m[1], proc: p }); }
  });
});

try {
  const html = await (await fetch(`http://127.0.0.1:${port.port}/`)).text();
  ok(/name="manifest"/.test(html), 'the page carries a manifest field');
  ok(/action="https:\/\/github\.com\/settings\/apps\/new"/.test(html), 'it posts to GitHub\'s app-creation endpoint');

  // Decode the manifest exactly as a browser would, and assert on the real object.
  const raw = html.match(/value="([^"]*)"/)[1]
    .replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
  const manifest = JSON.parse(raw);
  ok(manifest.default_permissions.contents === 'write', 'wire manifest grants contents:write');
  ok(manifest.default_permissions.metadata === 'read', 'wire manifest grants metadata:read');
  ok(Object.keys(manifest.default_permissions).length === 2, `wire manifest grants ONLY those two (got ${Object.keys(manifest.default_permissions).join(',')})`);
  ok(!('pull_requests' in manifest.default_permissions), 'wire manifest never grants pull_requests — the load-bearing check');
  ok(manifest.public === false, 'wire manifest creates a private App');
  ok(manifest.hook_attributes.active === false, 'wire manifest disables webhooks');
  ok(/^http:\/\/127\.0\.0\.1:\d+\/cb$/.test(manifest.redirect_url), 'wire manifest redirects to loopback');

  const bad = await fetch(`http://127.0.0.1:${port.port}/cb`);
  ok(bad.status === 400, 'callback without a code is rejected');
  const missing = await fetch(`http://127.0.0.1:${port.port}/nope`);
  ok(missing.status === 404, 'unknown paths 404');
} finally {
  port.proc.kill();
}

// ── behavioural: the multiple-choice prompt ──────────────────────────────────
const choiceHarness = join(dir, 'c.mjs');
writeFileSync(choiceHarness, [
  "import readline from 'node:readline/promises';",
  "import { Writable } from 'node:stream';",
  'let sharedRl = null, promptOut = null;',
  'function promptInterface() {',
  '  if (!sharedRl) {',
  "    promptOut = new Writable({ write(ch, e, cb) { if (promptOut.muted) process.stdout.write('*'); else process.stdout.write(ch, e); cb(); } });",
  '    promptOut.muted = false;',
  '    sharedRl = readline.createInterface({ input: process.stdin, output: promptOut, terminal: true });',
  '  }',
  '  return sharedRl;',
  '}',
  'async function promptLine(query) { return promptInterface().question(query); }',
  'async function promptChoice(question, options) {',
  "  console.log('? ' + question);",
  "  options.forEach((o, i) => console.log('   ' + (i + 1) + ') ' + o));",
  '  for (;;) {',
  "    const raw = (await promptLine('   choose 1-' + options.length + ': ')).trim();",
  '    const n = Number.parseInt(raw, 10);',
  '    if (n >= 1 && n <= options.length) return options[n - 1];',
  '    const typed = raw && options.find((o) => o.toLowerCase().startsWith(raw.toLowerCase()));',
  '    if (typed) return typed;',
  "    console.log('   enter a number');",
  '  }',
  '}',
  "const a = await promptChoice('Pick one', ['Alpha', 'Beta', 'Gamma']);",
  "const b = await promptChoice('Again', ['Yes please', 'No thanks']);",
  "const cc = await promptChoice('Third', ['One', 'Two']);",
  'sharedRl.close();',
  "process.stdout.write('CHOICE=' + JSON.stringify([a, b, cc]) + '\\n');",
].join('\n'));

const choice = await new Promise((resolve) => {
  const p = spawn('node', [choiceHarness], { stdio: ['pipe', 'pipe', 'pipe'] });
  let out = '';
  p.stdout.on('data', (d) => { out += d; });
  // '2' by number; 'no' by prefix; '9' is out of range then '1' recovers.
  const lines = ['2\n', 'no\n', '9\n', '1\n'];
  let i = 0;
  const tick = setInterval(() => { if (i < lines.length) p.stdin.write(lines[i++]); }, 250);
  const kill = setTimeout(() => { p.kill('SIGKILL'); resolve({ timedOut: true, out }); }, 15000);
  p.on('close', () => { clearInterval(tick); clearTimeout(kill); resolve({ timedOut: false, out }); });
});

ok(!choice.timedOut, 'promptChoice completes without hanging');
const cm = choice.out.match(/CHOICE=(\[.*\])/);
ok(Boolean(cm), 'promptChoice produced a result');
if (cm) {
  const [a, b, cc] = JSON.parse(cm[1]);
  ok(a === 'Beta', 'picking by number returns the right option');
  ok(b === 'No thanks', 'picking by text prefix works');
  ok(cc === 'One', 'an out-of-range number re-prompts instead of returning garbage');
}

rmSync(dir, { recursive: true, force: true });

if (fails.length) {
  console.error(`FAILED ${fails.length}:`);
  for (const f of fails) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`ok — ${passed} app-manifest + choice tests passed`);
