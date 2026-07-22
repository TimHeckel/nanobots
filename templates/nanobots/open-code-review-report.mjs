#!/usr/bin/env node
// nanobots:engine-owned v0.1 — re-rendered by `nanobots update`
// Required — every nanobots:built PR gets reviewed, not just opted-in ones.
//
// Parses OCR's JSON findings into a fingerprinted, machine-readable report; posts an
// inline-comment PR review (APPROVE/REQUEST_CHANGES/COMMENT) plus one sticky summary
// bound to the exact head SHA; writes the same report as a bounded JSON artifact for the
// autofix controller (or a human) to consume; and exits non-zero on blocking findings or
// on a failed/malformed review — a broken review is never treated as clean.
//
// Supersedes the old ocr-review.mjs (folded in here — one script, not two overlapping
// ones). Library functions are exported for tests/ocr-autofix.test.mjs; the CLI only runs
// when this file is executed directly, not when imported.
//
// Usage: open-code-review-report.mjs <ocr-findings.json> <head-sha> [report-out.json]
// Env: GH_REPOSITORY, GH_PR_NUMBER, GH_TOKEN, OCR_AUTO_REVIEW_EVENTS,
//      OCR_MAX_INLINE_COMMENTS, OCR_MAX_SUMMARY_COMMENTS

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fingerprintFinding, decideReviewEvent } from './ocr-autofix-lib.mjs';

const SEVERITIES = ['critical', 'high', 'medium', 'low'];
const CLEANNESS = { critical: 0, high: 20, medium: 40, low: 60 };
const MARKER = '<!-- nanobots:ocr:sticky -->';

// ── library (pure) ───────────────────────────────────────────────────────────

export function parseOcrOutput(rawText) {
  if (!rawText || !rawText.trim()) {
    return { findings: [], parseError: 'OCR produced no findings output (bootstrap or run failure)' };
  }
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    return { findings: [], parseError: `malformed findings JSON: ${err.message}` };
  }
  const list = Array.isArray(parsed) ? parsed : (parsed.findings ?? null);
  if (!Array.isArray(list)) {
    return { findings: [], parseError: 'findings JSON has no findings array' };
  }
  const findings = list
    .filter((f) => f && typeof f.file === 'string' && SEVERITIES.includes(f.severity))
    .map((f) => {
      const finding = {
        file: String(f.file).slice(0, 300),
        line: Number.isInteger(f.line) ? f.line : 0,
        category: String(f.category ?? 'other').slice(0, 40),
        severity: f.severity,
        content: String(f.content ?? '').slice(0, 500),
      };
      return { ...finding, fingerprint: fingerprintFinding(finding) };
    })
    // Full machine-readable list is never capped — only human display is bounded later.
    .slice(0, 500);
  return { findings, parseError: null };
}

export function severityCounts(findings) {
  return Object.fromEntries(SEVERITIES.map((s) => [s, findings.filter((f) => f.severity === s).length]));
}

export function cleannessScore(counts, parseError) {
  if (parseError) return 0;
  const worst = SEVERITIES.find((s) => counts[s] > 0);
  return worst ? CLEANNESS[worst] : 100;
}

export function buildReport({ findings, parseError, headSha, blockingSeverities, autoReviewEventsEnabled }) {
  const counts = severityCounts(findings);
  const cleanness = cleannessScore(counts, parseError);
  const blocking = new Set(blockingSeverities ?? ['critical', 'high']);
  const blockingFindings = findings.filter((f) => blocking.has(f.severity));
  const clean = !parseError && blockingFindings.length === 0;
  const reviewEvent = decideReviewEvent({
    counts, blockingSeverities, autoReviewEventsEnabled, failed: Boolean(parseError),
  });
  return {
    schemaVersion: 1,
    headSha,
    parseError,
    counts,
    cleanness,
    clean,
    blockingSeverities: [...blocking],
    findings,
    reviewEvent,
  };
}

export function formatSummaryComment(report) {
  const { headSha, counts, cleanness, clean, parseError, blockingSeverities, findings } = report;
  const shown = findings.slice(0, report.maxSummaryComments ?? 20);
  const top = shown
    .map((f) => `- \`${f.file}:${f.line}\` **${f.severity}** [${f.category}] \`${f.fingerprint}\`: ${f.content}`)
    .join('\n') || '_no findings_';
  const omitted = findings.length - shown.length;
  return `${MARKER}
### OCR review — ${clean ? 'clean' : parseError ? 'review failed' : 'blocking findings'}

- head: \`${headSha}\`
- cleanness: ${cleanness}/100
- counts: critical ${counts.critical}, high ${counts.high}, medium ${counts.medium}, low ${counts.low}
- blocking severities: ${blockingSeverities.join(', ')}
${parseError ? `- **${parseError}** — a failed or unparseable review is never treated as clean.` : ''}

${top}
${omitted > 0 ? `\n_${omitted} more finding(s) omitted from this summary — see the full report artifact._` : ''}
`;
}

