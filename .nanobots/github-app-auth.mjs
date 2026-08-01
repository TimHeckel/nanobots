// nanobots:engine-owned v0.1 — re-rendered by `nanobots update`
//
// Per-run GitHub App credentials for the Daytona worker.
//
// THE POINT: the sandbox gets a short-lived, repository-scoped installation token that can
// clone and push and NOTHING ELSE. It deliberately does not carry `pull_requests`, so a
// sandbox that outlives its run — or a prompt-injected agent inside one — can push commits
// to a branch nobody is watching, and that is the whole blast radius. It cannot open a PR,
// modify an existing one, merge, forge a check/status, or mint another credential.
//
// This module runs in the CONTROLLER only (daytona-worker.mjs / Actions). The App private
// key must never be readable from inside the sandbox: if the controller and the worker share
// an env file or a mounted secret, the worker can mint its own tokens with the App's full
// permission set and this entire scheme is decorative.
//
// Honest limits — see .nanobots/RUNTIMES.md "GitHub App credentials":
//   • `contents: write` is REPOSITORY-WIDE, not ref-scoped. GitHub has no ref-scoped
//     installation token. Branch protection and required checks are what contain a stray
//     push — not this token's scope.
//   • Revocation is EVENTUALLY CONSISTENT. Measured against live GitHub: after
//     DELETE /installation/token returned 204, the token still worked at ~2s and was
//     rejected by ~7s. Treat revocation as defence in depth, not as a fence.

import { createSign } from 'node:crypto';

const API = 'https://api.github.com';
const GH_HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'nanobots-worker',
};

// A missing App is a CONFIG GAP worth failing loudly on; a failed mint is TRANSIENT and must
// be retried. Conflating them means a brief GitHub outage permanently strands every task.
export class AppNotConfiguredError extends Error {
  constructor(message) { super(message); this.name = 'AppNotConfiguredError'; }
}
export class TokenMintError extends Error {
  constructor(message, status) { super(message); this.name = 'TokenMintError'; this.status = status; }
}

// ── configuration ────────────────────────────────────────────────────────────

// Actions secrets and .env files both mangle real newlines into the two-character escape
// `\n`, which makes the PEM unparseable by node:crypto. Restore them.
export function normalizePrivateKey(raw) {
  if (!raw) return '';
  let key = String(raw).trim();
  if (key.includes('\\n')) key = key.replace(/\\n/g, '\n');
  return key ? `${key.replace(/\n+$/, '')}\n` : '';
}

// A partially configured App is treated as UNCONFIGURED: a half-finished setup must not
// half-enable the path. `partial` is surfaced so the caller can warn loudly rather than
// silently falling back to the PAT and leaving the operator thinking the App is live.
export function readAppConfig(env = process.env) {
  const appId = (env.NANOBOTS_GITHUB_APP_ID || '').trim();
  const installationId = (env.NANOBOTS_GITHUB_APP_INSTALLATION_ID || '').trim();
  const privateKey = normalizePrivateKey(env.NANOBOTS_GITHUB_APP_PRIVATE_KEY);

  const fields = { NANOBOTS_GITHUB_APP_ID: appId, NANOBOTS_GITHUB_APP_INSTALLATION_ID: installationId, NANOBOTS_GITHUB_APP_PRIVATE_KEY: privateKey };
  const missing = Object.entries(fields).filter(([, v]) => !v).map(([k]) => k);

  if (missing.length === 3) return { configured: false, partial: false, missing };
  if (missing.length > 0) return { configured: false, partial: true, missing };

  return {
    configured: true,
    partial: false,
    missing: [],
    appId,
    installationId,
    privateKey,
    // Opt-in ONLY. Requesting a permission the installation was not granted fails the WHOLE
    // mint — every token request, every run — so this stays off until an org owner has
    // approved the expanded grant on the installation itself.
    workflows: env.NANOBOTS_GITHUB_APP_WORKFLOWS === 'true',
  };
}

// `pull_requests` is deliberately absent, and is the load-bearing decision of this module.
// Administration / checks / statuses are never requested: a worker must not be able to forge
// its own review gate.
export function tokenPermissions({ workflows = false } = {}) {
  const permissions = { contents: 'write', metadata: 'read' };
  if (workflows) permissions.workflows = 'write';
  return permissions;
}

// ── App JWT ──────────────────────────────────────────────────────────────────

const base64url = (input) =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// `iat` is backdated 60s to absorb clock skew between us and GitHub (a JWT from the future is
// rejected outright); `exp` stays well inside GitHub's 10-minute ceiling.
export function appJwt({ appId, privateKey }, nowSeconds = Math.floor(Date.now() / 1000)) {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({ iat: nowSeconds - 60, exp: nowSeconds + 540, iss: String(appId) }));
  const signingInput = `${header}.${payload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  const signature = signer.sign(privateKey).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${signingInput}.${signature}`;
}

