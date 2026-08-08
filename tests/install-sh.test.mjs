// Drives the REAL install.sh the way nanobots.sh advertises it: `curl … | sh`.
//
// WHY: two bugs shipped in the advertised one-liner and neither was reachable by any other
// test. (1) `init` became an AI agent needing OCR_LLM_*, but install.sh checked only for
// binaries, so a new user got four green prereq checks and then a wall of text from inside
// npx. (2) Worse — under `curl … | sh` the SCRIPT is stdin, so stdin is an exhausted pipe by
// the time the CLI runs; every interactive question read EOF instantly. The headline install
// command could not work at all.
//
// So this pipes the script into `sh` exactly as curl would, and asserts on what a user sees.
// npx is stubbed via PATH so nothing is downloaded and no network is touched — the stub just
// records the argv and stdin state install.sh handed it.

import { mkdtempSync, writeFileSync, chmodSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const INSTALL = join(dirname(fileURLToPath(import.meta.url)), '..', 'install.sh');
let passed = 0;
const fails = [];
const ok = (c, l) => { if (c) passed++; else fails.push(l); };

const root = mkdtempSync(join(tmpdir(), 'nanobots-install-'));
const bin = join(root, 'bin');
const repo = join(root, 'repo');
execFileSync('mkdir', ['-p', bin, repo]);
execFileSync('git', ['init', '-q', repo], { stdio: 'pipe' });

// Stub every prerequisite so the test never reaches the network. The npx stub records what
// it was given, including whether stdin was still a usable terminal/file when it ran.
const marker = join(root, 'npx-called');
writeFileSync(join(bin, 'npx'), `#!/bin/sh\nprintf '%s\\n' "$@" > ${marker}\nif [ -t 0 ]; then echo "STDIN=tty" >> ${marker}; else echo "STDIN=notty" >> ${marker}; fi\n`);
for (const tool of ['gh']) writeFileSync(join(bin, tool), '#!/bin/sh\nexit 0\n');
for (const f of ['npx', 'gh']) chmodSync(join(bin, f), 0o755);

const PATH = `${bin}:${process.env.PATH}`;
const ENV_OK = { OCR_LLM_URL: 'https://example.test/v1/chat/completions', OCR_LLM_TOKEN: 'sk-test', OCR_LLM_MODEL: 'test-model' };

// Every POSIX shell we can find, not just the default one. macOS /bin/sh is bash-in-sh-mode
// and is far more forgiving than dash, which is /bin/sh on Debian and Ubuntu — i.e. most
// people running `curl | sh`. A redirection error on a POSIX SPECIAL builtin kills a
// non-interactive dash outright, so a probe written as `{ : < /dev/tty; }` silently exited 2
// there while passing perfectly on a Mac. That shipped, and only CI caught it.
const SHELLS = ['sh', 'dash', 'bash', 'busybox sh'].filter((s) => {
  const [bin, ...rest] = s.split(' ');
  try { execFileSync(bin, [...rest, '-c', 'exit 0'], { stdio: 'ignore' }); return true; }
  catch { return false; }
});
let SHELL_UNDER_TEST = SHELLS[0];

// Run install.sh the way curl does: piped into sh, so the script itself occupies stdin.
function curlPipeSh(env, { cwd = repo, shell = SHELL_UNDER_TEST } = {}) {
  const script = readFileSync(INSTALL, 'utf8');
  const [bin, ...rest] = shell.split(' ');
  try {
    const stdout = execFileSync(bin, [...rest, '-c', shell], {
      cwd, input: script, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
      env: { PATH, HOME: root, ...env },
    });
    return { code: 0, out: stdout };
  } catch (e) {
    return { code: e.status, out: `${e.stdout || ''}${e.stderr || ''}` };
  }
}
const readMarker = () => (existsSync(marker) ? readFileSync(marker, 'utf8') : '');
const clearMarker = () => { if (existsSync(marker)) rmSync(marker); };

// ── 1. missing OCR_LLM_* must fail HERE, before npx ──────────────────────────
clearMarker();
let r = curlPipeSh({});
ok(r.code !== 0, 'missing OCR_LLM_* exits non-zero');
ok(readMarker() === '', 'missing OCR_LLM_* never reaches npx (no package download)');
ok(/OCR_LLM_URL/.test(r.out) && /OCR_LLM_TOKEN/.test(r.out) && /OCR_LLM_MODEL/.test(r.out),
  'the error names all three missing variables');
ok(/export OCR_LLM_URL=/.test(r.out), 'the error shows copy-pasteable exports');
ok(!/No API key needed/i.test(r.out), 'no stale "no key needed" claim');

// ── 2. partial config is still a failure, and names only what is missing ─────
clearMarker();
r = curlPipeSh({ OCR_LLM_URL: ENV_OK.OCR_LLM_URL, OCR_LLM_TOKEN: ENV_OK.OCR_LLM_TOKEN });
ok(r.code !== 0, 'a partially configured env still fails');
ok(/missing environment:\s*OCR_LLM_MODEL\s*$/m.test(r.out), 'only the genuinely missing var is named');
ok(!r.out.includes('sk-test'), 'a supplied token value is never echoed back');

// ── 3. the .env hint ─────────────────────────────────────────────────────────
clearMarker();
writeFileSync(join(repo, '.env'), 'OCR_LLM_URL=https://api.deepseek.com/chat/completions\nOCR_LLM_TOKEN=sk-secret-value\n');
r = curlPipeSh({});
ok(/set -a; \. \.\/\.env; set \+a/.test(r.out), 'an .env holding OCR_LLM_* produces the load hint');
ok(!r.out.includes('sk-secret-value'), 'the .env hint never prints a value from the file');
rmSync(join(repo, '.env'));

clearMarker();
writeFileSync(join(repo, '.env'), 'UNRELATED=1\n');
r = curlPipeSh({});
ok(!/set -a; \. \.\/\.env/.test(r.out), 'an unrelated .env does not produce a misleading hint');
rmSync(join(repo, '.env'));

// ── 4. THE ONE THAT SHIPPED BROKEN: stdin must never be the exhausted pipe ───
// The guarantee has two halves, and both are behavioural. With a terminal available,
// install.sh must reattach it. With no terminal at all, it must REFUSE — because the only
// other option is handing the CLI a dead pipe, which is the bug.

// 4a. no terminal (this harness, and any CI): refuse loudly, never exec.
clearMarker();
r = curlPipeSh(ENV_OK);
ok(r.code !== 0, 'with no terminal available, install.sh exits non-zero');
ok(readMarker() === '', 'with no terminal available, the CLI is never handed the dead pipe');
ok(/no terminal available/i.test(r.out), 'the no-terminal error explains the actual problem');
ok(/npx nanobots-sh init/.test(r.out), 'the no-terminal error gives a command that does work');

// 4b. with a real pty — the actual `curl … | sh` case a user experiences. stdin is still the
// pipe; /dev/tty is what install.sh must reattach.
const scriptFile = join(root, 'boot.sh');
writeFileSync(scriptFile, readFileSync(INSTALL, 'utf8'));
// `script` allocates a pty for its child, which is the only way to reproduce a user's real
// terminal here. BSD and GNU take different argv, so try both and let the marker file — not
// the exit status — decide whether the run actually happened.
function inPty(cmd, cwd) {
  for (const argv of [['-q', '/dev/null', 'sh', '-c', cmd], ['-q', '-c', cmd, '/dev/null']]) {
    clearMarker();
    try {
      // stdin MUST be pinned to /dev/null, not inherited: `script` fails outright when it
      // inherits certain stdin (this test passed under `npm test` and failed when run by
      // hand, purely from that). The pty it allocates for the child is what matters here.
      execFileSync('script', argv, {
        cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000,
        env: { PATH, HOME: root, ...ENV_OK },
      });
    } catch { /* exit status is not the signal — the marker is */ }
    if (readMarker()) return true;
  }
  return false; // no usable `script` on this platform
}
if (!inPty(`cat ${scriptFile} | sh`, repo)) {
  // Never let an unrunnable case read as a pass.
  fails.push('SKIPPED: no usable `script`, so the pty install path went untested');
} else {
  const m = readMarker();
  ok(m.includes('init'), 'under a pty, a configured env reaches `npx nanobots-sh init`');
  ok(/^nanobots-sh$/m.test(m), 'invokes the nanobots-sh package, not the unrelated `nanobots` package');
  ok(/--yes/.test(m), 'passes --yes so npx does not prompt');
  ok(m.includes('STDIN=tty'),
    'the CLI receives a TERMINAL on stdin, not the exhausted curl pipe (needs `< /dev/tty`)');
  ok(!m.includes('--headless'), 'does not smuggle the hidden --headless flag in');
}

// ── 5. outside a git repo ────────────────────────────────────────────────────
clearMarker();
r = curlPipeSh(ENV_OK, { cwd: root });
ok(r.code !== 0 && /inside the git repo/.test(r.out), 'refuses to run outside a git repo');
ok(readMarker() === '', 'never reaches npx outside a git repo');

// ── 9. the same behaviour in EVERY shell we can find ─────────────────────────
// The failure mode this guards against is silent: the script exits non-zero having printed
// nothing, so the user sees a dead command with no explanation. Asserting the help text is
// present is what distinguishes "refused with a reason" from "died".
for (const shell of SHELLS) {
  clearMarker();
  const noEnv = curlPipeSh({}, { shell });
  ok(noEnv.code !== 0, `${shell}: missing env exits non-zero`);
  ok(/OCR_LLM_URL/.test(noEnv.out), `${shell}: missing env still EXPLAINS itself (not a silent exit)`);
  ok(readMarker() === '', `${shell}: missing env never reaches npx`);

  clearMarker();
  const noTty = curlPipeSh(ENV_OK, { shell });
  ok(readMarker() === '' || readMarker().includes('STDIN=tty'),
    `${shell}: the CLI is never handed the exhausted curl pipe`);
  if (!readMarker()) {
    // Took the no-terminal path — it MUST say so rather than dying quietly. dash exits 2 in
    // silence if the /dev/tty probe is not wrapped in a subshell.
    ok(/no terminal available/i.test(noTty.out),
      `${shell}: the no-terminal path explains itself instead of exiting silently`);
    ok(/npx nanobots-sh init/.test(noTty.out), `${shell}: offers a command that does work`);
  }
}
console.log(`   (shells exercised: ${SHELLS.join(', ')})`);

rmSync(root, { recursive: true, force: true });

if (fails.length) {
  console.error(`\n${fails.length} FAILED:`);
  for (const f of fails) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`ok — ${passed} install.sh tests passed`);
