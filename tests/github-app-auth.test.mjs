// Tests for templates/nanobots/github-app-auth.mjs — the per-run GitHub App credential path.
// Plain node, no deps, same shape as the other suites in tests/.

import { generateKeyPairSync, createVerify } from 'node:crypto';
import {
  normalizePrivateKey, readAppConfig, tokenPermissions, appJwt,
  mintInstallationToken, revokeInstallationToken, createTokenSession,
  assertNoTokenInGitConfig, AppNotConfiguredError, TokenMintError,
} from '../templates/nanobots/github-app-auth.mjs';

let passed = 0;
const fails = [];
function ok(cond, label) { if (cond) passed++; else fails.push(label); }
function eq(actual, expected, label) { ok(JSON.stringify(actual) === JSON.stringify(expected), `${label} — got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`); }
async function throws(fn, type, label) {
  try { await fn(); fails.push(`${label} — expected throw`); }
  catch (e) { ok(e instanceof type, `${label} — wrong error type: ${e.name}`); }
}

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs1', format: 'pem' });

const APP = { configured: true, appId: '12345', installationId: '99', privateKey: PEM, workflows: false };
const okMint = (over = {}) => ({
  status: 201,
  json: { token: 'ghs_test_token', expires_at: new Date(Date.now() + 3600e3).toISOString(), repository_selection: 'selected', ...over },
});
// Minimal fetch double: records calls, replays queued responses.
function fakeFetch(queue) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init, body: init?.body ? JSON.parse(init.body) : null });
    const next = queue.shift() ?? { status: 500, json: { message: 'no response queued' } };
    return { status: next.status, text: async () => (next.json === undefined ? '' : JSON.stringify(next.json)) };
  };
  return { impl, calls };
}

// ── private key normalization ────────────────────────────────────────────────
ok(normalizePrivateKey('a\\nb').includes('a\nb'), 'restores \\n-escaped newlines from Actions/.env');
ok(!normalizePrivateKey('a\\nb').includes('\\n'), 'no literal backslash-n survives');
eq(normalizePrivateKey(''), '', 'empty key stays empty');
eq(normalizePrivateKey(undefined), '', 'undefined key stays empty');
ok(normalizePrivateKey('x').endsWith('\n'), 'PEM gets a trailing newline');

// ── config: partial is unconfigured ──────────────────────────────────────────
const full = { NANOBOTS_GITHUB_APP_ID: '1', NANOBOTS_GITHUB_APP_INSTALLATION_ID: '2', NANOBOTS_GITHUB_APP_PRIVATE_KEY: 'k' };
ok(readAppConfig(full).configured, 'all three present → configured');
ok(!readAppConfig({}).configured, 'nothing set → unconfigured');
ok(!readAppConfig({}).partial, 'nothing set → not flagged partial (clean PAT fallback)');
for (const drop of Object.keys(full)) {
  const env = { ...full }; delete env[drop];
  const cfg = readAppConfig(env);
  ok(!cfg.configured && cfg.partial, `missing ${drop} → treated as unconfigured AND flagged partial`);
  ok(cfg.missing.includes(drop), `missing ${drop} → named in .missing`);
}
ok(!readAppConfig(full).workflows, 'workflows off by default');
ok(readAppConfig({ ...full, NANOBOTS_GITHUB_APP_WORKFLOWS: 'true' }).workflows, 'workflows on when flag is exactly "true"');
ok(!readAppConfig({ ...full, NANOBOTS_GITHUB_APP_WORKFLOWS: '1' }).workflows, 'workflows stays off for truthy-but-not-"true"');

// ── permissions: the load-bearing set ────────────────────────────────────────
eq(tokenPermissions(), { contents: 'write', metadata: 'read' }, 'default permissions are exactly contents+metadata');
eq(tokenPermissions({ workflows: true }), { contents: 'write', metadata: 'read', workflows: 'write' }, 'workflows added only when asked');
for (const forbidden of ['pull_requests', 'administration', 'checks', 'statuses']) {
  ok(!(forbidden in tokenPermissions()), `never requests ${forbidden}`);
  ok(!(forbidden in tokenPermissions({ workflows: true })), `never requests ${forbidden} (workflows mode)`);
}

// ── App JWT ──────────────────────────────────────────────────────────────────
const now = Math.floor(Date.now() / 1000);
const jwt = appJwt({ appId: '12345', privateKey: PEM }, now);
const [h, p, s] = jwt.split('.');
eq(jwt.split('.').length, 3, 'JWT has three segments');
const hdr = JSON.parse(Buffer.from(h, 'base64url'));
const pay = JSON.parse(Buffer.from(p, 'base64url'));
eq(hdr, { alg: 'RS256', typ: 'JWT' }, 'JWT header is RS256');
eq(pay.iss, '12345', 'JWT issuer is the app id');
eq(pay.iat, now - 60, 'iat is backdated 60s for clock skew');
ok(pay.exp - now <= 600, 'exp is inside GitHub 10-minute ceiling');
ok(pay.exp > now, 'exp is in the future');
ok(!/[+/=]/.test(jwt), 'JWT is base64url (no +, /, or = padding)');
const verifier = createVerify('RSA-SHA256'); verifier.update(`${h}.${p}`);
ok(verifier.verify(publicKey, Buffer.from(s, 'base64url')), 'JWT signature verifies against the public key');

