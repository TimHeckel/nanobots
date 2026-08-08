// Static sanity checks over the engine templates.
//
// WHY: `node --check` only proves a file PARSES. It happily accepts `encoding: utf8` (a bare
// identifier) and a call to `pathToFileURL()` that was never imported — both are valid syntax
// and both are ReferenceErrors at runtime. Both shipped. The first killed every worker claim;
// the second killed the GitHub App installation step. Neither is reachable by the unit tests,
// because these modules self-execute on import and only run inside a sandbox or CI.
//
// These are cheap, targeted guards for the exact mistakes that have actually occurred, not an
// attempt to reimplement a linter.

import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const T = join(dirname(fileURLToPath(import.meta.url)), '..', 'templates', 'nanobots');
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'cli.mjs');
let passed = 0;
const fails = [];
const ok = (c, l) => { if (c) passed++; else fails.push(l); };

const files = readdirSync(T).filter((f) => f.endsWith('.mjs')).map((f) => join(T, f));
files.push(SRC);

for (const file of files) {
  const name = file.split('/').slice(-1)[0];
  const src = readFileSync(file, 'utf8');

  // 1. It must at least parse.
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    passed++;
  } catch (err) {
    fails.push(`${name} does not parse: ${String(err.stderr).slice(0, 120)}`);
  }

  // 2. String-valued options must be quoted. `encoding: utf8` parses fine and throws at
  //    runtime — it shipped, and it killed every worker claim.
  const bareEncoding = /encoding:\s*(?!['"`])[A-Za-z_$]/.test(src);
  ok(!bareEncoding, `${name}: \`encoding:\` must be followed by a quoted string, not a bare identifier`);

  // 3. Every node: builtin helper that is CALLED must also be imported. `pathToFileURL()`
  //    was used without importing it and only failed on the App-creation path.
  const BUILTINS = {
    'node:url': ['pathToFileURL', 'fileURLToPath'],
    // `resolve` is omitted deliberately: it is overwhelmingly a Promise callback
    // parameter, not node:path.resolve, and flagging it is pure noise.
    'node:path': ['join', 'dirname', 'basename'],
    'node:crypto': ['randomUUID', 'createSign', 'createHash', 'createVerify'],
    'node:fs': ['readFileSync', 'writeFileSync', 'existsSync', 'mkdirSync', 'chmodSync', 'cpSync', 'readdirSync'],
    'node:child_process': ['execSync', 'spawnSync', 'execFileSync'],
  };
  for (const [mod, helpers] of Object.entries(BUILTINS)) {
    for (const helper of helpers) {
      // Ignore matches that are property access (obj.join) or a declaration of the same name.
      const called = new RegExp(`(^|[^.\\w])${helper}\\s*\\(`, 'm').test(src);
      if (!called) continue;
      const declared = new RegExp(`(function|const|let|var)\\s+${helper}\\b`).test(src);
      const imported = new RegExp(`import\\s*\\{[^}]*\\b${helper}\\b[^}]*\\}\\s*from\\s*['"]${mod}['"]`, 's').test(src)
        || new RegExp(`\\b${helper}\\s*[:=]`).test(src);   // destructured from a dynamic import
      ok(declared || imported, `${name}: ${helper}() is called but never imported from ${mod}`);
    }
  }
}

// ── OCR must only review the loop's own PRs ─────────────────────────────────
// The trigger is a bare `pull_request`, so without a job-level gate this reviews — and
// blocks — every pull request a human opens. That is not nanobots' call to make: a repo
// installing the loop already has its own review process. The header comment claimed a
// `nanobots:built` gate for a while that did not actually exist in the workflow.
{
  const wf = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'templates',
    'github', 'workflows', 'nanobots-ocr.yml'), 'utf8');
  // The gate must sit on the JOB, not on a step — a step-level guard still lets every other
  // step in the job run against a human PR.
  const jobBlock = wf.slice(wf.indexOf('jobs:'), wf.indexOf('steps:'));
  ok(/^\s{4}if:/m.test(jobBlock), 'the ocr job carries a job-level `if` gate');
  ok(/startsWith\(github\.head_ref, 'nanobots\/'\)/.test(jobBlock),
    'gated on the nanobots/<issue>-<slug> head branch the worker prompt mandates');
  ok(/contains\(github\.event\.pull_request\.labels\.\*\.name, 'nanobots:built'\)/.test(jobBlock),
    'also gated on the nanobots:built label the controller applies');
  ok(/github\.event_name == 'workflow_dispatch'/.test(jobBlock),
    'a manual workflow_dispatch still runs — that is a human explicitly asking');
  ok(/vars\.NANOBOTS_OCR_ALL_PRS == 'true'/.test(jobBlock),
    'there is an opt-in escape hatch for repos that DO want every PR reviewed');
}

if (fails.length) {
  console.error(`FAILED ${fails.length}:`);
  for (const f of fails) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`ok — ${passed} engine sanity checks passed`);