// Contract test between LOOP-PROMPT.md (which WRITES the plan marker) and
// daytona-worker.mjs (which PARSES it).
//
// WHY: these two halves drifted in production and the failure was silent and total. The
// outer loop posted a plan whose hash appeared only in prose — "Plan hash: `1cb719a4564a`" —
// while the worker required a literal `<!-- nanobots:plan issue=N hash=... -->` marker. The
// worker reported "no versioned plan posted yet" forever, so the item could never be claimed
// no matter how many approvals it collected. Nothing caught it: the prompt is prose, the
// parser is code, and no test connected them.
//
// This asserts the marker documented in the prompt actually satisfies the regex the worker
// runs, by building a concrete example from the prompt's own template and matching it.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const T = join(dirname(fileURLToPath(import.meta.url)), '..', 'templates', 'nanobots');
const worker = readFileSync(join(T, 'daytona-worker.mjs'), 'utf8');
const prompt = readFileSync(join(T, 'LOOP-PROMPT.md'), 'utf8');

let passed = 0;
const fails = [];
const ok = (c, l) => { if (c) passed++; else fails.push(l); };

// ── pull the real regexes out of the worker ──────────────────────────────────
const planSrc = worker.match(/match\((\/<!--.*?nanobots:plan.*?-->\/)\)/)?.[1];
const startSrc = worker.match(/match\((\/\S.*?nanobots start.*?\/[a-z]*)\)/)?.[1];
ok(Boolean(planSrc), 'found the plan-marker regex in daytona-worker.mjs');
ok(Boolean(startSrc), 'found the /nanobots start regex in daytona-worker.mjs');

function toRegExp(literal) {
  const m = literal.match(/^\/(.*)\/([a-z]*)$/s);
  return new RegExp(m[1], m[2]);
}

// ── the prompt must document the marker, not just the concept ────────────────
ok(/nanobots:plan/.test(prompt), 'LOOP-PROMPT.md names the nanobots:plan marker at all');
ok(/<!--\s*nanobots:plan\s+issue=/.test(prompt), 'LOOP-PROMPT.md shows the marker in full, not just the word');
ok(/mandatory|not negotiable|not optional/i.test(prompt),
  'LOOP-PROMPT.md states the marker is mandatory — a model that treats it as optional reproduces the original bug');

// ── the documented marker must actually parse ────────────────────────────────
if (planSrc) {
  const planRe = toRegExp(planSrc);
  // Build a concrete marker the way the prompt tells the loop to.
  const concrete = '<!-- nanobots:plan issue=2 hash=1cb719a4564a -->';
  ok(planRe.test(concrete), `the documented marker shape satisfies the worker regex ${planSrc}`);
  ok(planRe.exec(concrete)?.[1] === '1cb719a4564a', 'the worker extracts the hash from it');

  // The exact prose-only form that broke production must NOT satisfy it — otherwise this
  // test would pass while the bug persisted.
  ok(!planRe.test('Plan hash: `1cb719a4564a` (sha256 of the plan comment above)'),
    'a prose-only hash does NOT satisfy the parser (this is what actually shipped and hung the loop)');

  // Shape rules the worker enforces, each of which would silently strand an item.
  ok(!planRe.test('<!-- nanobots:plan issue=2 hash=1CB719A4564A -->'), 'uppercase hex is rejected — prompt must say lowercase');
  ok(!planRe.test('<!-- nanobots:plan issue=2 hash=1cb719 -->'), 'a short hash is rejected — prompt must say 12 chars');
  ok(!planRe.test('<!-- nanobots:plan hash=1cb719a4564a -->'), 'a marker without issue= is rejected');
  ok(planRe.test('<!--nanobots:plan issue=12 hash=abcdef012345-->'), 'tight spacing still parses');
  // The prompt must specify BOTH constraints the regex enforces, or a model will guess.
  ok(/12 lowercase hex|12 hex|lowercase hex/i.test(prompt), 'LOOP-PROMPT.md specifies 12 lowercase hex characters');
}

// ── the approval form must match too ─────────────────────────────────────────
if (startSrc) {
  const startRe = toRegExp(startSrc);
  ok(startRe.test('/nanobots start 1cb719a4564a'), 'the documented approval command satisfies the worker regex');
  ok(/\/nanobots start/.test(prompt), 'LOOP-PROMPT.md documents the /nanobots start approval command');
  ok(!startRe.test('/nanobots start'), 'a bare /nanobots start with no hash is rejected');

  // THE SELF-APPROVAL BUG, reproduced verbatim. The loop's own plan comment explains how to
  // approve; an unanchored regex read that explanation as the approval, so the loop approved
  // every item it planned and the human gate never engaged. These assertions fail against the
  // old regex and pass against the anchored one.
  const loopsOwnProse = 'Plan hash: `1cb719a4564a` (sha256 of the plan comment above, first 12 hex chars). '
    + 'A collaborator can approve with `/nanobots start 1cb719a4564a`. This hash is invalidated if the issue changes.';
  ok(!startRe.test(loopsOwnProse), 'the loop explaining HOW to approve is not itself an approval (the self-approval bug)');
  ok(!startRe.test('please run `/nanobots start 1cb719a4564a` when ready'), 'a backticked mention in a sentence does not approve');
  ok(!startRe.test('see /nanobots start 1cb719a4564a for details'), 'a mid-sentence mention does not approve');
  ok(startRe.test('/nanobots start 1cb719a4564a'), 'a bare command alone on its line DOES approve');
  ok(startRe.test('looks good to me\n/nanobots start 1cb719a4564a'), 'a human may add commentary on other lines');
  ok(startRe.test('  /nanobots start 1cb719a4564a  '), 'leading/trailing whitespace on the line is tolerated');
  ok(/own line/.test(prompt), 'LOOP-PROMPT.md warns the loop never to write the bare command on its own line');
}

if (fails.length) {
  console.error(`FAILED ${fails.length}:`);
  for (const f of fails) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`ok — ${passed} plan-protocol contract tests passed`);
