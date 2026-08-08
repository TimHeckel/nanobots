// Drives the REAL repoHasLoop() from extension/gh.js against a stubbed GitHub.
//
// WHY: filing into a repo with no .nanobots/ is a silent no-op — the issue lands, the UI says
// "the loop takes it from here", and nothing ever triages it. The warning that fixes that is
// only as good as the check behind it, and the dangerous failure is a FALSE "missing": a
// token-scope problem or a rate limit must never be reported to the user as "no loop
// installed", because they would go install something that is already there.
//
// gh.js is a browser module, so this stubs the two globals it touches (chrome.storage.local
// and fetch) and imports the real file — no mirror of the logic.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const EXT = join(dirname(fileURLToPath(import.meta.url)), '..', 'extension');
let passed = 0;
const fails = [];
const ok = (c, l) => { if (c) passed++; else fails.push(l); };

// ── minimal chrome.storage.local ─────────────────────────────────────────────
let store = {};
globalThis.chrome = {
  storage: {
    local: {
      get: async (keys) => {
        const want = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
        return Object.fromEntries(want.filter((k) => k in store).map((k) => [k, store[k]]));
      },
      set: async (obj) => { Object.assign(store, obj); },
    },
  },
};

// ── stubbed GitHub ───────────────────────────────────────────────────────────
let calls = [];
let reply = { status: 200 };
globalThis.fetch = async (url, opts) => {
  calls.push({ url: String(url), auth: opts?.headers?.Authorization });
  if (reply.throw) throw new Error('network down');
  return { status: reply.status, ok: reply.status >= 200 && reply.status < 300, json: async () => ({}) };
};

const { repoHasLoop, INSTALL_CMD } = await import(pathToFileURL(join(EXT, 'gh.js')).href);
const reset = () => { store = {}; calls = []; };

// ── 1. the two definite answers ──────────────────────────────────────────────
reset(); reply = { status: 200 };
ok((await repoHasLoop('tok', 'acme/has-loop')) === true, '200 on .nanobots/config.json → installed');
ok(calls[0].url === 'https://api.github.com/repos/acme/has-loop/contents/.nanobots/config.json',
  'checks .nanobots/config.json, the marker every install writes');
ok(calls[0].auth === 'Bearer tok', 'sends the caller-supplied token');

reset(); reply = { status: 404 };
ok((await repoHasLoop('tok', 'acme/no-loop')) === false, '404 → not installed');

// ── 2. THE DANGEROUS CASE: ambiguity must never read as "missing" ────────────
for (const status of [401, 403, 429, 500, 502]) {
  reset(); reply = { status };
  const r = await repoHasLoop('tok', 'acme/x');
  ok(r === null, `${status} returns unknown, NOT false (a scope/limit error is not evidence of absence)`);
}
reset(); reply = { throw: true };
ok((await repoHasLoop('tok', 'acme/x')) === null, 'a network failure returns unknown, not false');

ok((await repoHasLoop('', 'acme/x')) === null, 'a missing token returns unknown, not false');
ok((await repoHasLoop('tok', '')) === null, 'a missing repo returns unknown, not false');

// ── 3. an ambiguous result must not destroy a known one ──────────────────────
reset(); reply = { status: 200 };
await repoHasLoop('tok', 'acme/r');                       // cache: installed
reply = { status: 500 };
ok((await repoHasLoop('tok', 'acme/r', { fresh: true })) === true,
  'a later 500 falls back to the cached answer rather than flipping to unknown');
ok(store.loopByRepo['acme/r'].ok === true, 'the cache is not overwritten by an ambiguous response');

// ── 4. caching ───────────────────────────────────────────────────────────────
reset(); reply = { status: 404 };
await repoHasLoop('tok', 'acme/c');
await repoHasLoop('tok', 'acme/c');
ok(calls.length === 1, 'a repeat check inside the TTL is served from cache (no second request)');
ok((await repoHasLoop('tok', 'acme/c', { fresh: true })) === false && calls.length === 2,
  'fresh:true bypasses the cache');

