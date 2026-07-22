// Zero-dep unit tests for the OCR autofix responder's pure logic: the exact-edit engine,
// excerpt building, fingerprinting, review-event decision, and model config resolution.
// These are the safety-critical parts — no network/Daytona/live PR needed to verify them.
import assert from 'node:assert';
import {
  fingerprintFinding,
  computeLineStarts,
  mergeRanges,
  buildExcerptRanges,
  extractExcerpt,
  isPathSafe,
  isProtectedPath,
  DEFAULT_PROTECTED_PATHS,
  looksBinary,
  changedLineCount,
  findAllOffsets,
  validateAndApplyEdits,
  clampConcurrency,
  decideReviewEvent,
  resolveAutofixModelConfig,
  validateModelConfig,
  parseBoundedInt,
} from '../templates/nanobots/ocr-autofix-lib.mjs';
import {
  parseOcrOutput,
  buildReport,
  formatSummaryComment,
  formatInlineComments,
} from '../templates/nanobots/open-code-review-report.mjs';

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    console.error(`FAIL: ${name}`);
    throw err;
  }
}

// ── fingerprints ─────────────────────────────────────────────────────────────

test('fingerprint is deterministic (rerunning the same SHA is idempotent)', () => {
  const f = { file: 'src/a.js', line: 10, severity: 'high', category: 'bug', content: 'off by one' };
  assert.strictEqual(fingerprintFinding(f), fingerprintFinding({ ...f }));
});

test('fingerprint differs when content differs', () => {
  const base = { file: 'src/a.js', line: 10, severity: 'high', category: 'bug', content: 'off by one' };
  assert.notStrictEqual(fingerprintFinding(base), fingerprintFinding({ ...base, line: 11 }));
  assert.notStrictEqual(fingerprintFinding(base), fingerprintFinding({ ...base, content: 'different' }));
});

// ── line starts / excerpts ──────────────────────────────────────────────────

test('computeLineStarts finds every line start once', () => {
  const text = 'a\nbb\nccc\n';
  assert.deepStrictEqual(computeLineStarts(text), [0, 2, 5, 9]);
});

test('mergeRanges merges overlapping ranges', () => {
  assert.deepStrictEqual(mergeRanges([{ start: 0, end: 10 }, { start: 5, end: 15 }]), [{ start: 0, end: 15 }]);
});

test('mergeRanges merges exactly-adjacent half-open ranges', () => {
  assert.deepStrictEqual(mergeRanges([{ start: 0, end: 10 }, { start: 10, end: 20 }]), [{ start: 0, end: 20 }]);
});

test('mergeRanges does NOT merge a one-character gap', () => {
  assert.deepStrictEqual(
    mergeRanges([{ start: 0, end: 10 }, { start: 11, end: 20 }]),
    [{ start: 0, end: 10 }, { start: 11, end: 20 }],
  );
});

test('a source file larger than 30KB remains eligible via bounded excerpts', () => {
  const line = 'const x = 1; // padding padding padding padding padding\n';
  const bigText = line.repeat(1000); // well over 30KB
  assert.ok(Buffer.byteLength(bigText) > 30 * 1024);
  const lineStarts = computeLineStarts(bigText);
  const finding = { line: 500 };
  const ranges = buildExcerptRanges([finding], lineStarts, bigText.length, { contextLines: 10, maxExcerptChars: 2000 });
  assert.ok(ranges.length >= 1);
  const totalExcerptChars = ranges.reduce((sum, r) => sum + (r.end - r.start), 0);
  assert.ok(totalExcerptChars < bigText.length, 'excerpt must be smaller than the whole file');
  assert.ok(totalExcerptChars <= 2000 + 1, 'excerpt bounded by maxExcerptChars');
  const excerpt = extractExcerpt(bigText, ranges[0]);
  assert.ok(excerpt.length > 0 && excerpt.length <= bigText.length);
});

// ── path / binary safety ────────────────────────────────────────────────────

