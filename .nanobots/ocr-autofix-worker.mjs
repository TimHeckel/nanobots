#!/usr/bin/env node
// nanobots:engine-owned v0.1 — re-rendered by `nanobots update`
//
// Runs INSIDE the disposable Daytona remediation sandbox — never on the Actions runner.
// Reads the exact-SHA-checked-out repo (already cloned by the controller into the sandbox
// cwd) plus a bounded input JSON, evaluates every eligible finding with the configured fix
// model, applies only validated exact replacements, runs the trusted configured gates, and
// — only if gates pass and the remote head still matches the expected SHA — pushes exactly
// one repair commit. Prints one bounded structured JSON result to stdout; nothing else it
// prints is meant to be parsed.
//
// Usage: ocr-autofix-worker.mjs <input.json>
// Env:   OCR_AUTOFIX_TOKEN_RESOLVED   fixer model credential (never written to disk)
// The GitHub push credential is NOT read from env here — the controller embeds it in the
// `git clone` remote URL before this script runs (same pattern as daytona-worker.mjs), so
// `git push` just works against the already-configured remote. See daytona-client.mjs /
// ocr-autofix-controller.mjs for where that credential comes from and RUNTIMES.md for why.
//
// Input JSON shape (written by ocr-autofix-controller.mjs):
// {
//   headSha, headRef, defaultBranch,
//   findings: [{fingerprint, file, line, category, severity, content}, ...],
//   protectedPaths: [...], gates: [...],
//   caps: {maxFindings, maxFiles, maxChangedLines, contextLines, maxExcerptChars},
//   model: {url, model, extraBodyRaw},
//   concurrency: {initial, max, checkpointSize},
// }

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  computeLineStarts, buildExcerptRanges, extractExcerpt, validateAndApplyEdits,
  isPathSafe, isProtectedPath, looksBinary, clampConcurrency,
} from './ocr-autofix-lib.mjs';
import { redact } from './daytona-client.mjs';

function sh(cmd, opts = {}) { return execSync(cmd, { encoding: 'utf8', ...opts }).trim(); }
function shTry(cmd, opts = {}) { try { return sh(cmd, opts); } catch { return null; } }

const SYSTEM_PROMPT = `You are a surgical code-repair assistant. You are given one source file excerpt and a
list of findings from an independent code review, each with a stable fingerprint. For
EVERY fingerprint listed, return exactly one disposition:

- "fixed": you are certain of a minimal, safe, exact source-text replacement.
- "false_positive": the finding does not describe a real problem; explain why in "reason".
- "needs_human": you are not confident enough to change code safely; explain why.

Only "fixed" dispositions may include a replacement. A replacement's "oldText" MUST be
copied EXACTLY, character-for-character, from the excerpt you were given — not
paraphrased, not re-indented, not summarized. "newText" is the complete replacement text.
Make the smallest change that addresses the finding. Never propose a replacement outside
the given excerpt, and never propose more than one replacement per fingerprint.

Respond with ONLY a JSON object of this exact shape, no prose, no markdown fences:
{"dispositions":[{"fingerprint":"...","disposition":"fixed|false_positive|needs_human","reason":"..."}],"edits":[{"fingerprint":"...","oldText":"...","newText":"..."}]}`;

function stripFences(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : trimmed;
}

async function callFixerModel(modelCfg, excerptText, findings) {
  const extraBody = JSON.parse(modelCfg.extraBodyRaw || '{}');
  const userPrompt = `Findings:\n${JSON.stringify(findings.map((f) => ({ fingerprint: f.fingerprint, line: f.line, severity: f.severity, category: f.category, content: f.content })), null, 2)}\n\nExcerpt:\n${excerptText}`;
  const started = Date.now();
  const res = await fetch(modelCfg.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${modelCfg.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelCfg.model,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userPrompt }],
      response_format: { type: 'json_object' },
      ...extraBody,
    }),
  });
  const latencyMs = Date.now() - started;
  if (res.status === 429 || res.status === 503) return { malformed: false, throttled: true, latencyMs };
  if (!res.ok) return { malformed: true, throttled: false, latencyMs, error: `model http ${res.status}` };
  let body;
  try { body = await res.json(); } catch { return { malformed: true, throttled: false, latencyMs, error: 'non-JSON model transport response' }; }
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') return { malformed: true, throttled: false, latencyMs, error: 'no message content in model response' };
  let parsed;
  try { parsed = JSON.parse(stripFences(content)); } catch { return { malformed: true, throttled: false, latencyMs, error: 'model response is not valid JSON' }; }
  if (!Array.isArray(parsed.dispositions)) return { malformed: true, throttled: false, latencyMs, error: 'model response missing dispositions array' };
  return {
    malformed: false,
    throttled: false,
    latencyMs,
    dispositions: parsed.dispositions.filter((d) => d && typeof d.fingerprint === 'string' && ['fixed', 'false_positive', 'needs_human'].includes(d.disposition))
      .map((d) => ({ fingerprint: d.fingerprint, disposition: d.disposition, reason: String(d.reason ?? '').slice(0, 500) })),
    edits: Array.isArray(parsed.edits)
      ? parsed.edits.filter((e) => e && typeof e.fingerprint === 'string' && typeof e.oldText === 'string' && typeof e.newText === 'string')
      : [],
  };
}

