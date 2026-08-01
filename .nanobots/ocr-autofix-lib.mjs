// nanobots:engine-owned v0.1 — re-rendered by `nanobots update`
//
// Pure, framework-free logic shared by the OCR report and the autofix worker: excerpt
// building, fingerprinting, the atomic exact-edit engine, the concurrency governor, and
// the review-event decision. No network/fs/process calls — everything here is a
// deterministic function of its arguments so it can be unit tested directly (see
// tests/ocr-autofix.test.mjs) without a live OCR run, model, or Daytona sandbox.
//
// This module is the safety-critical core of the autofix responder: it is the only code
// path allowed to decide whether a proposed replacement is safe to apply. Nothing outside
// this file should slice/splice source text.

import { createHash } from 'node:crypto';

// ── fingerprints ─────────────────────────────────────────────────────────────

// Stable within one report (one exact head SHA): same file/line/severity/category/content
// always hashes the same, so rerunning a review on the same SHA is idempotent and reply
// markers (`nanobots:ocr-responder-reply:<fingerprint>:<source-sha>`) stay addressable.
// Deliberately excludes anything positional beyond the reported line, since that's the
// only "location" OCR gives us — a later round on a NEW SHA gets a fresh finding set and
// fresh fingerprints naturally, so cross-round drift is not a concern.
export function fingerprintFinding(finding) {
  const basis = [finding.file, finding.line, finding.severity, finding.category, finding.content]
    .map((v) => String(v ?? ''))
    .join('');
  return createHash('sha256').update(basis).digest('hex').slice(0, 16);
}

// ── line/offset math ─────────────────────────────────────────────────────────

// starts[i] = character offset where line (i+1) begins. Line numbers from OCR are 1-based.
export function computeLineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') starts.push(i + 1);
  }
  return starts;
}

function lineStartOffset(lineStarts, line1Based) {
  const idx = Math.min(Math.max(line1Based, 1), lineStarts.length) - 1;
  return lineStarts[idx];
}

// ── excerpt ranges ───────────────────────────────────────────────────────────

// Half-open [start, end) intervals. Sorted, merges when next.start <= prior.end — i.e.
// overlapping OR exactly touching (zero-width gap) ranges merge into one. A genuine
// one-character gap (next.start === prior.end + 1) does NOT merge: that character is
// simply not part of either finding's context and stays outside the sent excerpt.
export function mergeRanges(ranges) {
  const sorted = [...ranges]
    .filter((r) => r && Number.isFinite(r.start) && Number.isFinite(r.end) && r.end > r.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [];
  for (const r of sorted) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) {
      last.end = Math.max(last.end, r.end);
    } else {
      merged.push({ start: r.start, end: r.end });
    }
  }
  return merged;
}

// One finding-centered range per finding (context lines around the reported line, capped
// to maxExcerptChars), then merged. No file-size gate: a large file just means the merge
// step produces more/larger ranges, never a whole-file send — bounded excerpts only.
export function buildExcerptRanges(findings, lineStarts, textLength, { contextLines = 80, maxExcerptChars = 24000 } = {}) {
  const totalLines = lineStarts.length;
  const raw = findings
    .filter((f) => Number.isInteger(f.line) && f.line >= 1)
    .map((f) => {
      const centerLine = Math.min(f.line, totalLines);
      const startLine = Math.max(1, centerLine - contextLines);
      const endLine = Math.min(totalLines, centerLine + contextLines);
      let start = lineStartOffset(lineStarts, startLine);
      let end = endLine < totalLines ? lineStartOffset(lineStarts, endLine + 1) : textLength;
      if (end - start > maxExcerptChars) {
        const center = lineStartOffset(lineStarts, centerLine);
        const half = Math.floor(maxExcerptChars / 2);
        start = Math.max(0, center - half);
        end = Math.min(textLength, start + maxExcerptChars);
      }
      return { start: Math.max(0, start), end: Math.min(textLength, end) };
    });
  return mergeRanges(raw);
}

export function extractExcerpt(text, range) {
  return text.slice(range.start, range.end);
}

// ── path / content safety ───────────────────────────────────────────────────

export function isPathSafe(relPath) {
  if (typeof relPath !== 'string' || relPath.length === 0) return false;
  if (relPath.startsWith('/') || relPath.includes('\0')) return false;
  if (/^[a-zA-Z]:[\\/]/.test(relPath)) return false; // absolute Windows-style path
  const parts = relPath.split(/[\\/]/);
  if (parts.some((p) => p === '..' || p === '.git')) return false;
  return true;
}