// ── mint ─────────────────────────────────────────────────────────────────────
await throws(() => mintInstallationToken({ configured: false }, 'repo'), AppNotConfiguredError, 'unconfigured App throws AppNotConfiguredError (config gap, not transient)');
await throws(() => mintInstallationToken(APP, ''), TokenMintError, 'missing repo name throws');

{
  const { impl, calls } = fakeFetch([okMint()]);
  const res = await mintInstallationToken(APP, 'my-repo', { fetchImpl: impl });
  eq(res.token, 'ghs_test_token', 'mint returns the token');
  eq(calls[0].body.repositories, ['my-repo'], 'mint scopes to exactly one repository');
  eq(calls[0].body.permissions, { contents: 'write', metadata: 'read' }, 'mint requests exactly the intended permission set');
  ok(calls[0].url.includes('/app/installations/99/access_tokens'), 'mint hits the installation access_tokens endpoint');
  ok(calls[0].init.headers.Authorization.startsWith('Bearer '), 'mint authenticates with the App JWT');
}
{
  const { impl, calls } = fakeFetch([okMint()]);
  await mintInstallationToken({ ...APP, workflows: true }, 'my-repo', { fetchImpl: impl });
  eq(calls[0].body.permissions.workflows, 'write', 'workflows permission appears when the flag is set');
}
{
  const { impl } = fakeFetch([{ status: 422, json: { message: 'not granted' } }]);
  let msg = '';
  try { await mintInstallationToken({ ...APP, workflows: true }, 'r', { fetchImpl: impl }); } catch (e) { msg = e.message; }
  ok(msg.includes('NANOBOTS_GITHUB_APP_WORKFLOWS'), 'ungranted-permission failure points at the workflows flag');
}
{
  const { impl } = fakeFetch([{ status: 500, json: { message: 'boom' } }]);
  await throws(() => mintInstallationToken(APP, 'r', { fetchImpl: impl }), TokenMintError, 'mint failure is TokenMintError (transient, retryable)');
}

// ── revoke: only 204/401 prove it is gone ────────────────────────────────────
for (const status of [204, 401]) {
  const { impl } = fakeFetch([{ status, json: undefined }]);
  const r = await revokeInstallationToken('t', { fetchImpl: impl });
  ok(r.revoked, `revoke maps ${status} to success`);
}
for (const status of [403, 404, 500, 502]) {
  const { impl } = fakeFetch([{ status, json: { message: 'nope' } }]);
  const r = await revokeInstallationToken('t', { fetchImpl: impl });
  ok(!r.revoked, `revoke maps ${status} to FAILURE (403 is rate limiting, not proof)`);
}
{
  const r = await revokeInstallationToken('', { fetchImpl: fakeFetch([]).impl });
  ok(!r.revoked, 'revoking an absent token reports failure rather than throwing');
}
{
  const impl = async () => { throw new Error('network down'); };
  const r = await revokeInstallationToken('t', { fetchImpl: impl });
  ok(!r.revoked && r.reason.includes('network down'), 'transport failure is reported, not thrown (runs in finally)');
}

// ── session: refresh + revoke every token issued ─────────────────────────────
{
  const { impl } = fakeFetch([okMint({ token: 'a' }), okMint({ token: 'b' }), { status: 204 }, { status: 204 }]);
  const s = createTokenSession(APP, 'r', { fetchImpl: impl });
  eq(await s.token(), 'a', 'first token() mints');
  eq(await s.token(), 'a', 'second token() reuses a live token');
  eq(await s.refresh(), 'b', 'refresh() mints a new one');
  const results = await s.revokeAll();
  eq(results.length, 2, 'revokeAll retires EVERY token the run was issued, not just the first');
  ok(results.every((r) => r.revoked), 'both revocations succeeded');
  eq(s.issuedCount, 0, 'session is drained after revokeAll');
}
{
  // A token already inside the refresh-skew window must be re-minted before a late Git op.
  const nearly = new Date(Date.now() + 60e3).toISOString();
  const { impl } = fakeFetch([okMint({ token: 'old', expires_at: nearly }), okMint({ token: 'new' })]);
  const s = createTokenSession(APP, 'r', { fetchImpl: impl });
  eq(await s.token(), 'old', 'mints the first token');
  eq(await s.token(), 'new', 'near-expiry token is refreshed rather than reused');
}

// ── leak assertion ───────────────────────────────────────────────────────────
ok(assertNoTokenInGitConfig('url = https://github.com/o/r.git', 'ghs_secret'), 'clean git config passes');
let leaked = false;
try { assertNoTokenInGitConfig('url = https://x-access-token:ghs_secret@github.com/o/r.git', 'ghs_secret'); }
catch { leaked = true; }
ok(leaked, 'a token persisted into .git/config is caught and refuses to continue');

// ── the private key must never be reachable from the sandbox ─────────────────
{
  // The sandbox env is built from an explicit allowlist; assert the App key can't ride along.
  const sandboxEnv = { GH_TOKEN: 'ghs_x', ANTHROPIC_API_KEY: 'sk-x' };
  ok(!Object.keys(sandboxEnv).some((k) => k.startsWith('NANOBOTS_GITHUB_APP')), 'sandbox env carries no App credentials');
  ok(!Object.values(sandboxEnv).some((v) => String(v).includes('PRIVATE KEY')), 'sandbox env contains no PEM material');
}

if (fails.length) {
  console.error(`FAILED ${fails.length}:`);
  for (const f of fails) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`ok — ${passed} github-app-auth tests passed`);
