import { getConfig, saveConfig, GITHUB_OAUTH_CLIENT_ID, deviceFlowStart, deviceFlowPoll, listMyRepos } from './gh.js';
import { r2Configured, r2AutoSetup } from './storage.js';

function updateR2Status(cfg) {
  const el = document.getElementById('r2status');
  el.innerHTML = r2Configured(cfg.r2)
    ? '<span style="color:var(--accent)">✓ R2 connected — screenshot capture enabled</span>'
    : 'screenshot capture disabled — fill all four fields above';
}

const $ = (id) => document.getElementById(id);

(async function boot() {
  const cfg = await getConfig();
  $('pat').value = cfg.pat;
  $('repos').value = cfg.repos.join('\n');
  $('r2account').value = cfg.r2.accountId;
  $('r2bucket').value = cfg.r2.bucket;
  $('r2token').value = cfg.r2.token;
  $('r2public').value = cfg.r2.publicBase;
  $('aikey').value = cfg.ai.apiKey;
  $('aibase').value = cfg.ai.baseUrl;
  $('aimodel').value = cfg.ai.model;
  updateR2Status(cfg);
  $('gh-connect').hidden = !GITHUB_OAUTH_CLIENT_ID;
})();

// ── "connect with github" (OAuth device flow) ────────────────────────────────

$('gh-connect').addEventListener('click', async () => {
  const status = $('gh-status');
  try {
    const d = await deviceFlowStart();
    status.innerHTML = `Enter code <b style="color:var(--accent);font-size:16px">${d.user_code}</b> at <a href="${d.verification_uri}" target="_blank">${d.verification_uri}</a> — waiting…`;
    const token = await deviceFlowPoll(d.device_code, d.interval ?? 5, () => { status.textContent += '.'; });
    $('pat').value = token;
    status.innerHTML = '<span style="color:var(--accent)">✓ connected — token filled in (hit save)</span>';
  } catch (e) {
    status.innerHTML = `<span class="err">${e.message}</span>`;
  }
});

// ── "load my repos" chips ────────────────────────────────────────────────────

$('gh-loadrepos').addEventListener('click', async () => {
  const pat = $('pat').value.trim();
  if (!pat) { $('gh-status').textContent = 'paste or connect a token first'; return; }
  $('repo-chips').textContent = 'loading…';
  try {
    const repos = await listMyRepos(pat);
    const chosen = () => new Set($('repos').value.split('\n').map((s) => s.trim()).filter(Boolean));
    $('repo-chips').innerHTML = repos
      .filter((r) => !chosen().has(r))
      .map((r) => `<span class="chip" data-repo="${r}">+ ${r}</span>`).join('');
    for (const chip of $('repo-chips').querySelectorAll('.chip')) {
      chip.addEventListener('click', () => {
        $('repos').value = [...chosen(), chip.dataset.repo].join('\n');
        chip.remove();
      });
    }
  } catch (e) {
    $('repo-chips').innerHTML = `<span class="err">${e.message}</span>`;
  }
});

// ── "set up R2 for me" ───────────────────────────────────────────────────────

$('r2-setup').addEventListener('click', async () => {
  const status = $('r2-setup-status');
  const token = $('r2token-quick').value.trim() || $('r2token').value.trim();
  if (!token) { status.textContent = 'paste a Cloudflare API token first (guide above)'; return; }
  const bucket = $('r2bucket').value.trim() || 'nanobots-shots';
  try {
    const result = await r2AutoSetup(token, bucket, (msg) => { status.textContent = msg; }, $('r2account').value);
    $('r2account').value = result.accountId;
    $('r2bucket').value = result.bucket;
    $('r2token').value = result.token;
    $('r2public').value = result.publicBase;
    status.innerHTML = '<span style="color:var(--accent)">✓ all four fields filled — hit save</span>';
  } catch (e) {
    status.innerHTML = e.message === 'NEED_ACCOUNT_ID'
      ? '<span class="err">Couldn\'t auto-detect your account — paste your account id in the field below (it\'s on the R2 overview page / dashboard URL), then click again.</span>'
      : `<span class="err">${e.message}</span>`;
  }
});

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
  await saveConfig({
    pat: $('pat').value.trim(),
    repos: $('repos').value.split('\n').map((s) => s.trim()).filter(Boolean),
    r2: {
      accountId: $('r2account').value.trim(),
      bucket: $('r2bucket').value.trim(),
      token: $('r2token').value.trim(),
      publicBase: $('r2public').value.trim(),
    },
    ai: {
      apiKey: $('aikey').value.trim(),
      baseUrl: $('aibase').value.trim() || 'https://api.anthropic.com',
      model: $('aimodel').value.trim() || 'claude-sonnet-5',
    },
  });
  updateR2Status(await getConfig());
  $('saved').textContent = 'saved ✓';
  setTimeout(() => ($('saved').textContent = ''), 2000);
});
