#!/usr/bin/env node
// nanobots:engine-owned v0.1 — re-rendered by `nanobots update`
// Required — every nanobots:built PR gets reviewed, not just opted-in ones.
//
// Parses OCR's JSON findings, posts one sticky PR comment, and exits non-zero when
// blocking findings exist (or the review itself failed/produced nothing parseable — a
// broken review is never treated as clean). The Actions job's own conclusion IS the
// `nanobots/ocr` check on this exact head; no separate check-run API call needed.
//
// Usage: ocr-review.mjs <findings.json> <head-sha>
// Env: GH_REPOSITORY (owner/repo), GH_PR_NUMBER, GH_TOKEN

import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const [, , findingsPath, headSha] = process.argv;
if (!headSha) { console.error('usage: ocr-review.mjs <findings.json> <head-sha>'); process.exit(2); }

const cfg = JSON.parse(readFileSync('.nanobots/config.json', 'utf8'));
const blocking = new Set(cfg.ocr?.blockingSeverities ?? ['critical', 'high']);
const NWO = process.env.GH_REPOSITORY;
const PR = process.env.GH_PR_NUMBER;

const SEVERITIES = ['critical', 'high', 'medium', 'low'];
const CLEANNESS = { critical: 0, high: 20, medium: 40, low: 60 };

function sh(cmd) { return execSync(cmd, { encoding: 'utf8' }).trim(); }

let findings = [];
let parseError = null;
if (existsSync(findingsPath)) {
  try {
    const raw = JSON.parse(readFileSync(findingsPath, 'utf8'));
    const list = Array.isArray(raw) ? raw : (raw.findings ?? []);
    findings = list
      .filter((f) => f && typeof f.file === 'string' && SEVERITIES.includes(f.severity))
      .map((f) => ({
        file: String(f.file).slice(0, 300),
        line: Number.isInteger(f.line) ? f.line : 0,
        category: String(f.category ?? 'other').slice(0, 40),
        severity: f.severity,
        content: String(f.content ?? '').slice(0, 500),
      }))
      .slice(0, 200);
  } catch (err) {
    parseError = `malformed findings JSON: ${err.message}`;
  }
} else {
  parseError = 'OCR produced no findings file (bootstrap or run failure)';
}

const counts = Object.fromEntries(SEVERITIES.map((s) => [s, findings.filter((f) => f.severity === s).length]));
const worst = SEVERITIES.find((s) => counts[s] > 0);
const cleanness = parseError ? 0 : (worst ? CLEANNESS[worst] : 100);
const blockingFindings = findings.filter((f) => blocking.has(f.severity));
const clean = !parseError && blockingFindings.length === 0;

const top = findings.slice(0, 15)
  .map((f) => `- \`${f.file}:${f.line}\` **${f.severity}** [${f.category}]: ${f.content}`)
  .join('\n') || '_no findings_';

const MARKER = '<!-- nanobots:ocr:sticky -->';
const body = `${MARKER}
### OCR review — ${clean ? 'clean' : parseError ? 'review failed' : 'blocking findings'}

- head: \`${headSha}\`
- cleanness: ${cleanness}/100
- counts: critical ${counts.critical}, high ${counts.high}, medium ${counts.medium}, low ${counts.low}
- blocking severities: ${[...blocking].join(', ')}
${parseError ? `- **${parseError}** — a failed or unparseable review is never treated as clean.` : ''}

${top}
`;

const existingId = sh(
  `gh pr view ${PR} --repo ${NWO} --json comments --jq '[.comments[] | select(.body | startswith("${MARKER}"))] | .[0].id // empty'`,
);
if (existingId) {
  sh(`gh api repos/${NWO}/issues/comments/${existingId} -X PATCH -f body=${JSON.stringify(body)}`);
} else {
  sh(`gh pr comment ${PR} --repo ${NWO} --body ${JSON.stringify(body)}`);
}

console.log(clean ? 'OCR clean.' : 'OCR blocking findings present (or the review failed) — see the PR comment.');
process.exit(clean ? 0 : 1);