// `pattern` supports a `prefix/**` (anything under prefix) or bare `prefix` (exact or
// nested) glob-lite shape — enough for the default protected-surface list without pulling
// in a glob dependency.
export function isProtectedPath(relPath, patterns) {
  return (patterns ?? []).some((pattern) => {
    if (pattern.endsWith('/**')) {
      const prefix = pattern.slice(0, -3);
      return relPath === prefix || relPath.startsWith(`${prefix}/`);
    }
    return relPath === pattern || relPath.startsWith(`${pattern}/`);
  });
}

export const DEFAULT_PROTECTED_PATHS = [
  '.github/**',
  '.nanobots/**',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'package.json',
  'Gemfile.lock',
  'go.sum',
  'Cargo.lock',
];

export function looksBinary(text) {
  if (typeof text !== 'string') return true;
  if (text.includes(String.fromCharCode(0))) return true;
  const sample = text.slice(0, 8000);
  if (sample.length === 0) return false;
  let nonPrintable = 0;
  for (const ch of sample) {
    const code = ch.codePointAt(0);
    if (code < 9 || (code > 13 && code < 32)) nonPrintable++;
  }
  return nonPrintable / sample.length > 0.05;
}

// Conservative (over-counting) added+deleted line estimate for one replacement — good
// enough for a cap check, not meant to match `git diff` exactly.
export function changedLineCount(oldText, newText) {
  return oldText.split('\n').length + newText.split('\n').length;
}

// ── the atomic exact-edit engine ────────────────────────────────────────────

export function findAllOffsets(haystack, needle) {
  const offsets = [];
  if (!needle) return offsets;
  let from = 0;
  for (;;) {
    const idx = haystack.indexOf(needle, from);
    if (idx === -1) break;
    offsets.push(idx);
    from = idx + 1;
  }
  return offsets;
}

// dispositions: [{fingerprint, disposition: 'fixed'|'false_positive'|'needs_human', reason}]
// edits:        [{fingerprint, oldText, newText}]  — proposed only for 'fixed' fingerprints
// excerptRanges: the exact ranges sent to the model for this file — an edit whose oldText
//                lands outside all of them is rejected as out-of-scope even if it happens
//                to be unique in the file.
//
// Returns { ok: true, newText, appliedEdits: [fingerprint, ...] }
//      or { ok: false, errors: [string, ...] } — ANY invalid edit rejects the WHOLE batch
// for this file; dispositions are never mutated, so a false_positive/needs_human reason
// survives even when the file's edit batch is rejected.
export function validateAndApplyEdits(originalText, { dispositions, edits, excerptRanges, maxChangedLines } = {}) {
  const errors = [];
  const dispByFp = new Map((dispositions ?? []).map((d) => [d.fingerprint, d]));

  const candidates = [];
  for (const edit of edits ?? []) {
    const disp = dispByFp.get(edit.fingerprint);
    if (!disp) { errors.push(`edit references unknown fingerprint ${edit.fingerprint}`); continue; }
    if (disp.disposition !== 'fixed') { errors.push(`edit attached to fingerprint ${edit.fingerprint} has disposition '${disp.disposition}', not 'fixed'`); continue; }
    if (typeof edit.oldText !== 'string' || edit.oldText.length === 0) { errors.push(`edit for ${edit.fingerprint} has empty oldText`); continue; }
    if (typeof edit.newText !== 'string') { errors.push(`edit for ${edit.fingerprint} has non-string newText`); continue; }
    if (edit.oldText === edit.newText) { errors.push(`edit for ${edit.fingerprint} has newText identical to oldText`); continue; }
    if (edit.oldText.includes(String.fromCharCode(0)) || edit.newText.includes(String.fromCharCode(0))) { errors.push(`edit for ${edit.fingerprint} touches binary content`); continue; }
    candidates.push(edit);
  }
  if (errors.length) return { ok: false, errors };

  const located = [];
  for (const edit of candidates) {
    const occurrences = findAllOffsets(originalText, edit.oldText);
    if (occurrences.length === 0) { errors.push(`oldText for ${edit.fingerprint} not found in the original file`); continue; }
    if (occurrences.length > 1) { errors.push(`oldText for ${edit.fingerprint} is not unique in the original file (${occurrences.length} occurrences)`); continue; }
    const start = occurrences[0];
    const end = start + edit.oldText.length;
    const inExcerpt = (excerptRanges ?? []).some((r) => start >= r.start && end <= r.end);
    if (!inExcerpt) { errors.push(`oldText for ${edit.fingerprint} falls outside the permitted excerpt`); continue; }
    located.push({ ...edit, start, end });
  }
  if (errors.length) return { ok: false, errors };

  const byStart = [...located].sort((a, b) => a.start - b.start);
  for (let i = 1; i < byStart.length; i++) {
    if (byStart[i].start < byStart[i - 1].end) {
      errors.push(`edits for ${byStart[i - 1].fingerprint} and ${byStart[i].fingerprint} overlap`);
    }
  }
  if (errors.length) return { ok: false, errors };

  if (typeof maxChangedLines === 'number') {
    const total = located.reduce((sum, e) => sum + changedLineCount(e.oldText, e.newText), 0);
    if (total > maxChangedLines) errors.push(`total changed lines ${total} exceeds cap ${maxChangedLines}`);
  }
  if (errors.length) return { ok: false, errors };

  const descending = [...located].sort((a, b) => b.start - a.start);
  let newText = originalText;
  for (const edit of descending) {
    newText = newText.slice(0, edit.start) + edit.newText + newText.slice(edit.end);
  }

  return { ok: true, newText, appliedEdits: located.map((e) => e.fingerprint) };
}

