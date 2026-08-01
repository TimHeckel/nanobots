// Validates the manifest THE CLI ACTUALLY SERVES, by running `nanobots app create` for real
// and fetching the page it starts.
//
// WHY THIS EXISTS SEPARATELY: tests/app-manifest.test.mjs asserts against a hand-written
// mirror of the server. That mirror passed while the real manifest was rejected by GitHub with
// `"url" wasn't supplied` — the schema requires hook_attributes.url whenever hook_attributes
// is present, and the mirror had copied the same omission. A mirror validates the author's
// intent, not the real artifact. This drives the actual command.

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'cli.mjs');
let passed = 0;
const fails = [];
const ok = (c, l) => { if (c) passed++; else fails.push(l); };

// A scratch repo so detect() resolves without touching the real one.
const dir = mkdtempSync(join(tmpdir(), 'nanobots-appmanifest-'));
execSync('git init -q .', { cwd: dir });
execSync('git remote add origin https://github.com/acme/widget.git', { cwd: dir });

const result = await new Promise((resolve) => {
  const p = spawn('node', [CLI, 'app', 'create'], {
    cwd: dir,
    env: { ...process.env, NANOBOTS_NO_BROWSER: '1' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let out = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { out += d; });

  // Answers: "Personal account" (option 1), then accept the default app name.
  const lines = ['1\n', '\n'];
  let i = 0;
  const tick = setInterval(() => { if (i < lines.length) p.stdin.write(lines[i++]); }, 400);

  // Poll stdout for the local URL the command prints, then fetch it.
  const watch = setInterval(async () => {
    const m = out.match(/http:\/\/127\.0\.0\.1:(\d+)\//);
    if (!m) return;
    clearInterval(watch); clearInterval(tick);
    try {
      const html = await (await fetch(m[0])).text();
      p.kill('SIGKILL');
      resolve({ html });
    } catch (err) {
      p.kill('SIGKILL');
      resolve({ error: err.message, out });
    }
  }, 300);

  setTimeout(() => { clearInterval(tick); clearInterval(watch); p.kill('SIGKILL'); resolve({ error: 'timed out', out }); }, 25000);
});

rmSync(dir, { recursive: true, force: true });

ok(!result.error, `the command served its manifest page (${result.error ?? 'ok'})`);
if (result.html) {
  const raw = result.html.match(/name="manifest" value="([^"]*)"/)?.[1];
  ok(Boolean(raw), 'the page contains a manifest field');
  if (raw) {
    const manifest = JSON.parse(
      raw.replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&'),
    );
    // The bug that reached a user: hook_attributes present without a url.
    if ('hook_attributes' in manifest) {
      ok(typeof manifest.hook_attributes.url === 'string' && manifest.hook_attributes.url.length > 0,
        'hook_attributes includes a url — GitHub requires it even when active is false');
      ok(manifest.hook_attributes.active === false, 'webhook delivery is disabled');
    }
    // Fields GitHub requires of any manifest.
    ok(typeof manifest.name === 'string' && manifest.name.length > 0, 'manifest has a name');
    ok(typeof manifest.url === 'string' && manifest.url.startsWith('https://'), 'manifest has a top-level url');
    ok(/^http:\/\/127\.0\.0\.1:\d+\/cb$/.test(manifest.redirect_url), 'redirect_url is loopback');
    // The security property, asserted on the real artifact this time.
    ok(manifest.default_permissions.contents === 'write', 'grants contents:write');
    ok(manifest.default_permissions.metadata === 'read', 'grants metadata:read');
    ok(Object.keys(manifest.default_permissions).length === 2,
      `grants ONLY those two (got ${Object.keys(manifest.default_permissions).join(',')})`);
    ok(!('pull_requests' in manifest.default_permissions), 'never grants pull_requests');
    ok(manifest.public === false, 'creates a private App');
  }
}

if (fails.length) {
  console.error(`FAILED ${fails.length}:`);
  for (const f of fails) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`ok — ${passed} live app-manifest tests passed`);
