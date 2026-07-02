import { getConfig, saveConfig } from './gh.js';

const $ = (id) => document.getElementById(id);

(async function boot() {
  const cfg = await getConfig();
  $('pat').value = cfg.pat;
  $('repos').value = cfg.repos.join('\n');
  $('storage').value = cfg.storageMode;
  $('r2account').value = cfg.r2.accountId;
  $('r2bucket').value = cfg.r2.bucket;
  $('r2token').value = cfg.r2.token;
  $('r2public').value = cfg.r2.publicBase;
  $('r2fields').hidden = cfg.storageMode !== 'r2';
  $('aikey').value = cfg.ai.apiKey;
  $('aibase').value = cfg.ai.baseUrl;
  $('aimodel').value = cfg.ai.model;
})();

$('storage').addEventListener('change', () => {
  $('r2fields').hidden = $('storage').value !== 'r2';
});

$('save').addEventListener('click', async () => {
  await saveConfig({
    pat: $('pat').value.trim(),
    repos: $('repos').value.split('\n').map((s) => s.trim()).filter(Boolean),
    storageMode: $('storage').value,
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
  $('saved').textContent = 'saved ✓';
  setTimeout(() => ($('saved').textContent = ''), 2000);
});
