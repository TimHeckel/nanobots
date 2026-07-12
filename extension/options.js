import { getConfig, saveConfig, GITHUB_OAUTH_CLIENT_ID, deviceFlowStart, deviceFlowPoll, reposForToken, isFineGrained } from './gh.js';
import { r2Configured, r2AutoSetup } from './storage.js';

const $ = (id) => document.getElementById(id);

let lastPatByOwner = {}; // owner → token, rebuilt by discovery

function updateR2Status(cfg) {
  const el = $('r2status');
  el.innerHTML = r2Configured(cfg.r2)
    ? '<span style="color:var(--accent)">✓ R2 connected — screenshot capture enabled</span>'
    : 'screenshot capture disabled — connect cloudflare above';
}

const parsePats = () => $('pats').value.split('\n').map((s) => s.trim()).filter(Boolean);
const parseRepos = () => $('repos').value.split('\n').map((s) => s.trim()).filter(Boolean);

// ── boot ─────────────────────────────────────────────────────────────────────

(async function boot() {
  const cfg = await getConfig();
  const pats = cfg.pats?.length
    ? cfg.pats
    : [...new Set([cfg.pat, ...Object.values(cfg.patByOwner ?? {})])].filter(Boolean);
  $('pats').value = pats.join('\n');
  $('repos').value = cfg.repos.join('\n');
  $('r2account').value = cfg.r2.accountId;
  $('r2bucket').value = cfg.r2.bucket;
  $('r2token').value = cfg.r2.token;
  $('r2public').value = cfg.r2.publicBase;
  $('aikey').value = cfg.ai.apiKey;
  $('aibase').value = cfg.ai.baseUrl;
  $('aimodel').value = cfg.ai.model;
  lastPatByOwner = cfg.patByOwner ?? {};
  updateR2Status(cfg);
  $('gh-connect').hidden = !GITHUB_OAUTH_CLIENT_ID;
  renderOrgLinks();
})();

// ── token → repo discovery ───────────────────────────────────────────────────
// Each token is asked what it can reach; fine-grained grants are exact, classic
// tokens are capped to recent repos. Fine-grained wins owner routing conflicts.

async function derive(pats, onStatus) {
  const patByOwner = {};
  const discovered = [];
  const failures = [];
  const ordered = [...pats].sort((a, b) => Number(isFineGrained(a)) - Number(isFineGrained(b)));
  for (const token of ordered) {
    onStatus?.(`checking token …${token.slice(-4)}`);
    try {
      const names = await reposForToken(token);
      const usable = isFineGrained(token) ? names : names.slice(0, 15);
      for (const n of usable) patByOwner[n.split('/')[0]] = token;
      discovered.push(...usable);
    } catch (e) {
      failures.push(`…${token.slice(-4)}: ${e.message}`);
    }
  }
  return { patByOwner, discovered: [...new Set(discovered)], failures };
}

$('gh-discover').addEventListener('click', async () => {
  const pats = parsePats();
  if (!pats.length) { $('gh-status').textContent = 'paste at least one token first'; return; }
  const { patByOwner, discovered, failures } = await derive(pats, (m) => { $('gh-status').textContent = m; });
  lastPatByOwner = patByOwner;
  $('repos').value = [...new Set([...parseRepos(), ...discovered])].join('\n');
  $('gh-status').innerHTML = [
    `<span style="color:var(--accent)">✓ ${discovered.length} repos across ${Object.keys(patByOwner).length} owner(s) — prune the list, then save</span>`,
    ...failures.map((f) => `<span class="err">${f}</span>`),
  ].join('<br>');
  renderOrgLinks();
});

// ── per-org token minting links (owners without a routed token get ↗) ────────

function renderOrgLinks() {
  const owners = [...new Set(parseRepos().map((r) => r.split('/')[0]).filter(Boolean))];
  $('org-links').innerHTML = !owners.length ? '' : 'per-org tokens: ' + owners.map((o) => {
    const url = `https://github.com/settings/personal-access-tokens/new?name=nanobots%20(${encodeURIComponent(o)})&target_name=${encodeURIComponent(o)}&issues=write&contents=read&description=Files%20reports%20from%20the%20nanobots%20browser%20extension`;
    return `<a href="${url}" target="_blank">${o}${lastPatByOwner[o] ? ' ✓' : ' ↗'}</a>`;
  }).join(' · ');
}
$('repos').addEventListener('input', renderOrgLinks);