// Bounded concurrent map over `items`, adapting width via clampConcurrency after every
// `checkpointSize` completions. Local safety clamps stay authoritative regardless of any
// per-item signal.
async function runWithAdaptiveConcurrency(items, worker, { initial = 3, max = 8, checkpointSize = 2 } = {}) {
  const results = new Array(items.length);
  let width = clampConcurrency(initial, { min: 1, max });
  let cursor = 0;
  let sinceCheckpoint = 0;
  let malformedStreak = 0;
  const widthLog = [{ at: 0, width }];

  async function runOne(index) {
    const outcome = await worker(items[index]);
    results[index] = outcome;
    sinceCheckpoint += 1;
    malformedStreak = outcome?.malformed ? malformedStreak + 1 : 0;
    if (sinceCheckpoint >= checkpointSize) {
      sinceCheckpoint = 0;
      const next = clampConcurrency(width, { min: 1, max, throttled: Boolean(outcome?.throttled), malformedStreak });
      if (next !== width) { width = next; widthLog.push({ at: index + 1, width }); }
    }
  }

  const inFlight = new Set();
  while (cursor < items.length || inFlight.size > 0) {
    while (inFlight.size < width && cursor < items.length) {
      const idx = cursor++;
      const p = runOne(idx).finally(() => inFlight.delete(p));
      inFlight.add(p);
    }
    if (inFlight.size > 0) await Promise.race(inFlight);
  }
  return { results, widthLog };
}

