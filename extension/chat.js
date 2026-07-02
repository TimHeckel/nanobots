import { getConfig } from './gh.js';
import { chatTurn, loadSystemPrompt } from './agent.js';
import { r2Configured } from './storage.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let cfg = null;
let system = null;
let history = [];      // Anthropic-format message history
let attachments = [];  // dataURLs pending for the next turn / file_report

function addMsg(cls, who, html) {
  const div = document.createElement('div');
  div.className = `msg ${cls}`;
  div.innerHTML = `<span class="who">${who}</span>${html}`;
  $('log').appendChild(div);
  $('log').scrollTop = $('log').scrollHeight;
  return div;
}

function renderAttachments() {
  $('attachments').innerHTML = attachments.map((a, i) => `
    <span class="thumb"><img src="${a}"><button data-i="${i}" title="remove">×</button></span>`).join('');
  for (const btn of $('attachments').querySelectorAll('button')) {
    btn.addEventListener('click', () => { attachments.splice(+btn.dataset.i, 1); renderAttachments(); });
  }
}

async function addAttachment(dataUrl) {
  if (!r2Configured(cfg?.r2)) {
    addMsg('agent', 'nanobots', 'Screenshots are disabled until you connect Cloudflare R2 — <a href="options.html">set it up in options</a> (free tier is plenty).');
    return;
  }
  attachments.push(dataUrl);
  renderAttachments();
}

// ── boot ─────────────────────────────────────────────────────────────────────

(async function boot() {
  cfg = await getConfig();
  if (!cfg.pat || cfg.repos.length === 0 || !cfg.ai.apiKey) {
    addMsg('agent', 'nanobots', 'Set your GitHub token, repos, and model key in <a href="options.html">options</a> first.');
    $('send').disabled = true;
    return;
  }
  $('repo').innerHTML = cfg.repos.map((r) => `<option>${esc(r)}</option>`).join('');
  $('repo').addEventListener('change', resetForRepo);
  await resetForRepo();

  // If a capture is pending from the icon click, offer it as an attachment
  const { pending } = await chrome.storage.session.get('pending');
  if (pending?.shot) await addAttachment(pending.shot);
})();

async function resetForRepo() {
  const nwo = $('repo').value;
  history = [];
  $('log').innerHTML = '';
  system = await loadSystemPrompt(cfg, nwo);
  const loopRefined = system.includes('Filing guidance');
  $('promptsrc').textContent = loopRefined ? 'agent prompt: loop-refined ✓' : 'agent prompt: built-in default';
  addMsg('agent', 'nanobots', `Connected to <b>${esc(nwo)}</b>. Ask me about the repo, or describe something to file.`);
}

// ── attachments: paste & drop ────────────────────────────────────────────────

document.addEventListener('paste', (e) => {
  for (const item of e.clipboardData?.items ?? []) {
    if (item.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => addAttachment(reader.result);
      reader.readAsDataURL(item.getAsFile());
    }
  }
});
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  for (const f of e.dataTransfer?.files ?? []) {
    if (f.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => addAttachment(reader.result);
      reader.readAsDataURL(f);
    }
  }
});

// ── send ─────────────────────────────────────────────────────────────────────

async function send() {
  const text = $('input').value.trim();
  if (!text && attachments.length === 0) return;
  $('send').disabled = true;
  $('input').value = '';

  const shownImgs = attachments.map((a) => `<img src="${a}">`).join('');
  addMsg('user', 'you', `${esc(text)}${shownImgs}`);

  const content = [
    ...attachments.map((a) => ({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: a.split(',')[1] },
    })),
    { type: 'text', text: text || '(see attached screenshot)' },
  ];
  history.push({ role: 'user', content });

  const turnAttachments = [...attachments];
  attachments = [];
  renderAttachments();

  try {
    history = await chatTurn(cfg, $('repo').value, system, history, turnAttachments, (ev) => {
      if (ev.kind === 'tool') {
        const arg = ev.input.query ?? ev.input.path ?? ev.input.title ?? '';
        addMsg('tool', '', `⚙ ${esc(ev.name)}${arg ? `: ${esc(String(arg))}` : ''}`);
      } else if (ev.kind === 'text') {
        addMsg('agent', 'nanobots', esc(ev.text).replace(
          /(https:\/\/github\.com\/\S+)/g,
          '<a href="$1" target="_blank">$1</a>',
        ));
      }
    });
  } catch (e) {
    addMsg('agent err', 'nanobots', `<span class="err">${esc(e.message)}</span>`);
    history.pop(); // drop the failed user turn so retry is clean
  }
  $('send').disabled = false;
  $('input').focus();
}

$('send').addEventListener('click', send);
$('input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send();
});
