import { getConfig, saveConfig, GITHUB_OAUTH_CLIENT_ID, deviceFlowStart, deviceFlowPoll, reposForToken, isFineGrained } from './gh.js';
import { r2Configured, r2AutoSetup } from './storage.js';

const $ = (id) => document.getElementById(id);

let step = 1;
let lastPatByOwner = {}; // owner → token, rebuilt by discovery
let tokensDirty = false; // re-derive routing on save only when tokens changed

const parsePats = () => $('pats').value.split('\n').map((s) => s.trim()).filter(Boolean);
const parseRepos = () => $('repos').value.split('\n').map((s) => s.trim()).filter(Boolean);

// ── stepper ──────────────────────────────────────────────────────────────────

function stepDone(n, cfg) {
  if (n === 1) return Boolean((cfg.pats?.length || cfg.pat) && cfg.repos.length);
  if (n === 2) return r2Configured(cfg.r2);
  if (n === 3) return Boolean(cfg.ai.apiKey);
  return false;
}

async function paintRail() {
  const cfg = await getConfig();
  for (const li of document.querySelectorAll('#rail li')) {
    const n = Number(li.dataset.goto);
    li.classList.toggle('active', n === step);
    li.classList.toggle('done', n < 4 && stepDone(n, cfg));
  }
}

async function goto(n) {
  step = Math.min(4, Math.max(1, n));
  for (const sec of document.querySelectorAll('section[data-step]')) {
    sec.classList.toggle('active', Number(sec.dataset.step) === step);
  }
  $('back').style.visibility = step === 1 ? 'hidden' : 'visible';
  $('next').textContent = step === 4 ? 'save ✓' : 'save & continue →';
  if (step === 4) await paintReview();
  await paintRail();
}

document.querySelectorAll('#rail li').forEach((li) =>
  li.addEventListener('click', async () => { await persist(); goto(Number(li.dataset.goto)); }));
$('back').addEventListener('click', () => goto(step - 1));
$('next').addEventListener('click', async () => {
  await persist();
  $('saved').textContent = 'saved ✓';
  setTimeout(() => ($('saved').textContent = ''), 1500);
  if (step < 4) goto(step + 1);
  else paintReview();
});

async function paintReview() {
  const cfg = await getConfig();
  const owners = Object.keys(cfg.patByOwner ?? {}).length;
  $('rev-gh').innerHTML = stepDone(1, cfg)
    ? `<span class="ok">✓ ${cfg.repos.length} repos · ${owners} owner${owners === 1 ? '' : 's'}</span>`
    : '<span class="err">not connected — step 1</span>';
  $('rev-r2').innerHTML = stepDone(2, cfg)
    ? '<span class="ok">✓ connected — screenshots on</span>'
    : 'skipped — reports file text-only';
  $('rev-ai').innerHTML = stepDone(3, cfg)
    ? `<span class="ok">✓ ${cfg.ai.model}</span>`
    : 'skipped — chat disabled';
}

// ── persist (runs on every save & continue / rail jump) ─────────────────────

async function persist() {
  // Arbitrary OpenAI-compatible hosts need a runtime permission grant — and there can be TWO
  // of them, because the vision model may live at a different provider than the text model
  // (DeepSeek for text, Fireworks for screenshots, say). Granting only the primary meant the
  // vision call was blocked the moment someone pasted a screenshot, which is the one thing
  // this extension exists to do.
  const origins = [];
  for (const id of ['aibase', 'vbase']) {
    const value = $(id)?.value.trim();
    if (!value) continue;
    try { origins.push(new URL(value).origin + '/*'); } catch { /* not a URL yet */ }
  }
  const needed = [...new Set(origins)];
  if (needed.length) {
    try {
      const missing = [];
      for (const origin of needed) {
        if (!(await chrome.permissions.contains({ origins: [origin] }))) missing.push(origin);
      }
      // One prompt for everything missing rather than one per host.
      if (missing.length) await chrome.permissions.request({ origins: missing });
    } catch { /* declined — the calls themselves will surface it */ }
  }

  const pats = parsePats();
  if (tokensDirty && pats.length) {
    const { patByOwner } = await derive(pats);
    if (Object.keys(patByOwner).length) lastPatByOwner = patByOwner;
    tokensDirty = false;
  } else if (!pats.length) {
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
      // Optional second model used only for turns that carry a screenshot. Blank fields
      // fall back to the primary provider, so "same provider, bigger model" needs only
      // the model field — and a different provider entirely is equally supported.
      vision: {
        apiKey: $('vkey').value.trim(),
        baseUrl: $('vbase').value.trim(),
        model: $('vmodel').value.trim(),
      },
    },
  });
  await paintRail();
}

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
  $('vkey').value = cfg.ai.vision?.apiKey ?? '';
  $('vbase').value = cfg.ai.vision?.baseUrl ?? '';
  $('vmodel').value = cfg.ai.vision?.model ?? '';
  lastPatByOwner = cfg.patByOwner ?? {};
  $('gh-connect').hidden = !GITHUB_OAUTH_CLIENT_ID;
  // Reflect the saved base URL as a provider selection (without overwriting
  // the saved model); unknown base → Manual with fields shown.
  const match = Object.entries(PROVIDERS).find(([, p]) => p && p.base === cfg.ai.baseUrl);
  selectProvider(match ? match[0] : 'Manual', { fill: false });
  renderOrgLinks();
  // Land on the first incomplete step; fully configured → review.
  goto(stepDone(1, cfg) ? (stepDone(2, cfg) ? (stepDone(3, cfg) ? 4 : 3) : 2) : 1);
})();

$('pats').addEventListener('input', () => { tokensDirty = true; });