async function main() {
  const [, , inputPath] = process.argv;
  if (!inputPath || !existsSync(inputPath)) { console.error('usage: ocr-autofix-worker.mjs <input.json>'); process.exit(2); }
  const input = JSON.parse(readFileSync(inputPath, 'utf8'));
  const token = process.env.OCR_AUTOFIX_TOKEN_RESOLVED;
  if (!token) { console.error(JSON.stringify({ status: 'blocked', reason: 'OCR_AUTOFIX_TOKEN_RESOLVED not set in sandbox' })); process.exit(2); }
  const modelCfg = { ...input.model, token };
  const caps = { maxFindings: 80, maxFiles: 20, maxChangedLines: 250, contextLines: 80, maxExcerptChars: 24000, ...input.caps };
  const protectedPaths = input.protectedPaths ?? [];

  // Confirm we're on the exact reviewed SHA before touching anything.
  const currentSha = sh('git rev-parse HEAD');
  if (currentSha !== input.headSha) {
    console.log(JSON.stringify({ status: 'stale', reason: `checked out ${currentSha}, expected ${input.headSha}` }));
    process.exit(0);
  }

  // Findings over the per-round cap deterministically become needs_human, oldest excluded
  // first by (severity, file, line) so the same set is chosen if this round is retried.
  const rank = { critical: 0, high: 1, medium: 2, low: 3 };
  const sortedFindings = [...input.findings].sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9) || a.file.localeCompare(b.file) || a.line - b.line);
  const withinFindingCap = sortedFindings.slice(0, caps.maxFindings);
  const overFindingCap = sortedFindings.slice(caps.maxFindings);

  const byFile = new Map();
  const dispositionsByFingerprint = new Map();
  for (const f of overFindingCap) {
    dispositionsByFingerprint.set(f.fingerprint, { fingerprint: f.fingerprint, disposition: 'needs_human', reason: 'over the per-round finding cap' });
  }
  for (const f of withinFindingCap) {
    const relPath = f.file;
    if (!isPathSafe(relPath)) {
      dispositionsByFingerprint.set(f.fingerprint, { fingerprint: f.fingerprint, disposition: 'needs_human', reason: 'unsafe/traversal path' });
      continue;
    }
    if (isProtectedPath(relPath, protectedPaths)) {
      dispositionsByFingerprint.set(f.fingerprint, { fingerprint: f.fingerprint, disposition: 'needs_human', reason: 'protected path — human review required' });
      continue;
    }
    if (!byFile.has(relPath)) byFile.set(relPath, []);
    byFile.get(relPath).push(f);
  }

  const filesInOrder = [...byFile.keys()].slice(0, caps.maxFiles);
  const overFileCap = [...byFile.keys()].slice(caps.maxFiles);
  for (const relPath of overFileCap) {
    for (const f of byFile.get(relPath)) {
      dispositionsByFingerprint.set(f.fingerprint, { fingerprint: f.fingerprint, disposition: 'needs_human', reason: 'over the per-round file cap' });
    }
  }

  const modifiedFiles = [];
  const validationNotes = [];

  const { results } = await runWithAdaptiveConcurrency(filesInOrder, async (relPath) => {
    const fileFindings = byFile.get(relPath);
    if (!existsSync(relPath)) {
      for (const f of fileFindings) dispositionsByFingerprint.set(f.fingerprint, { fingerprint: f.fingerprint, disposition: 'needs_human', reason: 'file not present at reviewed SHA' });
      return { malformed: false, throttled: false };
    }
    const originalText = readFileSync(relPath, 'utf8');
    if (looksBinary(originalText)) {
      for (const f of fileFindings) dispositionsByFingerprint.set(f.fingerprint, { fingerprint: f.fingerprint, disposition: 'needs_human', reason: 'binary/generated file' });
      return { malformed: false, throttled: false };
    }

    const lineStarts = computeLineStarts(originalText);
    const excerptRanges = buildExcerptRanges(fileFindings, lineStarts, originalText.length, caps);
    const excerptText = excerptRanges.map((r) => extractExcerpt(originalText, r)).join('\n…\n');

    const outcome = await callFixerModel(modelCfg, excerptText, fileFindings);
    if (outcome.malformed || outcome.throttled) {
      for (const f of fileFindings) dispositionsByFingerprint.set(f.fingerprint, { fingerprint: f.fingerprint, disposition: 'needs_human', reason: outcome.error || 'model unavailable/throttled' });
      return outcome;
    }

    for (const d of outcome.dispositions) dispositionsByFingerprint.set(d.fingerprint, d);
    // Any finding in this file the model didn't address at all -> needs_human, never silent.
    for (const f of fileFindings) {
      if (!dispositionsByFingerprint.has(f.fingerprint)) {
        dispositionsByFingerprint.set(f.fingerprint, { fingerprint: f.fingerprint, disposition: 'needs_human', reason: 'model returned no disposition for this finding' });
      }
    }

    if (outcome.edits.length === 0) return outcome;

    const applied = validateAndApplyEdits(originalText, {
      dispositions: fileFindings.map((f) => dispositionsByFingerprint.get(f.fingerprint)),
      edits: outcome.edits,
      excerptRanges,
      maxChangedLines: caps.maxChangedLines,
    });
    if (!applied.ok) {
      validationNotes.push({ file: relPath, errors: applied.errors });
      // Validation failure demotes only the fingerprints that tried to claim 'fixed' — the
      // batch is rejected atomically, so none of this file's edits were applied.
      for (const f of fileFindings) {
        const d = dispositionsByFingerprint.get(f.fingerprint);
        if (d.disposition === 'fixed') dispositionsByFingerprint.set(f.fingerprint, { ...d, disposition: 'needs_human', reason: `edit validation failed: ${applied.errors[0]}` });
      }
      return outcome;
    }

    writeFileSync(relPath, applied.newText);
    modifiedFiles.push(relPath);
    return outcome;
  }, input.concurrency);

  const dispositions = [...dispositionsByFingerprint.values()];
  const fixedCount = dispositions.filter((d) => d.disposition === 'fixed').length;

  if (modifiedFiles.length === 0) {
    console.log(JSON.stringify({ status: 'evaluated', dispositions, validationNotes }));
    process.exit(0);
  }

  // Verify the diff touches only the planned files before we let anything near a commit.
  const changedInWorkingTree = sh('git diff --name-only').split('\n').filter(Boolean);
  const unexpected = changedInWorkingTree.filter((f) => !modifiedFiles.includes(f));
  if (unexpected.length > 0) {
    console.log(JSON.stringify({ status: 'blocked', reason: `unexpected files changed: ${unexpected.join(', ')}`, dispositions }));
    process.exit(1);
  }

  sh(`git add -- ${modifiedFiles.map((f) => JSON.stringify(f)).join(' ')}`);

  const gateResults = [];
  let gatesOk = true;
  for (const gate of input.gates ?? []) {
    try {
      execSync(gate, { encoding: 'utf8', stdio: 'pipe' });
      gateResults.push({ gate, ok: true });
    } catch (err) {
      const output = redact(`${err.stdout ?? ''}\n${err.stderr ?? ''}`.trim(), { limit: 2000 });
      gateResults.push({ gate, ok: false, output });
      gatesOk = false;
      break;
    }
  }

  if (!gatesOk) {
    sh('git checkout -- .');
    console.log(JSON.stringify({ status: 'validation_failed', gateResults, dispositions }));
    process.exit(1);
  }

  // Exact-head re-check immediately before publishing — a stale head stops the push.
  shTry('git fetch origin --quiet');
  const remoteHead = shTry(`git rev-parse origin/${input.headRef}`);
  if (remoteHead !== input.headSha) {
    sh('git reset --hard HEAD');
    console.log(JSON.stringify({ status: 'stale', reason: `remote head is ${remoteHead}, expected ${input.headSha}`, dispositions }));
    process.exit(0);
  }

  sh(`git -c user.name="nanobots-autofix" -c user.email="nanobots-autofix@users.noreply.github.com" commit -m ${JSON.stringify(`nanobots: OCR autofix — ${fixedCount} finding(s) repaired`)}`);
  sh(`git push origin HEAD:${input.headRef}`);
  const commitSha = sh('git rev-parse HEAD');

  console.log(JSON.stringify({ status: 'fixed', commitSha, gateResults, dispositions, modifiedFiles }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.log(JSON.stringify({ status: 'blocked', reason: String(err?.message ?? err).slice(0, 500) }));
    process.exit(1);
  });
}