// ── adaptive concurrency governor ───────────────────────────────────────────

// The advisor (model or heuristic) only ever SUGGESTS; min/max and the throttle/malformed
// penalties are authoritative. Never called to decide whether a finding is real or a patch
// is safe — scheduling width only.
export function clampConcurrency(current, { min = 1, max = 8, advisorSuggestion, throttled = false, malformedStreak = 0 } = {}) {
  let next = Number.isFinite(advisorSuggestion) ? advisorSuggestion : current;
  if (throttled) next = Math.min(next, Math.floor(current / 2));
  if (malformedStreak >= 2) next = Math.min(next, current - 1);
  next = Math.round(next);
  return Math.max(min, Math.min(max, next));
}

// ── model configuration precedence + validation ─────────────────────────────

// explicit workflow_dispatch input -> GitHub variable/secret -> safe rendered default.
// The dispatch-input layer is applied by the caller before this (workflow_dispatch inputs
// arrive as plain env overrides in the YAML); this resolves the variable/secret -> default
// chain, including the fixer's deliberate fallback to the reviewer's settings.
export function resolveAutofixModelConfig(env = {}) {
  return {
    model: env.OCR_AUTOFIX_MODEL || env.OCR_LLM_MODEL || 'deepseek-v4-flash',
    url: env.OCR_AUTOFIX_URL || env.OCR_LLM_URL || 'https://api.deepseek.com/chat/completions',
    token: env.OCR_AUTOFIX_TOKEN || env.OCR_LLM_TOKEN || '',
    extraBodyRaw: env.OCR_AUTOFIX_EXTRA_BODY || env.OCR_LLM_EXTRA_BODY || '{"thinking":{"type":"disabled"}}',
  };
}

// Model IDs are endpoint-specific — validated for shape/safety only, never against a
// hardcoded global enum.
export function validateModelConfig({ model, url, extraBodyRaw }, { allowInsecureLocal = false } = {}) {
  const errors = [];
  if (typeof model !== 'string' || model.length === 0 || model.length > 200) errors.push('model identifier invalid');
  else if (!/^[\x20-\x7e]+$/.test(model)) errors.push('model identifier has unsafe characters');

  let parsedUrl = null;
  try { parsedUrl = new URL(url); } catch { errors.push('url is not a valid URL'); }
  if (parsedUrl && parsedUrl.protocol !== 'https:') {
    if (!(allowInsecureLocal && (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1'))) {
      errors.push('url must be https unless local-development mode is active');
    }
  }

  try {
    const parsed = JSON.parse(extraBodyRaw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) errors.push('extra body must be a JSON object');
  } catch { errors.push('extra body is not valid JSON'); }

  return { ok: errors.length === 0, errors };
}

// Fail-safe numeric bound parsing for GitHub-variable-sourced tuning knobs: an
// out-of-range or non-integer value never throws, it just falls back to the safe default.
export function parseBoundedInt(raw, { min = 0, max = Number.MAX_SAFE_INTEGER, fallback } = {}) {
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) return fallback;
  return n;
}

// ── review event decision ───────────────────────────────────────────────────

export function decideReviewEvent({ counts, blockingSeverities, autoReviewEventsEnabled = true, failed = false }) {
  if (!autoReviewEventsEnabled) return 'COMMENT';
  if (failed) return 'REQUEST_CHANGES';
  const blocking = new Set(blockingSeverities ?? ['critical', 'high']);
  const hasBlocking = Object.entries(counts ?? {}).some(([sev, n]) => blocking.has(sev) && n > 0);
  return hasBlocking ? 'REQUEST_CHANGES' : 'APPROVE';
}
