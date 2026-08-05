import { getConfig, createIssue, logFiledIssue, tokenFor, repoHasLoop, INSTALL_CMD } from './gh.js';
import { uploadToR2, r2Configured } from './storage.js';

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const ctx = canvas.getContext('2d');

let pending = null;   // { shot, url, title, capturedAt }
let baseImage = null; // decoded screenshot
let tool = 'pen';
let issueType = 'bug';
let strokes = [];     // committed marks: {tool, points|[x0,y0,x1,y1]}
let current = null;   // in-progress mark

// ── boot ─────────────────────────────────────────────────────────────────────

(async function boot() {
  ({ pending } = await chrome.storage.session.get('pending'));
  if (!pending) {
    $('pageinfo').textContent = 'Nothing captured — click the nanobots icon on the page you want to report.';
    $('form').hidden = true;
    return;
  }
  $('pageinfo').textContent = `${pending.title} — ${pending.url}`;
  if (pending.fallbackReason) {
    $('pageinfo').textContent += ` — (overlay unavailable here: ${pending.fallbackReason})`;
  }

  const cfg = await getConfig();

  // Screenshots are R2-gated: no bucket connected → text-only reports.
  if (pending.shot && r2Configured(cfg.r2)) {
    baseImage = new Image();
    baseImage.onload = () => {
      canvas.width = baseImage.naturalWidth;
      canvas.height = baseImage.naturalHeight;
      redraw();
    };
    baseImage.src = pending.shot;
  } else {
    canvas.hidden = true;
    $('noshot').hidden = false;
    if (pending.shot) {
      $('noshot').innerHTML = 'Screenshots are disabled until you connect Cloudflare R2 (free tier is plenty) — <a href="options.html">set it up in options</a>. This report will file as text-only.';
    }
    document.querySelector('.toolbar').style.display = 'none';
  }

  if ((!cfg.pat && !Object.keys(cfg.patByOwner ?? {}).length) || cfg.repos.length === 0) {
    setStatus('Set your GitHub token and repos first — opening options…', true);
    chrome.runtime.openOptionsPage();
  }
  $('repo').innerHTML = cfg.repos.map((r) => `<option>${r}</option>`).join('');
  const { lastRepo } = await chrome.storage.local.get('lastRepo');
  if (lastRepo && cfg.repos.includes(lastRepo)) $('repo').value = lastRepo;
})();

// ── drawing ──────────────────────────────────────────────────────────────────

function redraw() {
  if (!baseImage) return;
  ctx.drawImage(baseImage, 0, 0);
  ctx.strokeStyle = '#ef4444';
  ctx.fillStyle = '#ef4444';
  ctx.lineWidth = Math.max(3, canvas.width / 500);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of [...strokes, current].filter(Boolean)) drawMark(s);
}

function drawMark(s) {
  ctx.beginPath();
  if (s.tool === 'pen') {
    s.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  } else if (s.tool === 'rect') {
    const [x0, y0, x1, y1] = s.box;
    ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
  } else if (s.tool === 'arrow') {
    const [x0, y0, x1, y1] = s.box;
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    const a = Math.atan2(y1 - y0, x1 - x0);
    const h = ctx.lineWidth * 4;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - h * Math.cos(a - 0.4), y1 - h * Math.sin(a - 0.4));
    ctx.lineTo(x1 - h * Math.cos(a + 0.4), y1 - h * Math.sin(a + 0.4));
    ctx.closePath();
    ctx.fill();
  }
}

function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * canvas.width, ((e.clientY - r.top) / r.height) * canvas.height];
}

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  const [x, y] = canvasPoint(e);
  current = tool === 'pen' ? { tool, points: [[x, y]] } : { tool, box: [x, y, x, y] };
});
canvas.addEventListener('pointermove', (e) => {
  if (!current) return;
  const [x, y] = canvasPoint(e);
  if (current.tool === 'pen') current.points.push([x, y]);
  else { current.box[2] = x; current.box[3] = y; }
  redraw();
});
canvas.addEventListener('pointerup', () => {
  if (current) strokes.push(current);
  current = null;
  redraw();
});

for (const t of ['pen', 'rect', 'arrow']) {
  $(`tool-${t}`).addEventListener('click', () => {
    tool = t;
    for (const u of ['pen', 'rect', 'arrow']) $(`tool-${u}`).classList.toggle('active', u === t);
  });
}
$('undo').addEventListener('click', () => { strokes.pop(); redraw(); });
$('clear').addEventListener('click', () => { strokes = []; redraw(); });

for (const [id, val] of [['type-bug', 'bug'], ['type-idea', 'idea']]) {
  $(id).addEventListener('click', () => {
    issueType = val;
    $('type-bug').classList.toggle('active', val === 'bug');
    $('type-idea').classList.toggle('active', val === 'idea');
  });
}

// ── submit ───────────────────────────────────────────────────────────────────

function setStatus(msg, isErr = false, asHtml = false) {
  const el = $('status');
  if (asHtml) el.innerHTML = msg;
  else el.textContent = msg;
  el.className = isErr ? 'err' : '';
}

$('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('submit');
  btn.disabled = true;
  try {
    const cfg = await getConfig();
    const nwo = $('repo').value;
    if (!tokenFor(cfg, nwo) || !nwo) throw new Error('Missing token or repo — set them in the extension options.');

    let imageMd = '';
    if (baseImage) {
      setStatus('uploading screenshot to R2…');
      const shotUrl = await uploadToR2(cfg.r2, canvas.toDataURL('image/png'));
      imageMd = `\n\n![annotated screenshot](${shotUrl})`;
    }

    setStatus('filing issue…');
    const labels = ['nanobots:inbox', 'nanobots:ext', issueType === 'bug' ? 'bug' : 'enhancement'];
    const body = [
      $('note').value.trim() || '_(no description — see screenshot)_',
      imageMd,
      '\n\n---',
      `| | |`,
      `|---|---|`,
      `| page | ${pending.url} |`,
      `| page title | ${pending.title} |`,
      `| captured | ${pending.capturedAt} |`,
      `| via | nanobots browser extension |`,
    ].join('\n');
    const issue = await createIssue(tokenFor(cfg, nwo), nwo, {
      title: `[${issueType === 'bug' ? 'bug' : 'feat'}] ${$('title').value.trim()}`,
      body,
      labels,
    });
    await logFiledIssue({
      nwo, number: issue.number, title: issue.title, url: issue.html_url,
      type: issueType, page: pending.url, filedAt: new Date().toISOString(),
    });
    // Same honesty as the in-page overlay: a repo without .nanobots/ will never triage this.
    const link = `<a href="${issue.html_url}" target="_blank">#${issue.number}</a>`;
    const loop = await repoHasLoop(tokenFor(cfg, nwo), nwo).catch(() => null);
    if (loop === false) {
      setStatus(`filed → ${link} — but <b>${nwo}</b> has no nanobots loop, so nothing will `
        + `triage it. Install it in that repo: <code>${INSTALL_CMD}</code>`, true, true);
    } else {
      setStatus(`filed → ${link} — the loop will triage it.`, false, true);
    }
  } catch (err) {
    setStatus(err.message, true);
    btn.disabled = false;
  }
});