// ── bounded HTTP ─────────────────────────────────────────────────────────────

// `fetch` resolves as soon as headers arrive — GitHub can send headers and then stall the
// body indefinitely. The timer therefore stays armed across the body read and is cleared in a
// `finally` AFTER parsing, not after `await fetch`.
async function ghFetch(url, init, { timeoutMs = 15000, fetchImpl = fetch } = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { ...init, signal: ac.signal });
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { /* non-JSON error page */ }
    return { status: res.status, body, text };
  } finally {
    clearTimeout(timer);
  }
}

// ── mint / revoke ────────────────────────────────────────────────────────────

// `repo` is the SHORT repository name, not owner/repo. Scoping to a single repository keeps a
// leaked token narrow even when the App is installed across many.
export async function mintInstallationToken(app, repo, opts = {}) {
  if (!app?.configured) throw new AppNotConfiguredError('GitHub App is not configured');
  if (!repo) throw new TokenMintError('repository name required to scope the token');

  const jwt = appJwt(app);
  const { status, body, text } = await ghFetch(
    `${API}/app/installations/${app.installationId}/access_tokens`,
    {
      method: 'POST',
      headers: { ...GH_HEADERS, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ repositories: [repo], permissions: tokenPermissions({ workflows: app.workflows }) }),
    },
    opts,
  );

  if (status !== 201 || !body?.token) {
    const detail = body?.message ?? (text || '').slice(0, 200);
    // The most common cause of a blanket mint failure is requesting a permission the
    // installation was never granted — point at it rather than making the operator guess.
    const hint = app.workflows ? ' (NANOBOTS_GITHUB_APP_WORKFLOWS=true requires an org owner to grant Workflows: write on the installation first)' : '';
    throw new TokenMintError(`installation token mint failed: ${status} ${detail}${hint}`, status);
  }

  return {
    token: body.token,
    expiresAt: body.expires_at ?? null,
    permissions: body.permissions ?? null,
    repositorySelection: body.repository_selection ?? null,
  };
}

// Only 204 (accepted) and 401 (already dead) PROVE the token is gone. 403 does NOT: GitHub
// returns it for rate limiting while the token stays perfectly valid, so treating 403 as
// success would log a revocation that never happened.
export async function revokeInstallationToken(token, opts = {}) {
  if (!token) return { revoked: false, status: 0, reason: 'no token' };
  let status = 0;
  try {
    ({ status } = await ghFetch(`${API}/installation/token`, {
      method: 'DELETE',
      headers: { ...GH_HEADERS, Authorization: `Bearer ${token}` },
    }, opts));
  } catch (err) {
    // This runs in a `finally` on the controller's exit path — an unanswered request must not
    // wedge the run, so a transport failure is reported, not thrown.
    return { revoked: false, status: 0, reason: err.message };
  }
  if (status === 204 || status === 401) return { revoked: true, status };
  return { revoked: false, status, reason: `unexpected status ${status} — token may still be live` };
}

// ── per-run session ──────────────────────────────────────────────────────────

// Installation tokens last an hour; a build can take longer. Rather than reusing a token that
// may have expired mid-run, callers ask for one before each Git operation and get a fresh mint
// whenever the current one is near expiry. Every token the run was issued is tracked so
// revokeAll() can retire all of them — not just the first.
export function createTokenSession(app, repo, opts = {}) {
  const refreshSkewMs = opts.refreshSkewMs ?? 5 * 60 * 1000;
  const issued = [];
  let current = null;

  const expired = () => {
    if (!current) return true;
    if (!current.expiresAt) return false;
    return Date.parse(current.expiresAt) - Date.now() <= refreshSkewMs;
  };

  return {
    get issuedCount() { return issued.length; },

    // Fresh mint when we have nothing or the current token is near expiry; otherwise reuse.
    async token() {
      if (expired()) return this.refresh();
      return current.token;
    },

    async refresh() {
      const minted = await mintInstallationToken(app, repo, opts);
      issued.push(minted.token);
      current = minted;                 // newest working token becomes the fallback
      return minted.token;
    },

    async revokeAll() {
      const results = [];
      for (const token of issued) results.push({ ...(await revokeInstallationToken(token, opts)) });
      issued.length = 0;
      current = null;
      return results;
    },
  };
}

// ── leak assertions ──────────────────────────────────────────────────────────

// The token is passed as a Git credential for one command; it must not be left behind in the
// clone. Call this with the output of `git config --local --list` after cloning.
export function assertNoTokenInGitConfig(gitConfigText, token) {
  if (!token || !gitConfigText) return true;
  if (gitConfigText.includes(token)) {
    throw new Error('SECURITY: the installation token was persisted into .git/config inside the sandbox — refusing to continue');
  }
  return true;
}