export function formatInlineComments(findings, { maxInlineComments = 10 } = {}) {
  return findings
    .filter((f) => f.line > 0)
    .slice(0, maxInlineComments)
    .map((f) => ({
      path: f.file,
      line: f.line,
      side: 'RIGHT',
      body: `**${f.severity}** [${f.category}] \`${f.fingerprint}\`\n\n${f.content}`,
    }));
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function sh(cmd, opts = {}) { return execSync(cmd, { encoding: 'utf8', ...opts }).trim(); }
function shTry(cmd, opts = {}) { try { return sh(cmd, opts); } catch { return null; } }
// Pipes untrusted/finding-derived content via stdin rather than interpolating it into the
// shell command string — content never goes through shell parsing/quoting at all this way.
function shStdin(cmd, input) { return execSync(cmd, { encoding: 'utf8', input }).trim(); }
function shStdinTry(cmd, input) { try { return shStdin(cmd, input); } catch { return null; } }

async function main() {
  const [, , findingsPath, headSha, reportOutPath] = process.argv;
  if (!headSha) { console.error('usage: open-code-review-report.mjs <ocr-findings.json> <head-sha> [report-out.json]'); process.exit(2); }

  const cfg = JSON.parse(readFileSync('.nanobots/config.json', 'utf8'));
  const NWO = process.env.GH_REPOSITORY;
  const PR = process.env.GH_PR_NUMBER;
  const autoReviewEventsEnabled = process.env.OCR_AUTO_REVIEW_EVENTS !== 'false';
  const maxInlineComments = Number(process.env.OCR_MAX_INLINE_COMMENTS ?? 10);
  const maxSummaryComments = Number(process.env.OCR_MAX_SUMMARY_COMMENTS ?? 20);

  const rawText = existsSync(findingsPath) ? readFileSync(findingsPath, 'utf8') : '';
  const { findings, parseError } = parseOcrOutput(rawText);
  const report = buildReport({
    findings, parseError, headSha,
    blockingSeverities: cfg.ocr?.blockingSeverities, autoReviewEventsEnabled,
  });
  report.maxSummaryComments = maxSummaryComments;

  writeFileSync(reportOutPath || 'ocr-report.json', JSON.stringify(report, null, 2));

  // Sticky summary (update in place if present).
  const summary = formatSummaryComment(report);
  const existingId = shTry(
    `gh pr view ${PR} --repo ${NWO} --json comments --jq '[.comments[] | select(.body | startswith("${MARKER}"))] | .[0].id // empty'`,
  );
  if (existingId) {
    shStdin(`gh api repos/${NWO}/issues/comments/${existingId} -X PATCH --input -`, JSON.stringify({ body: summary }));
  } else {
    shStdin(`gh api repos/${NWO}/issues/${PR}/comments -X POST --input -`, JSON.stringify({ body: summary }));
  }

  // Inline-comment review submitted against the exact head SHA. GitHub rejects a review
  // with zero comments and event=REQUEST_CHANGES/COMMENT if body is also empty, so always
  // send a body too.
  const comments = formatInlineComments(findings, { maxInlineComments });
  const reviewPayload = {
    commit_id: headSha,
    event: report.reviewEvent,
    body: `OCR review on \`${headSha.slice(0, 12)}\`: ${report.clean ? 'clean.' : parseError ? `failed — ${parseError}` : `${findings.length} finding(s), ${comments.length} shown inline.`}`,
    comments,
  };
  const reviewOk = shStdinTry(`gh api repos/${NWO}/pulls/${PR}/reviews -X POST --input -`, JSON.stringify(reviewPayload));
  if (reviewOk === null) {
    console.error('failed to submit PR review (posting inline comments may require write access on fork PRs) — sticky summary still posted.');
  }

  console.log(report.clean ? 'OCR clean.' : 'OCR blocking findings present (or the review failed) — see the PR review/summary.');
  process.exit(report.clean ? 0 : 1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
