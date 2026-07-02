// Tiny GitHub API client. Config lives in chrome.storage.local.

export async function getConfig() {
  const defaults = {
    pat: '',
    repos: [],
    storageMode: 'repo', // 'repo' | 'r2'
    r2: { accountId: '', bucket: '', token: '', publicBase: '' },
    // BYO model for the repo chat: Anthropic or any Anthropic-compatible endpoint
    ai: { apiKey: '', baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-5' },
  };
  const stored = await chrome.storage.local.get(Object.keys(defaults));
  return {
    ...defaults,
    ...stored,
    r2: { ...defaults.r2, ...(stored.r2 ?? {}) },
    ai: { ...defaults.ai, ...(stored.ai ?? {}) },
  };
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

export async function hydrateIssueState(pat, entries) {
  return Promise.all(entries.map(async (e) => {
    try {
      const live = await gh(pat, 'GET', `/repos/${e.nwo}/issues/${e.number}`);
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