// ── "connect with github" (OAuth device flow) ────────────────────────────────

$('gh-connect').addEventListener('click', async () => {
  const status = $('gh-status');
  try {
    const d = await deviceFlowStart();
    status.innerHTML = `Enter code <b style="color:var(--accent);font-size:16px">${d.user_code}</b> at <a href="${d.verification_uri}" target="_blank">${d.verification_uri}</a> — waiting…`;
    const token = await deviceFlowPoll(d.device_code, d.interval ?? 5, () => { status.textContent += '.'; });
    $('pats').value = [...new Set([...parsePats(), token])].join('\n');
    status.innerHTML = '<span style="color:var(--accent)">✓ connected — token added; click "discover repos"</span>';
  } catch (e) {
    status.innerHTML = `<span class="err">${e.message}</span>`;
  }
});

// ── R2 tabs ──────────────────────────────────────────────────────────────────

for (const tab of document.querySelectorAll('.r2tab')) {
  tab.addEventListener('click', () => {
    for (const t of document.querySelectorAll('.r2tab')) t.classList.toggle('active', t === tab);
    $('r2tab-quick').hidden = tab.dataset.tab !== 'quick';
    $('r2tab-manual').hidden = tab.dataset.tab !== 'manual';
  });
}

// ── "set up R2 for me" ───────────────────────────────────────────────────────

$('r2-setup').addEventListener('click', async () => {
  const status = $('r2-setup-status');
  const token = $('r2token-quick').value.trim() || $('r2token').value.trim();
  if (!token) { status.textContent = 'paste a Cloudflare API token first (step 1)'; return; }
  const bucket = $('r2bucket').value.trim() || 'nanobots-shots';
  try {
    const result = await r2AutoSetup(token, bucket, (msg) => { status.textContent = msg; }, $('r2account').value);
    $('r2account').value = result.accountId;
    $('r2bucket').value = result.bucket;
    $('r2token').value = result.token;
    $('r2public').value = result.publicBase;
    status.innerHTML = '<span style="color:var(--accent)">✓ all set — hit save</span>';
  } catch (e) {
    status.innerHTML = e.message === 'NEED_ACCOUNT_ID'
      ? '<span class="err">Couldn\'t auto-detect your account — paste your account id on the manual tab (it\'s on the R2 overview page / dashboard URL), then click again.</span>'
      : `<span class="err">${e.message}</span>`;
  }
});

// ── save ─────────────────────────────────────────────────────────────────────

$('save').addEventListener('click', async () => {
  // Arbitrary OpenAI-compatible hosts need a runtime permission grant
  // (static grants cover github/cloudflare/anthropic).
  try {
    const base = $('aibase').value.trim();
    if (base) {
      const origin = new URL(base).origin + '/*';
      const has = await chrome.permissions.contains({ origins: [origin] });
      if (!has) await chrome.permissions.request({ origins: [origin] });
    }
  } catch { /* invalid URL or user declined — save proceeds; calls will surface it */ }

  const pats = parsePats();
  // Re-derive routing silently so edits to the token list can't leave stale routes.
  if (pats.length) {
    const { patByOwner } = await derive(pats);
    if (Object.keys(patByOwner).length) lastPatByOwner = patByOwner;
  } else {
    lastPatByOwner = {};
  }

  await saveConfig({
    pats,
    pat: pats[0] ?? '',
    patByOwner: lastPatByOwner,
    repos: parseRepos(),
    r2: {
      accountId: $('r2account').value.trim(),
      bucket: $('r2bucket').value.trim(),
      token: $('r2token').value.trim(),
      publicBase: $('r2public').value.trim(),
    },
    ai: {
      apiKey: $('aikey').value.trim(),
      baseUrl: $('aibase').value.trim() || 'https://api.anthropic.com/v1',
      model: $('aimodel').value.trim() || 'claude-sonnet-5',
    },
  });
  updateR2Status(await getConfig());
  renderOrgLinks();
  $('saved').textContent = 'saved ✓';
  setTimeout(() => ($('saved').textContent = ''), 2000);
});
