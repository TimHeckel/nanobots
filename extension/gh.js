// Tiny GitHub API client. Config lives in chrome.storage.local.

export async function getConfig() {
  const defaults = {
    pat: '',
    // Fine-grained PATs are limited to ONE resource owner (user or org), so
    // multi-org use needs one token per org: { "SleeperHitStudio": "github_pat_…" }.
    // tokenFor() picks by the repo's owner, falling back to `pat`.
    patByOwner: {},
    repos: [],
    r2: { accountId: '', bucket: '', token: '', publicBase: '' },
    // BYO model for the repo chat: any OpenAI-compatible endpoint. Default is
    // Anthropic's OpenAI-compat layer so an Anthropic key works out of the box.
    ai: { apiKey: '', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-sonnet-5' },
  };
  const stored = await chrome.storage.local.get(Object.keys(defaults));
  return {
    ...defaults,
    ...stored,
    r2: { ...defaults.r2, ...(stored.r2 ?? {}) },
    ai: { ...defaults.ai, ...(stored.ai ?? {}) },
  };
}

export function tokenFor(cfg, nwo) {
  const owner = (nwo ?? '').split('/')[0];
  return cfg.patByOwner?.[owner] || cfg.pat;
}

export async function saveConfig(cfg) {
  await chrome.storage.local.set(cfg);
}

async function gh(pat, method, path, body) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(`${method} ${path} → ${res.status}: ${detail.message ?? 'unknown error'}`);
  }
  return res.json();
}

export const ghPut = (pat, path, body) => gh(pat, 'PUT', path, body);

// ── GitHub sign-in (OAuth device flow — the only secretless flow, so it works
// with no server). Requires a registered OAuth App with device flow enabled;
// its client id is public by design. Empty string hides the Connect button.
export const GITHUB_OAUTH_CLIENT_ID = '';

export async function deviceFlowStart() {
  const res = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ client_id: GITHUB_OAUTH_CLIENT_ID, scope: 'repo' }),
  });
  if (!res.ok) throw new Error(`device flow start → ${res.status}`);
  return res.json(); // { device_code, user_code, verification_uri, interval, expires_in }
}

export async function deviceFlowPoll(deviceCode, intervalSec, onTick) {
  for (let waited = 0; waited < 900; waited += intervalSec) {
    await new Promise((r) => setTimeout(r, intervalSec * 1000));
    onTick?.();
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        client_id: GITHUB_OAUTH_CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });
    const j = await res.json();
    if (j.access_token) return j.access_token;
    if (j.error === 'slow_down') intervalSec += 5;
    else if (j.error !== 'authorization_pending') throw new Error(j.error_description ?? j.error);
  }
  throw new Error('sign-in timed out');
}

// Repos a token can actually reach. For fine-grained PATs this is exactly the
// granted set; for classic tokens it's everything accessible (callers cap it).
export async function reposForToken(token) {
  const r = await gh(token, 'GET', '/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member');
  return r.map((x) => x.full_name);
}

export const isFineGrained = (token) => token.startsWith('github_pat_');

export async function listMyRepos(pat) {
  const r = await gh(pat, 'GET', '/user/repos?sort=pushed&per_page=30&type=owner');
  const member = await gh(pat, 'GET', '/user/repos?sort=pushed&per_page=30&affiliation=organization_member').catch(() => []);
  const names = [...r, ...member].map((x) => x.full_name);
  return [...new Set(names)];
}

export async function defaultBranch(pat, nwo) {
  return (await gh(pat, 'GET', `/repos/${nwo}`)).default_branch;
}

export async function createIssue(pat, nwo, { title, body, labels }) {
  return gh(pat, 'POST', `/repos/${nwo}/issues`, { title, body, labels });
}

// ── history ──────────────────────────────────────────────────────────────────

export async function logFiledIssue(entry) {
  const { filed = [] } = await chrome.storage.local.get('filed');
  filed.unshift(entry); // { nwo, number, title, url, type, page, filedAt }
  await chrome.storage.local.set({ filed: filed.slice(0, 500) });
}

export async function getFiledIssues() {
  const { filed = [] } = await chrome.storage.local.get('filed');
  return filed;
}

export async function hydrateIssueState(cfg, entries) {
  return Promise.all(entries.map(async (e) => {
    try {
      const live = await gh(tokenFor(cfg, e.nwo), 'GET', `/repos/${e.nwo}/issues/${e.number}`);
      return { ...e, state: live.state, labels: live.labels.map((l) => l.name), comments: live.comments };
    } catch {
      return { ...e, state: 'unknown', labels: [], comments: 0 };
    }
  }));
}

// ── repo tools for the agent chat ────────────────────────────────────────────

export async function searchCode(pat, nwo, query) {
  const r = await gh(pat, 'GET', `/search/code?q=${encodeURIComponent(`${query} repo:${nwo}`)}&per_page=10`);
  return r.items.map((i) => ({ path: i.path, url: i.html_url }));
}

export async function readFile(pat, nwo, path) {
  const r = await gh(pat, 'GET', `/repos/${nwo}/contents/${path}`);
  if (r.encoding !== 'base64') return '(not a text file)';
  const text = new TextDecoder().decode(Uint8Array.from(atob(r.content.replace(/\n/g, '')), (c) => c.charCodeAt(0)));
  return text.length > 30000 ? text.slice(0, 30000) + '\n…(truncated)' : text;
}

export async function searchIssues(pat, nwo, query) {
  const r = await gh(pat, 'GET', `/search/issues?q=${encodeURIComponent(`${query} repo:${nwo}`)}&per_page=15`);
  return r.items.map((i) => ({
    number: i.number,
    title: i.title,
    state: i.state,
    is_pr: !!i.pull_request,
    labels: i.labels.map((l) => l.name),
    url: i.html_url,
    snippet: (i.body ?? '').slice(0, 300),
  }));
}

export async function listTree(pat, nwo, branch) {
  const r = await gh(pat, 'GET', `/repos/${nwo}/git/trees/${branch}?recursive=1`);
  const paths = r.tree.filter((t) => t.type === 'blob').map((t) => t.path);
  return paths.length > 2000 ? paths.slice(0, 2000).concat(['…(truncated)']) : paths;
}
