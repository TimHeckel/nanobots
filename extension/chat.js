import { getConfig } from './gh.js';
import { chatTurn, loadSystemPrompt } from './agent.js';
import { r2Configured } from './storage.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let cfg = null;
let system = null;
let history = [];      // Anthropic-format message history
let attachments = [];  // dataURLs pending for the next turn / file_report

// Minimal Markdown → HTML. Deliberately tiny and zero-dependency, and it ALWAYS escapes
// first so model output can never inject markup: every transform below runs over
// already-escaped text and only ever introduces tags this function itself wrote.
function md(raw) {
  let s = esc(raw);
  const fences = [];
  // Pull fenced blocks out before anything else so their contents stay literal.
  s = s.replace(/```([a-z]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    fences.push(`<pre><code>${code.replace(/\n$/, '')}</code></pre>`);
    return `\u0000FENCE${fences.length - 1}\u0000`;
  });
  s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  s = s.replace(/^\s*#{3,6}\s*(.+)$/gm, '<h4>$1</h4>');
  s = s.replace(/^\s*#{1,2}\s*(.+)$/gm, '<h3>$1</h3>');
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  // Bare URLs and [text](url), restricted to http(s) so javascript: can never slip through.
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank">$2</a>');
  // Lists: group consecutive markers into one <ul>/<ol>.
  s = s.replace(/(?:^\s*[-*+]\s+.+(?:\n|$))+/gm, (block) =>
    '<ul>' + block.trim().split('\n').map((l) => `<li>${l.replace(/^\s*[-*+]\s+/, '')}</li>`).join('') + '</ul>');
  s = s.replace(/(?:^\s*\d+\.\s+.+(?:\n|$))+/gm, (block) =>
    '<ol>' + block.trim().split('\n').map((l) => `<li>${l.replace(/^\s*\d+\.\s+/, '')}</li>`).join('') + '</ol>');
  // Remaining blank-line-separated runs become paragraphs; single newlines become breaks.
  s = s.split(/\n{2,}/).map((chunk) =>
    /^\s*<(h3|h4|ul|ol|pre|\u0000FENCE)/.test(chunk.trim()) ? chunk : `<p>${chunk.trim().replace(/\n/g, '<br>')}</p>`
  ).join('');
  return s.replace(/\u0000FENCE(\d+)\u0000/g, (_, i) => fences[Number(i)]);
}

// A visible in-flight state. Without it the UI looks frozen for the many seconds a
// tool-calling turn takes, which reads as a hang.
function showThinking() {
  const div = document.createElement('div');
  div.className = 'msg agent thinking';
  div.id = 'nb-thinking';
  div.innerHTML = '<span class="who">nanobots</span><span class="dim">thinking<span class="dots"><span>.</span><span>.</span><span>.</span></span></span>';
  $('log').appendChild(div);
  $('log').scrollTop = $('log').scrollHeight;
}
function setThinking(label) {
  const el = document.getElementById('nb-thinking');
  if (el) el.innerHTML = `<span class="who">nanobots</span><span class="dim">${esc(label)}<span class="dots"><span>.</span><span>.</span><span>.</span></span></span>`;
}
function clearThinking() {
  document.getElementById('nb-thinking')?.remove();
}

function showThinkingAfterTool() {
  const el = document.getElementById('nb-thinking');
  if (el) $('log').appendChild(el);   // keep it as the last row
  $('log').scrollTop = $('log').scrollHeight;
}

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
  const hasToken = cfg.pat || Object.keys(cfg.patByOwner ?? {}).length;
  if (!hasToken || cfg.repos.length === 0 || !cfg.ai.apiKey) {
    addMsg('agent', 'nanobots', 'Set your GitHub token, repos, and model key in <a href="options.html">options</a> first.');
    $('send').disabled = true;
    return;
  }
  $('repo').innerHTML = cfg.repos.map((r) => `<option>${esc(r)}</option>`).join('');
  const { lastRepo } = await chrome.storage.local.get('lastRepo');
  if (lastRepo && cfg.repos.includes(lastRepo)) $('repo').value = lastRepo;

  // ?issue=owner/repo#N — arriving from the dashboard or a notification. Select that repo and
  // prime the box rather than dropping the user on a blank chat with the context in their head.
  const wanted = new URLSearchParams(location.search).get('issue');
  const parsed = wanted && wanted.match(/^(.+?)#(\d+)$/);
  // Only honour it if that repo is actually configured. Otherwise the prefill would ask about
  // issue #N while the dropdown still points at an unrelated repo — a confidently wrong answer.
  const ctx = parsed && cfg.repos.includes(parsed[1]) ? parsed : null;
  if (ctx) $('repo').value = ctx[1];

  $('repo').addEventListener('change', resetForRepo);
  await resetForRepo();

  // AFTER resetForRepo, which clears #log — saying this before it would append the warning and
  // then immediately wipe it, so the user would never see why their link did nothing.
  if (parsed && !ctx) {
    addMsg('agent', 'nanobots', `<b>${esc(parsed[1])}</b> isn't in your configured repos, so I can't open issue #${esc(parsed[2])} — add it in <a href="options.html">options</a>.`);
  }

  if (ctx) {
    $('input').value = `Catch me up on issue #${ctx[2]} — what is it, what has the loop done so far, and what is it waiting on?`;
    $('input').focus();
  }

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

  // OpenAI-compat multimodal parts; text-only models will error on image
  // parts — the catch below surfaces a clear message.
  const content = attachments.length
    ? [
        ...attachments.map((a) => ({ type: 'image_url', image_url: { url: a } })),
        { type: 'text', text: text || '(see attached screenshot)' },
      ]
    : text;
  history.push({ role: 'user', content });

  const turnAttachments = [...attachments];
  attachments = [];
  renderAttachments();

  showThinking();
  try {
    history = await chatTurn(cfg, $('repo').value, system, history, turnAttachments, (ev) => {
      if (ev.kind === 'tool') {
        const arg = ev.input.query ?? ev.input.path ?? ev.input.title ?? '';
        // Say what it is doing right now, and keep the indicator as the last row.
        addMsg('tool', '', `⚙ ${esc(ev.name)}${arg ? `: ${esc(String(arg))}` : ''}`);
        setThinking(`running ${ev.name}`);
        showThinkingAfterTool();
      } else if (ev.kind === 'text') {
        clearThinking();
        addMsg('agent', 'nanobots', md(ev.text));
      }
    });
  } catch (e) {
    clearThinking();
    const hint = turnAttachments.length && /image|vision|multimodal|content type/i.test(e.message)
      ? '<br><span class="dim">Your model may not support images — switch to a multimodal model to let the agent read screenshots. They still attach to filed reports either way.</span>'
      : '';
    addMsg('agent err', 'nanobots', `<span class="err">${esc(e.message)}</span>${hint}`);
    history.pop(); // drop the failed user turn so retry is clean
  }
  clearThinking();
  $('send').disabled = false;
  $('input').focus();
}

$('send').addEventListener('click', send);
$('input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send();
});