test('path traversal is rejected', () => {
  assert.strictEqual(isPathSafe('../../etc/passwd'), false);
  assert.strictEqual(isPathSafe('/etc/passwd'), false);
  assert.strictEqual(isPathSafe('src/../../secret'), false);
  assert.strictEqual(isPathSafe('src/app.js'), true);
});

test('protected paths (.github/**, .nanobots/**, lockfiles) fail closed to needs_human by default', () => {
  assert.strictEqual(isProtectedPath('.github/workflows/ci.yml', DEFAULT_PROTECTED_PATHS), true);
  assert.strictEqual(isProtectedPath('.nanobots/config.json', DEFAULT_PROTECTED_PATHS), true);
  assert.strictEqual(isProtectedPath('package-lock.json', DEFAULT_PROTECTED_PATHS), true);
  assert.strictEqual(isProtectedPath('src/app.js', DEFAULT_PROTECTED_PATHS), false);
});

test('binary content is detected', () => {
  assert.strictEqual(looksBinary('const a = 1;\nfunction f() {}\n'), false);
  assert.strictEqual(looksBinary(String.fromCharCode(0, 1, 2) + 'binary' + String.fromCharCode(0)), true);
});

// ── the atomic exact-edit engine ────────────────────────────────────────────

test('ambiguous/non-unique oldText is rejected against the complete file', () => {
  const text = 'x = 1\nx = 1\nx = 1\n';
  const result = validateAndApplyEdits(text, {
    dispositions: [{ fingerprint: 'f1', disposition: 'fixed' }],
    edits: [{ fingerprint: 'f1', oldText: 'x = 1', newText: 'x = 2' }],
    excerptRanges: [{ start: 0, end: text.length }],
  });
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('not unique')));
});

test('unique oldText is located and applied even if only found once in a bigger file', () => {
  const text = 'a\nb\nunique_target\nc\n';
  const result = validateAndApplyEdits(text, {
    dispositions: [{ fingerprint: 'f1', disposition: 'fixed' }],
    edits: [{ fingerprint: 'f1', oldText: 'unique_target', newText: 'fixed_value' }],
    excerptRanges: [{ start: 0, end: text.length }],
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.newText, 'a\nb\nfixed_value\nc\n');
});

test('multiple edits are located against immutable original source and applied in descending order', () => {
  const text = 'AAAA BBBB CCCC';
  const result = validateAndApplyEdits(text, {
    dispositions: [{ fingerprint: 'f1', disposition: 'fixed' }, { fingerprint: 'f2', disposition: 'fixed' }],
    edits: [
      { fingerprint: 'f1', oldText: 'AAAA', newText: 'A' },
      { fingerprint: 'f2', oldText: 'CCCC', newText: 'C' },
    ],
    excerptRanges: [{ start: 0, end: text.length }],
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.newText, 'A BBBB C');
  assert.deepStrictEqual(new Set(result.appliedEdits), new Set(['f1', 'f2']));
});

test('overlapping edits are rejected', () => {
  const text = 'function helper() { return 1; }';
  const result = validateAndApplyEdits(text, {
    dispositions: [{ fingerprint: 'f1', disposition: 'fixed' }, { fingerprint: 'f2', disposition: 'fixed' }],
    edits: [
      { fingerprint: 'f1', oldText: 'function helper()', newText: 'function helper2()' },
      { fingerprint: 'f2', oldText: 'helper() { return', newText: 'helper() { give' },
    ],
    excerptRanges: [{ start: 0, end: text.length }],
  });
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('overlap')));
});

test('one invalid replacement rolls back every edit for that file', () => {
  const text = 'valid_target\nsome other line\n';
  const dispositions = [{ fingerprint: 'f1', disposition: 'fixed' }, { fingerprint: 'f2', disposition: 'fixed' }];
  const result = validateAndApplyEdits(text, {
    dispositions,
    edits: [
      { fingerprint: 'f1', oldText: 'valid_target', newText: 'replaced' },
      { fingerprint: 'f2', oldText: 'does not exist anywhere', newText: 'x' },
    ],
    excerptRanges: [{ start: 0, end: text.length }],
  });
  assert.strictEqual(result.ok, false, 'the whole batch must be rejected, not just the bad edit');
});

