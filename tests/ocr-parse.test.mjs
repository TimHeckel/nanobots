// Regression test: parseOcrOutput must understand the JSON that Open Code Review ACTUALLY
// emits, captured from a real `ocr review --format json --audience agent` run (v1.7.12).
//
// WHY: the parser only read `parsed.findings[]` with a `file` key. Real OCR emits
// `parsed.comments[]` with `path` and `start_line`. Every finding was therefore dropped and
// the review reported no findings — a clean bill of health from a gate whose entire purpose
// is to block merges. Silently reporting "clean" is the worst possible failure mode here,
// strictly worse than crashing.

import { parseOcrOutput } from '../templates/nanobots/open-code-review-report.mjs';

let passed = 0;
const fails = [];
const ok = (c, l) => { if (c) passed++; else fails.push(l); };

// Verbatim shape from a live run (trimmed to two comments).
const REAL = JSON.stringify({
  status: 'success',
  summary: { files_reviewed: 2, comments: 2, total_tokens: 73307, elapsed: '2m0s' },
  tool_calls: { total: 4, by_tool: { code_comment: 1, file_read: 2 } },
  session_id: 'abc123',
  comments: [
    { path: '.github/workflows/nanobots-ocr.yml', content: 'Command injection risk', existing_code: 'x', start_line: 115, end_line: 115, category: 'security', severity: 'medium' },
    { path: '.github/workflows/nanobots-ocr.yml', content: 'Silent failure', existing_code: 'y', start_line: 112, end_line: 112, category: 'reliability', severity: 'medium' },
    { path: 'src/cli.mjs', content: 'Critical thing', start_line: 5, end_line: 5, category: 'security', severity: 'critical' },
  ],
});

{
  const r = parseOcrOutput(REAL);
  ok(r.parseError === null, `real OCR output parses without error (got: ${r.parseError})`);
  ok(r.findings.length === 3, `all three comments become findings (got ${r.findings.length})`);
  const f = r.findings[0];
  ok(f.file === '.github/workflows/nanobots-ocr.yml', 'maps `path` onto `file`');
  ok(f.line === 115, 'maps `start_line` onto `line`');
  ok(f.severity === 'medium', 'carries severity through');
  ok(f.category === 'security', 'carries category through');
  ok(typeof f.fingerprint === 'string' && f.fingerprint.length > 0, 'fingerprints each finding');
  ok(r.findings.some((x) => x.severity === 'critical'), 'a critical finding survives parsing — this is what blocks a merge');
}

// The legacy/agent shape must keep working.
{
  const legacy = JSON.stringify({ findings: [{ file: 'a.js', line: 3, severity: 'high', category: 'bug', content: 'boom' }] });
  const r = parseOcrOutput(legacy);
  ok(r.parseError === null && r.findings.length === 1, 'legacy findings[]/file shape still parses');
  ok(r.findings[0].file === 'a.js' && r.findings[0].line === 3, 'legacy fields map correctly');
}

// A bare array is also accepted.
ok(parseOcrOutput(JSON.stringify([{ path: 'b.js', start_line: 1, severity: 'low', content: 'x' }])).findings.length === 1,
  'a bare top-level array parses');

// Failure modes must stay LOUD — never silently clean.
ok(parseOcrOutput('').parseError !== null, 'empty output is an error, not a clean review');
ok(parseOcrOutput('   ').parseError !== null, 'whitespace-only output is an error');
ok(parseOcrOutput('not json').parseError !== null, 'malformed JSON is an error');
ok(parseOcrOutput(JSON.stringify({ status: 'success' })).parseError !== null,
  'valid JSON with no findings/comments array is an error, not a clean review');

// Entries the parser cannot trust are dropped rather than guessed at.
{
  const messy = JSON.stringify({ comments: [
    { path: 'a.js', severity: 'nonsense', content: 'x' },
    { severity: 'high', content: 'no path at all' },
    { path: 'ok.js', severity: 'high', content: 'good', start_line: 9 },
  ] });
  const r = parseOcrOutput(messy);
  ok(r.findings.length === 1 && r.findings[0].file === 'ok.js', 'unknown severities and path-less entries are dropped');
  ok(r.findings[0].line === 9, 'the surviving entry keeps its line');
}

// ── "nothing reviewable" is not the same as "review failed" ──────────────────
// A docs/YAML-only PR makes OCR exit 0 with empty output. Treating that as a failure blocks
// every documentation PR forever; treating an unknown or nonzero exit as clean would let a
// broken reviewer wave code through. The exit code is what separates them.
{
  const ranFine = parseOcrOutput('', { exitCode: 0 });
  ok(ranFine.parseError === null, 'exit 0 + empty output is NOT a failure (nothing reviewable)');
  ok(ranFine.noReviewableChanges === true, 'it is reported as noReviewableChanges');
  ok(ranFine.findings.length === 0, 'and carries no findings');

  const brokeAndExited = parseOcrOutput('', { exitCode: 1 });
  ok(brokeAndExited.parseError !== null, 'nonzero exit + empty output STAYS a failure');

  const unknown = parseOcrOutput('');
  ok(unknown.parseError !== null, 'unknown exit code stays conservative and blocks');
  ok(parseOcrOutput('   \n  ', { exitCode: 0 }).noReviewableChanges === true, 'whitespace-only output with exit 0 counts as nothing reviewable');
  // A successful exit must never launder malformed output into a clean review.
  ok(parseOcrOutput('not json', { exitCode: 0 }).parseError !== null, 'exit 0 does not excuse malformed JSON');
}

if (fails.length) {
  console.error(`FAILED ${fails.length}:`);
  for (const f of fails) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`ok — ${passed} ocr-parse tests passed`);

