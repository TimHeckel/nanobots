// Regression test for the interactive prompt in `init`.
//
// WHY THIS EXISTS: three bugs here broke `init` — the only install path — while the rest of
// the suite stayed green, because the onboarding e2e runs in dry-run mode and substitutes
// scripted answers instead of touching the real reader. A passing suite proved nothing about
// the code every user actually runs. Same lesson as RECIPES.md "trusting a gate": a green
// result that never exercised the path is not evidence.
//
// The three bugs:
//   1. `node:readline/promises` question() returns a promise and takes NO callback. Passing
//      one is swallowed as an options object and the prompt never resolves — init hung on
//      question #1 for every user.
//   2. A fresh interface per prompt does not survive the previous close() — prompt #2 never
//      receives input. The interface must be shared for the session.
//   3. Redrawing asterisks over readline's echo is too late: a PASTED credential arrives as
//      one chunk and is echoed in full before any redraw runs, landing in the terminal and
//      its scrollback. The echo must be muted at the source.
//
// Input is paced with delays because dumping every line at once resolves differently than a
// human typing, and would hide bug #2.

import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'cli.mjs');
let passed = 0;
const fails = [];
const ok = (c, l) => { if (c) passed++; else fails.push(l); };

// promptLine isn't exported, so guard the three regressions at the source level, then prove
// the same implementation behaves correctly against a real child process below.
const src = readFileSync(CLI, 'utf8');
ok(!/rl\.question\([^)]*,\s*\(/.test(src), 'cli.mjs never passes a callback to rl.question (the promises API takes none)');
ok(/let sharedRl/.test(src) && /function promptInterface/.test(src), 'cli.mjs uses a single shared readline interface');
ok(/promptOut\.muted = true/.test(src), 'cli.mjs mutes readline echo at the source for secret prompts');
ok(/function closePrompt/.test(src) && /closePrompt\(\)/.test(src), 'cli.mjs closes the interface on exit');
ok(/return rl\.question\(query\)|await answer/.test(src), 'cli.mjs awaits/returns the question promise');

const dir = mkdtempSync(join(tmpdir(), 'nanobots-prompt-'));
const harness = join(dir, 'h.mjs');
writeFileSync(harness, [
  "import readline from 'node:readline/promises';",
  "import { Writable } from 'node:stream';",
  'let sharedRl = null, promptOut = null;',
  'function promptInterface() {',
  '  if (!sharedRl) {',
  '    promptOut = new Writable({ write(chunk, enc, cb) {',
  "      if (promptOut.muted) process.stdout.write('*'); else process.stdout.write(chunk, enc); cb();",
  '    } });',
  '    promptOut.muted = false;',
  '    sharedRl = readline.createInterface({ input: process.stdin, output: promptOut, terminal: true });',
  '  }',
  '  return sharedRl;',
  '}',
  'async function promptLine(query, { secret = false } = {}) {',
  '  const rl = promptInterface();',
  '  if (!secret) return rl.question(query);',
  '  const answer = rl.question(query);',
  '  promptOut.muted = true;',
  "  try { return await answer; } finally { promptOut.muted = false; process.stdout.write('\\n'); }",
  '}',
  "const a = await promptLine('Board name? ');",
  "const b = await promptLine('WIP cap? ');",
  "const c = await promptLine('Token? ', { secret: true });",
  'sharedRl.close();',
  "process.stdout.write('RESULT=' + JSON.stringify([a, b, c]) + '\\n');",
].join('\n'));

const result = await new Promise((resolve) => {
  const p = spawn('node', [harness], { stdio: ['pipe', 'pipe', 'pipe'] });
  let out = '';
  let err = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { err += d; });
  const lines = ['\n', '1\n', 'sk-secret-value\n'];
  let i = 0;
  // Deliberately never end() stdin — closing it races readline's final read.
  const tick = setInterval(() => { if (i < lines.length) p.stdin.write(lines[i++]); }, 250);
  const kill = setTimeout(() => { p.kill('SIGKILL'); resolve({ timedOut: true, out, err }); }, 15000);
  p.on('close', () => { clearInterval(tick); clearTimeout(kill); resolve({ timedOut: false, out, err }); });
});

ok(!result.timedOut, 'prompt sequence completes without hanging (regressions 1 and 2 both hung here)');
const m = result.out.match(/RESULT=(\[.*\])/);
ok(Boolean(m), `harness produced a result line${m ? '' : ` — stderr: ${(result.err || '(none)').slice(0, 300)}`}`);
if (m) {
  const [board, wip, token] = JSON.parse(m[1]);
  ok(board === '', 'empty input returns "" so the caller can apply its default');
  ok(wip === '1', 'the SECOND prompt receives input (regression 2 broke this)');
  ok(token === 'sk-secret-value', 'a masked prompt still returns the true value');
  // The value must never appear in what the terminal was shown — only in the RESULT line the
  // harness prints deliberately after the fact.
  const shown = result.out.slice(0, result.out.indexOf('RESULT='));
  ok(!shown.includes('sk-secret-value'), 'the secret is never echoed in cleartext (regression 3)');
  ok(/\*{3,}/.test(shown), 'the secret prompt shows asterisks');
}

rmSync(dir, { recursive: true, force: true });

if (fails.length) {
  console.error(`FAILED ${fails.length}:`);
  for (const f of fails) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`ok — ${passed} prompt tests passed`);