reset(); reply = { status: 404 };
await repoHasLoop('tok', 'acme/c');
store.loopByRepo['acme/c'].at = Date.now() - (7 * 60 * 60 * 1000); // older than the 6h TTL
reply = { status: 200 };
ok((await repoHasLoop('tok', 'acme/c')) === true, 'an expired entry is re-checked, so installs are noticed');

reset(); reply = { status: 200 };
await repoHasLoop('tok', 'acme/one');
reply = { status: 404 };
await repoHasLoop('tok', 'acme/two');
ok(store.loopByRepo['acme/one'].ok === true && store.loopByRepo['acme/two'].ok === false,
  'repos are cached independently');

// ── 5. every surface warns, and none of them lies ────────────────────────────
ok(INSTALL_CMD === 'curl -fsSL nanobots.sh/install | sh', 'the shared install command is the documented one');

const bg = readFileSync(join(EXT, 'background.js'), 'utf8');
ok(/repoHasLoop\([^)]*\)\.catch\(\(\) => null\)/.test(bg),
  'background.js cannot let the check fail a report that already filed successfully');
ok(bg.indexOf('createIssue(') < bg.indexOf('repoHasLoop('),
  'the check runs AFTER the issue is created, never gating it');

for (const [file, label] of [['overlay.js', 'in-page overlay'], ['annotate.js', 'fallback tab']]) {
  const src = readFileSync(join(EXT, file), 'utf8');
  const claim = /the loop (takes it from here|will triage it)/;
  ok(claim.test(src), `${label} still has its success message`);
  // The success line must be inside a branch, i.e. it must not be reachable when loop===false.
  const idx = src.search(claim);
  const guarded = /loop === false/.test(src.slice(0, idx));
  ok(guarded, `${label} only claims "the loop takes it from here" after ruling out a missing loop`);
  ok(/nanobots\.sh\/install|INSTALL_CMD/.test(src), `${label} shows the install command when the loop is missing`);
}

// A successful file must never offer a "retry" that would just create a duplicate issue.
const overlay = readFileSync(join(EXT, 'overlay.js'), 'utf8');
const okBranch = overlay.slice(overlay.indexOf('if (resp?.ok)'), overlay.indexOf('} else {', overlay.indexOf('if (resp?.ok)')));
ok(!/btn\.disabled = false/.test(okBranch),
  'the overlay never re-enables "file it" after a successful file (a retry would duplicate the issue)');

// ── 6. the options review must not invert the normal case ───────────────────
// "discover repos" fills in every reachable repo, so most having no loop is EXPECTED.
// Reporting that as a deficiency (and listing ~93 repo names) buried the useful fact.
const opts = readFileSync(join(EXT, 'options.js'), 'utf8');
ok(!/missing on \$\{/.test(opts) && !/missing on ' \+/.test(opts),
  'the review reports which repos DO run the loop, not a count of those that do not');
ok(/withLoop\.map/.test(opts) && !/without\.map/.test(opts),
  'only loop-enabled repos are listed by name; the majority without are never enumerated');
ok(/none of \$\{cfg\.repos\.length\}/.test(opts),
  'zero loop-enabled repos is still flagged — that case really is broken');
// A cap would silently misreport "none" whenever the loop repo fell outside it.
ok(/Math\.min\(8, cfg\.repos\.length\)/.test(opts),
  'checks are throttled rather than fired all at once');
ok(!/slice\(0,\s*\d+\)/.test(opts.slice(opts.indexOf('paintLoopStatus'), opts.indexOf('const esc'))),
  'no silent cap on how many repos get checked');

// ── 7. tokens are not left sitting in cleartext ──────────────────────────────
const html = readFileSync(join(EXT, 'options.html'), 'utf8');
ok(/-webkit-text-security/.test(html), 'the token field is masked with text-security');
ok(/id="pats"[^>]*class="secret"/.test(html), 'the PAT textarea starts masked');
ok(/data-reveals="pats"/.test(html), 'there is a reveal toggle so tokens can still be verified');
for (const id of ['r2token', 'aikey', 'vkey', 'r2token-quick']) {
  ok(new RegExp(`id="${id}"[^>]*type="password"`).test(html), `${id} is a password field`);
}

if (fails.length) {
  console.error(`\n${fails.length} FAILED:`);
  for (const f of fails) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`ok — ${passed} loop-detection tests passed`);
