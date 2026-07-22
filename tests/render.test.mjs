// Minimal zero-dep test: every template renders with a full value set,
// leaves no unreplaced placeholders, and engine/repo ownership markers are right.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const TEMPLATES = join(dirname(fileURLToPath(import.meta.url)), '..', 'templates');

const values = {
  OWNER: 'acme', REPO: 'widgets', BOARD: 'Nanobots', HUMAN_LABEL: 'summon-human',
  WIP_CAP: '2', DEFAULT_BRANCH: 'main',
  GATES_LIST: '   - `npm test`',
  HARD_GATES_LIST: '  - payments', INSTALL_DATE: '2026-07-01',
  DAYTONA_SNAPSHOT: 'provider default', DAYTONA_TARGET: 'us',
  OCR_VERSION: 'v1.7.12', OCR_BLOCKING_SEVERITIES: 'critical, high',
};

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

let count = 0;
for (const file of walk(TEMPLATES)) {
  const raw = readFileSync(file, 'utf8');
  const rendered = raw.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    assert.ok(key in values, `${file} references unknown placeholder {{${key}}}`);
    return values[key];
  });
  assert.ok(!/\{\{\w+\}\}/.test(rendered), `${file} has unreplaced placeholders after render`);
  const head = raw.slice(0, 200);
  assert.ok(
    head.includes('nanobots:engine-owned') || head.includes('nanobots:repo-owned'),
    `${file} missing ownership marker in first lines`,
  );
  count++;
}

// Ownership expectations
const engineOwned = [
  'LOOP-PROMPT.md', 'WORKER-PROMPT.md', 'RUNTIMES.md', 'run-cycle.sh',
  'daytona-client.mjs', 'daytona-worker.mjs',
  'ocr-autofix-lib.mjs', 'open-code-review-report.mjs', 'ocr-autofix-worker.mjs', 'ocr-autofix-controller.mjs',
];
const repoOwned = ['TRIAGE.md', 'RECIPES.md', 'LEARNINGS.md'];
for (const f of engineOwned) {
  assert.ok(readFileSync(join(TEMPLATES, 'nanobots', f), 'utf8').slice(0, 200).includes('engine-owned'), `${f} should be engine-owned`);
}
for (const f of repoOwned) {
  assert.ok(readFileSync(join(TEMPLATES, 'nanobots', f), 'utf8').slice(0, 200).includes('repo-owned'), `${f} should be repo-owned`);
}

console.log(`ok — ${count} templates render clean with correct ownership markers`);