test('an edit attached to a false_positive disposition is rejected without erasing the disposition', () => {
  const text = 'const risky = eval(input);\n';
  const dispositions = [{ fingerprint: 'f1', disposition: 'false_positive', reason: 'input is sanitized upstream' }];
  const result = validateAndApplyEdits(text, {
    dispositions,
    edits: [{ fingerprint: 'f1', oldText: 'eval(input)', newText: 'safeEval(input)' }],
    excerptRanges: [{ start: 0, end: text.length }],
  });
  assert.strictEqual(result.ok, false);
  // the caller's dispositions array/object must be untouched — the false_positive reason
  // survives even though the (erroneous) edit was rejected.
  assert.strictEqual(dispositions[0].disposition, 'false_positive');
  assert.strictEqual(dispositions[0].reason, 'input is sanitized upstream');
});

test('edits for unknown fingerprints are rejected', () => {
  const text = 'foo\n';
  const result = validateAndApplyEdits(text, {
    dispositions: [{ fingerprint: 'known', disposition: 'fixed' }],
    edits: [{ fingerprint: 'unknown', oldText: 'foo', newText: 'bar' }],
    excerptRanges: [{ start: 0, end: text.length }],
  });
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('unknown fingerprint')));
});

test('out-of-excerpt oldText is rejected even when unique in the file', () => {
  const text = 'aaaa unique_but_out_of_scope bbbb';
  const result = validateAndApplyEdits(text, {
    dispositions: [{ fingerprint: 'f1', disposition: 'fixed' }],
    edits: [{ fingerprint: 'f1', oldText: 'unique_but_out_of_scope', newText: 'x' }],
    excerptRanges: [{ start: 0, end: 4 }], // only "aaaa" was ever shown to the model
  });
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('outside the permitted excerpt')));
});

test('empty oldText and no-op edits are rejected', () => {
  const text = 'foo bar\n';
  const empty = validateAndApplyEdits(text, {
    dispositions: [{ fingerprint: 'f1', disposition: 'fixed' }],
    edits: [{ fingerprint: 'f1', oldText: '', newText: 'x' }],
    excerptRanges: [{ start: 0, end: text.length }],
  });
  assert.strictEqual(empty.ok, false);

  const noop = validateAndApplyEdits(text, {
    dispositions: [{ fingerprint: 'f1', disposition: 'fixed' }],
    edits: [{ fingerprint: 'f1', oldText: 'foo', newText: 'foo' }],
    excerptRanges: [{ start: 0, end: text.length }],
  });
  assert.strictEqual(noop.ok, false);
});

test('binary content in an edit is rejected', () => {
  const text = 'safe' + String.fromCharCode(0) + 'text';
  const result = validateAndApplyEdits(text, {
    dispositions: [{ fingerprint: 'f1', disposition: 'fixed' }],
    edits: [{ fingerprint: 'f1', oldText: 'safe' + String.fromCharCode(0) + 'text', newText: 'replacement' }],
    excerptRanges: [{ start: 0, end: text.length }],
  });
  assert.strictEqual(result.ok, false);
});

test('changed-line cap is enforced', () => {
  const oldText = Array.from({ length: 20 }, (_, i) => `line${i}`).join('\n');
  const newText = Array.from({ length: 20 }, (_, i) => `changed${i}`).join('\n');
  const text = `prefix\n${oldText}\nsuffix\n`;
  const capped = validateAndApplyEdits(text, {
    dispositions: [{ fingerprint: 'f1', disposition: 'fixed' }],
    edits: [{ fingerprint: 'f1', oldText, newText }],
    excerptRanges: [{ start: 0, end: text.length }],
    maxChangedLines: 5,
  });
  assert.strictEqual(capped.ok, false);
  assert.ok(capped.errors.some((e) => e.includes('exceeds cap')));

  const uncapped = validateAndApplyEdits(text, {
    dispositions: [{ fingerprint: 'f1', disposition: 'fixed' }],
    edits: [{ fingerprint: 'f1', oldText, newText }],
    excerptRanges: [{ start: 0, end: text.length }],
  });
  assert.strictEqual(uncapped.ok, true);
});

