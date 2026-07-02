import { getConfig, saveConfig } from './gh.js';
import { r2Configured } from './storage.js';

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
})();

$('save').addEventListener('click', async () => {
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