// ── model provider presets ───────────────────────────────────────────────────
// Picking a provider fills base URL + a multimodal default model; Manual
// reveals the base-url field. $('aibase')/$('aimodel') stay the source of truth.

const PROVIDERS = {
  Anthropic: { base: 'https://api.anthropic.com/v1', model: 'claude-sonnet-5', keys: 'https://console.anthropic.com/settings/keys' },
  OpenAI: { base: 'https://api.openai.com/v1', model: 'gpt-5.4-mini', keys: 'https://platform.openai.com/api-keys' },
  Google: { base: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash', keys: 'https://aistudio.google.com/apikey' },
  Grok: { base: 'https://api.x.ai/v1', model: 'grok-4', keys: 'https://console.x.ai' },
  OpenRouter: { base: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-sonnet-5', keys: 'https://openrouter.ai/settings/keys' },
  // nanobots' own shipped default — the same OpenAI-compatible provider `init` and the OCR
  // review run on (OCR_LLM_URL / OCR_LLM_MODEL). Cheap and good for text, but VERIFIED
  // text-only: it rejects image parts outright rather than degrading, so pair it with a
  // vision model below if you file screenshots.
  DeepSeek: { base: 'https://api.deepseek.com', model: 'deepseek-v4-flash', keys: 'https://platform.deepseek.com/api_keys', vision: false },
  // Verified multimodal (kimi-k3 reads screenshots correctly).
  Fireworks: { base: 'https://api.fireworks.ai/inference/v1', model: 'accounts/fireworks/models/kimi-k3', keys: 'https://fireworks.ai/account/api-keys' },
  Manual: null,
};

function selectProvider(name, { fill = true } = {}) {
  for (const b of document.querySelectorAll('#providers button')) {
    b.classList.toggle('selected', b.dataset.p === name);
  }
  const preset = PROVIDERS[name];
  $('manual-fields').hidden = Boolean(preset);
  // Screenshots are the point of this extension, so a text-only primary must not fail
  // silently at the moment someone pastes one — warn at configuration time instead.
  const warn = $('vision-warn');
  if (preset && preset.vision === false) {
    warn.innerHTML = `⚠️ <b>${name}</b> can't read images — it rejects screenshots outright. Set a vision model below (e.g. Fireworks <code>accounts/fireworks/models/kimi-k3</code>) or filing with a screenshot will fail.`;
    warn.hidden = false;
  } else {
    warn.hidden = true;
  }
  if (preset) {
    $('key-link').innerHTML = `<a href="${preset.keys}" target="_blank">get a${'AEIOU'.includes(name[0]) ? 'n' : ''} ${name} key ↗</a>`;
    if (fill) {
      $('aibase').value = preset.base;
      $('aimodel').value = preset.model;
    }
  } else {
    $('key-link').innerHTML = '';
  }
}

$('providers').innerHTML = Object.keys(PROVIDERS)
  .map((p) => `<button type="button" class="mini" data-p="${p}">${p}</button>`).join('');
for (const b of document.querySelectorAll('#providers button')) {
  b.addEventListener('click', () => selectProvider(b.dataset.p));
}

// ── token → repo discovery ───────────────────────────────────────────────────

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
  tokensDirty = false;
  $('repos').value = [...new Set([...parseRepos(), ...discovered])].join('\n');
  $('gh-status').innerHTML = [
    `<span class="ok">✓ ${discovered.length} repos across ${Object.keys(patByOwner).length} owner(s)</span>`,
    ...failures.map((f) => `<span class="err">${f}</span>`),
  ].join('<br>');
  renderOrgLinks();
  await persist();
});

// ── per-org token minting links (owners without a routed token get ↗) ────────

function renderOrgLinks() {
  const owners = [...new Set(parseRepos().map((r) => r.split('/')[0]).filter(Boolean))];
  $('org-links').innerHTML = !owners.length ? '' : 'per-org: ' + owners.map((o) => {
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
    status.innerHTML = `Enter code <b class="ok" style="font-size:16px">${d.user_code}</b> at <a href="${d.verification_uri}" target="_blank">${d.verification_uri}</a> — waiting…`;
    const token = await deviceFlowPoll(d.device_code, d.interval ?? 5, () => { status.textContent += '.'; });
    $('pats').value = [...new Set([...parsePats(), token])].join('\n');
    tokensDirty = true;
    status.innerHTML = '<span class="ok">✓ connected — now click "discover repos"</span>';
  } catch (e) {
    status.innerHTML = `<span class="err">${e.message}</span>`;
  }
});

// ── "set up R2 for me" ───────────────────────────────────────────────────────

$('r2-setup').addEventListener('click', async () => {
  const status = $('r2-setup-status');
  const token = $('r2token-quick').value.trim() || $('r2token').value.trim();
  if (!token) { status.textContent = 'paste a Cloudflare API token first (step b)'; return; }
  const bucket = $('r2bucket').value.trim() || 'nanobots-shots';
  try {
    const result = await r2AutoSetup(token, bucket, (msg) => { status.textContent = msg; }, $('r2account').value);
    $('r2account').value = result.accountId;
    $('r2bucket').value = result.bucket;
    $('r2token').value = result.token;
    $('r2public').value = result.publicBase;
    status.innerHTML = '<span class="ok">✓ screenshots enabled</span>';
    await persist();
  } catch (e) {
    status.innerHTML = e.message === 'NEED_ACCOUNT_ID'
      ? '<span class="err">Couldn\'t auto-detect your account — open "manual setup" below, paste your account id (it\'s on the R2 overview page), then click again.</span>'
      : `<span class="err">${e.message}</span>`;
  }
});