test('findAllOffsets finds every occurrence', () => {
  assert.deepStrictEqual(findAllOffsets('ababab', 'ab'), [0, 2, 4]);
  assert.deepStrictEqual(findAllOffsets('xyz', 'ab'), []);
});

// ── adaptive concurrency ─────────────────────────────────────────────────────

test('concurrency never exceeds max regardless of advisor input', () => {
  assert.strictEqual(clampConcurrency(3, { min: 1, max: 8, advisorSuggestion: 999 }), 8);
});

test('concurrency never drops below min', () => {
  assert.strictEqual(clampConcurrency(1, { min: 1, max: 8, advisorSuggestion: -50 }), 1);
});

test('throttling forces concurrency down regardless of advisor', () => {
  const result = clampConcurrency(6, { min: 1, max: 8, advisorSuggestion: 8, throttled: true });
  assert.ok(result < 6, 'throttled run must reduce width even if the advisor asked for more');
});

// ── review event decision ───────────────────────────────────────────────────

test('high/critical findings yield REQUEST_CHANGES', () => {
  assert.strictEqual(
    decideReviewEvent({ counts: { critical: 0, high: 1, medium: 0, low: 0 }, blockingSeverities: ['critical', 'high'], autoReviewEventsEnabled: true }),
    'REQUEST_CHANGES',
  );
});

test('clean findings yield APPROVE when auto review events are enabled', () => {
  assert.strictEqual(
    decideReviewEvent({ counts: { critical: 0, high: 0, medium: 0, low: 0 }, blockingSeverities: ['critical', 'high'], autoReviewEventsEnabled: true }),
    'APPROVE',
  );
});

test('OCR_AUTO_REVIEW_EVENTS=false yields COMMENT even when blocking', () => {
  assert.strictEqual(
    decideReviewEvent({ counts: { critical: 1 }, blockingSeverities: ['critical', 'high'], autoReviewEventsEnabled: false }),
    'COMMENT',
  );
});

test('a failed/parse-errored review always yields REQUEST_CHANGES, never APPROVE', () => {
  assert.strictEqual(
    decideReviewEvent({ counts: {}, blockingSeverities: ['critical', 'high'], autoReviewEventsEnabled: true, failed: true }),
    'REQUEST_CHANGES',
  );
});

// ── model configuration ──────────────────────────────────────────────────────

test('reviewer and fixer resolve independently when both are set', () => {
  const cfg = resolveAutofixModelConfig({
    OCR_LLM_MODEL: 'review-model', OCR_LLM_URL: 'https://review.example/v1',
    OCR_AUTOFIX_MODEL: 'fix-model', OCR_AUTOFIX_URL: 'https://fix.example/v1',
  });
  assert.strictEqual(cfg.model, 'fix-model');
  assert.strictEqual(cfg.url, 'https://fix.example/v1');
});

test('fixer model/URL fall back to reviewer settings, then safe defaults', () => {
  const fallsBackToReviewer = resolveAutofixModelConfig({ OCR_LLM_MODEL: 'review-model', OCR_LLM_URL: 'https://review.example/v1' });
  assert.strictEqual(fallsBackToReviewer.model, 'review-model');
  assert.strictEqual(fallsBackToReviewer.url, 'https://review.example/v1');

  const fallsBackToDefault = resolveAutofixModelConfig({});
  assert.strictEqual(fallsBackToDefault.model, 'deepseek-v4-flash');
  assert.strictEqual(fallsBackToDefault.url, 'https://api.deepseek.com/chat/completions');
});

test('OCR_AUTOFIX_TOKEN deliberately falls back to OCR_LLM_TOKEN', () => {
  const cfg = resolveAutofixModelConfig({ OCR_LLM_TOKEN: 'review-token' });
  assert.strictEqual(cfg.token, 'review-token');
});

test('separate provider credentials are respected when both are set', () => {
  const cfg = resolveAutofixModelConfig({ OCR_LLM_TOKEN: 'review-token', OCR_AUTOFIX_TOKEN: 'fix-token' });
  assert.strictEqual(cfg.token, 'fix-token');
});

test('malformed URL fails validation', () => {
  const result = validateModelConfig({ model: 'm', url: 'not a url', extraBodyRaw: '{}' });
  assert.strictEqual(result.ok, false);
});

test('non-https URL fails validation unless local-development mode is active', () => {
  const insecure = validateModelConfig({ model: 'm', url: 'http://example.com/v1', extraBodyRaw: '{}' });
  assert.strictEqual(insecure.ok, false);
  const localOk = validateModelConfig({ model: 'm', url: 'http://localhost:1234/v1', extraBodyRaw: '{}' }, { allowInsecureLocal: true });
  assert.strictEqual(localOk.ok, true);
});

test('malformed extra-body JSON fails validation', () => {
  const result = validateModelConfig({ model: 'm', url: 'https://example.com/v1', extraBodyRaw: '{not json' });
  assert.strictEqual(result.ok, false);
});

test('empty model identifier fails validation', () => {
  const result = validateModelConfig({ model: '', url: 'https://example.com/v1', extraBodyRaw: '{}' });
  assert.strictEqual(result.ok, false);
});

test('numeric bounds fall back safely on invalid input', () => {
  assert.strictEqual(parseBoundedInt('3', { min: 1, max: 8, fallback: 3 }), 3);
  assert.strictEqual(parseBoundedInt('not-a-number', { min: 1, max: 8, fallback: 3 }), 3);
  assert.strictEqual(parseBoundedInt('999', { min: 1, max: 8, fallback: 3 }), 3);
  assert.strictEqual(parseBoundedInt('-1', { min: 1, max: 8, fallback: 3 }), 3);
});

// ── report / verdict ─────────────────────────────────────────────────────────

test('malformed OCR output is never clean', () => {
  const { findings, parseError } = parseOcrOutput('{not valid json');
  assert.ok(parseError);
  const report = buildReport({ findings, parseError, headSha: 'x', blockingSeverities: ['critical', 'high'], autoReviewEventsEnabled: true });
  assert.strictEqual(report.clean, false);
  assert.strictEqual(report.cleanness, 0);
});

test('missing OCR output is never clean', () => {
  const { findings, parseError } = parseOcrOutput('');
  assert.ok(parseError);
  const report = buildReport({ findings, parseError, headSha: 'x', blockingSeverities: ['critical', 'high'], autoReviewEventsEnabled: true });
  assert.strictEqual(report.clean, false);
});

test('an empty findings array with no parse error is clean', () => {
  const { findings, parseError } = parseOcrOutput(JSON.stringify({ findings: [] }));
  assert.strictEqual(parseError, null);
  const report = buildReport({ findings, parseError, headSha: 'x', blockingSeverities: ['critical', 'high'], autoReviewEventsEnabled: true });
  assert.strictEqual(report.clean, true);
});

test('all findings remain in the machine-readable report even when display is capped', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ file: `f${i}.js`, line: i + 1, severity: 'low', category: 'style', content: `issue ${i}` }));
  const { findings, parseError } = parseOcrOutput(JSON.stringify({ findings: many }));
  const report = buildReport({ findings, parseError, headSha: 'x', blockingSeverities: ['critical', 'high'], autoReviewEventsEnabled: true });
  report.maxSummaryComments = 5;
  assert.strictEqual(report.findings.length, 30, 'full report must not be capped');
  const summary = formatSummaryComment(report);
  assert.ok(summary.includes('25 more finding'), 'display is capped and says so');
});

test('inline comments are bounded by OCR_MAX_INLINE_COMMENTS', () => {
  const many = Array.from({ length: 15 }, (_, i) => ({ file: `f${i}.js`, line: i + 1, severity: 'high', category: 'bug', content: `issue ${i}`, fingerprint: `fp${i}` }));
  const comments = formatInlineComments(many, { maxInlineComments: 10 });
  assert.strictEqual(comments.length, 10);
});

console.log(`ok — ${passed} ocr-autofix tests passed`);
